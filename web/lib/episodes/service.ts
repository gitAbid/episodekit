/**
 * Intake service (WP-05): POST /api/episodes, POST /api/episodes/:id/transcribe,
 * GET /api/episodes/:id (status read path for U4), GET /api/audio/:episodeId,
 * POST /api/uploads/token (§7.5). DB/blob/ASR calls go through their documented
 * boundaries (@/db/queries, @/lib/blob, @/lib/asr/groq) so tests mock the seams
 * and keyless previews degrade with a clean 503.
 *
 * Quota: counted at create (§7.5) through the entitlements stub
 * (lib/billing/entitlements — WP-08 replaces the bodies). Failures refund:
 * unsupported_language / no_speech set counts_quota = false (U19: "This one
 * wasn't charged"). Sample episodes never count (M2).
 */
import {
  AUDIO_UPLOAD_CONTENT_TYPES,
  MAX_UPLOAD_BYTES,
  checkEpisodeQuota,
  planLimits,
  quotaWallCopy,
} from "@/lib/billing/entitlements";
import {
  AUDIO_PLAYBACK_UNAVAILABLE_COPY,
  NO_AUDIO_COPY,
  NO_SHOW_COPY,
  NO_SPEECH_COPY,
  PASTE_TRANSCRIPT_FIRST_COPY,
  SAVE_UNAVAILABLE_COPY,
  TRANSCRIBE_FAILED_COPY,
  UNSUPPORTED_LANGUAGE_COPY,
  UPLOAD_AUDIO_FIRST_COPY,
} from "@/lib/copy";
import { isDbConfigured } from "@/lib/env";
import { AsrError, transcribeWithGroq } from "@/lib/asr/groq";
import { supportedInput } from "@/lib/asr/language";
import { handleClientUpload, isBlobConfigured, issueAudioUrl } from "@/lib/blob";
import type { ApiResult } from "@/lib/rss/preview";
import type { Segment } from "@/lib/quotes/types";
import * as queries from "@/db/queries";
import { parseTranscript } from "@/lib/transcripts";
import { quotaMonthNow } from "./month";
import {
  chunkContaining,
  parseChunkManifest,
  serializeChunkManifest,
  type StoredChunk,
} from "./manifest";
import { episodeCreateSchema, episodeTranscribeSchema } from "./input";

export type { ApiResult };

export interface SerializedEpisode {
  id: string;
  title: string | null;
  number: number | null;
  source: "upload" | "paste" | "sample";
  status: "uploading" | "queued" | "transcribing" | "writing" | "ready" | "failed";
  errorCode: string | null;
  durationMs: number | null;
  hasTimestamps: boolean;
  hasSpeakers: boolean;
  countsQuota: boolean;
}

export function serializeEpisode(episode: queries.EpisodeRow): SerializedEpisode {
  return {
    id: episode.id,
    title: episode.title,
    number: episode.number,
    source: episode.source,
    status: episode.status,
    errorCode: episode.errorCode,
    durationMs: episode.durationMs,
    hasTimestamps: episode.hasTimestamps,
    hasSpeakers: episode.hasSpeakers,
    countsQuota: episode.countsQuota,
  };
}

/** §9: every app route resolves the episode through the caller's workspace. */
export async function requireEpisode(userId: string, episodeId: string) {
  return queries.getEpisodeForUser(userId, episodeId);
}

/** Chunks with a valid manifest entry; blobPaths[] + chunkOffsetsMs[] per §7.5. */
function chunksFromBody(body: {
  blobPaths?: string[];
  chunkOffsetsMs?: number[];
}): StoredChunk[] | null {
  if (!body.blobPaths?.length) return null;
  const offsets = body.chunkOffsetsMs ?? [];
  return body.blobPaths.map((path, i) => ({ path, offsetMs: offsets[i] ?? 0 }));
}

/**
 * POST /api/episodes — create {source, blobPaths[]?, chunkOffsetsMs[]?,
 * transcriptText?, title?, number?, guests?} → {id, status} (§7.5).
 * Upload → status uploading; paste/sample → transcript parsed into segments,
 * status queued. Counts quota except for samples (M2).
 */
export async function handleEpisodesPost(userId: string, raw: unknown): Promise<ApiResult> {
  if (!isDbConfigured()) {
    return { status: 503, json: { error: SAVE_UNAVAILABLE_COPY } };
  }
  const parsed = episodeCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: 400, json: { error: parsed.error.issues[0]?.message ?? "Invalid request." } };
  }
  const body = parsed.data;
  const show = await queries.getShowByOwner(userId);
  if (!show) {
    return { status: 404, json: { error: NO_SHOW_COPY } };
  }
  const workspace = await queries.getOrCreateWorkspaceByOwner(userId);

  const isSample = body.source === "sample";
  if (!isSample) {
    const quota = await checkEpisodeQuota(workspace);
    if (!quota.allowed) {
      return { status: 402, json: { errorCode: "quota_exceeded", error: quotaWallCopy(quota) } };
    }
  }

  let segments: Segment[] = [];
  let hasTimestamps = false;
  let hasSpeakers = false;
  if (body.source === "paste" || body.source === "sample") {
    const text = (body.transcriptText ?? "").trim();
    if (!text) {
      return { status: 400, json: { errorCode: "empty_transcript", error: PASTE_TRANSCRIPT_FIRST_COPY } };
    }
    // English-only for the MVP — same gate as ASR (§8.3); nothing is created,
    // so nothing is charged (U19).
    if (!supportedInput(text)) {
      return { status: 400, json: { errorCode: "unsupported_language", error: UNSUPPORTED_LANGUAGE_COPY } };
    }
    const parsedTranscript = parseTranscript(text);
    segments = parsedTranscript.segments.map((s, idx) => ({
      id: `seg_${String(idx).padStart(6, "0")}`,
      idx,
      speaker: s.speaker,
      startMs: s.startMs,
      endMs: s.endMs,
      text: s.text,
    }));
    hasTimestamps = parsedTranscript.hasTimestamps;
    hasSpeakers = parsedTranscript.hasSpeakers;
  }

  const chunks = chunksFromBody(body);
  const episode = await queries.createEpisode({
    showId: show.id,
    title: body.title ?? null,
    number: body.number ?? null,
    guests: body.guests ?? null,
    source: body.source,
    audioBlobPath: chunks ? serializeChunkManifest(chunks) : null,
    hasTimestamps,
    hasSpeakers,
    status: body.source === "upload" ? "uploading" : "queued",
    quotaMonth: isSample ? null : quotaMonthNow(),
    countsQuota: !isSample,
  });

  if (segments.length) {
    await queries.replaceSegments(
      episode.id,
      segments.map((s) => ({
        id: s.id,
        idx: s.idx,
        speaker: s.speaker,
        startMs: s.startMs,
        endMs: s.endMs,
        text: s.text,
      })),
    );
  }

  return { status: 201, json: { id: episode.id, status: episode.status } };
}

/** GET /api/episodes/:id — episode + status (U4 resumable read path). */
export async function handleEpisodeGet(userId: string, episodeId: string): Promise<ApiResult> {
  if (!isDbConfigured()) {
    return { status: 503, json: { error: SAVE_UNAVAILABLE_COPY } };
  }
  const owned = await requireEpisode(userId, episodeId);
  if (!owned) {
    return { status: 404, json: { error: "Episode not found." } };
  }
  return { status: 200, json: { episode: serializeEpisode(owned.episode) } };
}

/** Maps AsrError codes to §6 error codes. */
export function mapAsrErrorCode(code: string): string {
  if (code === "unsupported_language") return "unsupported_language";
  if (code === "empty_transcript" || code === "empty_audio") return "no_speech";
  if (code === "too_large") return "too_long";
  return "transcribe_failed";
}

export function errorCodeCopy(code: string): string {
  switch (code) {
    case "unsupported_language":
      return UNSUPPORTED_LANGUAGE_COPY;
    case "no_speech":
      return NO_SPEECH_COPY;
    case "too_long":
      return "Episodes can be up to 2 hours on your plan.";
    default:
      return TRANSCRIBE_FAILED_COPY;
  }
}

/**
 * POST /api/episodes/:id/transcribe (§7.5) — runs Groq on the uploaded chunks
 * → segments. Status transitions uploading→queued→transcribing; success →
 * queued (queued-for-writing). Idempotent: transcribing/done states are
 * returned as-is so a refresh or second tab resumes from DB state.
 */
export async function handleTranscribePost(
  userId: string,
  episodeId: string,
  raw: unknown,
): Promise<ApiResult> {
  if (!isDbConfigured()) {
    return { status: 503, json: { error: SAVE_UNAVAILABLE_COPY } };
  }
  const owned = await requireEpisode(userId, episodeId);
  if (!owned) {
    return { status: 404, json: { error: "Episode not found." } };
  }
  const { episode, show } = owned;
  if (episode.source !== "upload") {
    return { status: 400, json: { error: NO_AUDIO_COPY } };
  }
  if (episode.status === "transcribing" || episode.status === "writing" || episode.status === "ready") {
    return { status: 200, json: { episode: serializeEpisode(episode) } };
  }

  const parsed = episodeTranscribeSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return { status: 400, json: { error: parsed.error.issues[0]?.message ?? "Invalid request." } };
  }
  const chunks: StoredChunk[] = parsed.data.chunks?.length
    ? parsed.data.chunks
    : parseChunkManifest(episode.audioBlobPath);
  if (!chunks.length) {
    return { status: 400, json: { error: UPLOAD_AUDIO_FIRST_COPY } };
  }

  // uploading→queued→transcribing: two visible transitions (U4 status read path).
  await queries.updateEpisode(episode.id, {
    status: "queued",
    audioBlobPath: serializeChunkManifest(chunks),
    errorCode: null,
  });
  await queries.updateEpisode(episode.id, { status: "transcribing" });

  const guests = Array.isArray(episode.guests) ? (episode.guests as string[]) : [];
  const vocab = [...(show.vocabulary ?? []), ...guests];

  try {
    const segments = await transcribeWithGroq(
      chunks.map((c) => ({ blobPath: c.path, offsetMs: c.offsetMs })),
      { vocab },
    );
    await queries.replaceSegments(
      episode.id,
      segments.map((s) => ({
        id: s.id,
        idx: s.idx,
        speaker: s.speaker,
        startMs: s.startMs,
        endMs: s.endMs,
        text: s.text,
      })),
    );
    const durationMs = segments.reduce((max, s) => Math.max(max, s.endMs ?? 0), 0) || null;
    const updated = await queries.updateEpisode(episode.id, {
      status: "queued", // queued-for-writing (§7.5); WP-06 drives writing
      durationMs,
      hasTimestamps: true,
      hasSpeakers: false,
      errorCode: null,
    });
    return { status: 200, json: { episode: serializeEpisode(updated) } };
  } catch (err) {
    const code = err instanceof AsrError ? mapAsrErrorCode(err.code) : "transcribe_failed";
    // No quota used on failure (U19 / M10 refund).
    const updated = await queries.updateEpisode(episode.id, {
      status: "failed",
      errorCode: code,
      countsQuota: false,
    });
    return { status: 200, json: { episode: serializeEpisode(updated) } };
  }
}

/**
 * GET /api/audio/:episodeId?t=<ms> — short-lived signed URL for the chunk
 * containing t (§7.5; quote playback in M5 seeks within that chunk).
 */
export async function handleAudioGet(
  userId: string,
  episodeId: string,
  tMs = 0,
): Promise<ApiResult> {
  if (!isDbConfigured()) {
    return { status: 503, json: { error: SAVE_UNAVAILABLE_COPY } };
  }
  const owned = await requireEpisode(userId, episodeId);
  if (!owned) {
    return { status: 404, json: { error: "Episode not found." } };
  }
  const chunks = parseChunkManifest(owned.episode.audioBlobPath);
  if (!chunks.length) {
    return { status: 404, json: { error: NO_AUDIO_COPY } };
  }
  if (!isBlobConfigured()) {
    return { status: 503, json: { error: AUDIO_PLAYBACK_UNAVAILABLE_COPY } };
  }
  const chunk = chunkContaining(chunks, Math.max(0, tMs));
  if (!chunk) {
    return { status: 404, json: { error: NO_AUDIO_COPY } };
  }
  try {
    const { url, expiresAt } = await issueAudioUrl(chunk.path);
    return { status: 200, json: { url, chunkOffsetMs: chunk.offsetMs, expiresAt } };
  } catch {
    return { status: 502, json: { error: "Audio storage error. Try again." } };
  }
}

/**
 * POST /api/uploads/token (§7.5) — the @vercel/blob client-upload token route.
 * Type allow-list + ≤300 MB + quota check (via the entitlements stub). The
 * real token is issued by handleUpload; keyless previews answer 503.
 */
export async function handleUploadsTokenPost(userId: string, request: Request): Promise<ApiResult> {
  if (!isDbConfigured()) {
    return { status: 503, json: { error: SAVE_UNAVAILABLE_COPY } };
  }
  if (!isBlobConfigured()) {
    return { status: 503, json: { error: "Audio upload isn't set up in this preview." } };
  }
  const show = await queries.getShowByOwner(userId);
  if (!show) {
    return { status: 404, json: { error: NO_SHOW_COPY } };
  }
  const workspace = await queries.getOrCreateWorkspaceByOwner(userId);
  const quota = await checkEpisodeQuota(workspace);
  if (!quota.allowed) {
    return { status: 402, json: { errorCode: "quota_exceeded", error: quotaWallCopy(quota) } };
  }
  const result = await handleClientUpload(request, {
    allowedContentTypes: AUDIO_UPLOAD_CONTENT_TYPES,
    maximumSizeInBytes: MAX_UPLOAD_BYTES,
  });
  return { status: 200, json: { ok: true, result: result as Record<string, unknown> } };
}

/** Plan duration limit for the client-side 2 h gate (§6 too_long copy). */
export function maxDurationMsForPlan(plan: string): number {
  return planLimits(plan).maxDurationMs;
}
