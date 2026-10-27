// WP-06 pipeline service — §7.5 orchestration steps. The workspace page
// (client) drives transcribe → analyze → generate×7 (parallel, max 4
// concurrent); every server step here is idempotent, re-checks status from
// the DB, and never trusts client state. Boundaries: @/db/queries,
// @/lib/ai/{generate,analyze}, Resend (optional ready email).
import * as queries from "@/db/queries";
import { isDbConfigured } from "@/lib/env";
import { SAVE_UNAVAILABLE_COPY, AUTH_REQUIRED_COPY } from "@/lib/copy";
import { generateArtifact } from "@/lib/ai/generate";
import { runAnalyze } from "@/lib/ai/analyze";
import { DEFAULT_VOICE_PROFILE, type VoiceProfile } from "@/lib/ai/voice";
import { ARTIFACT_KINDS, artifactContentSchema, type ArtifactKind } from "@/lib/artifacts/schemas";
import { effectivePlan } from "@/lib/billing/entitlements";
import type { Segment } from "@/lib/quotes/types";

export interface ApiResult {
  status: number;
  json: Record<string, unknown>;
}

const ARTIFACT_STATUSES = ["pending", "writing", "ready", "failed", "fallback"] as const;

function segmentRowToSegment(row: queries.SegmentRow): Segment {
  return {
    id: row.id,
    idx: row.idx,
    speaker: row.speaker ?? null,
    startMs: row.startMs ?? null,
    endMs: row.endMs ?? null,
    text: row.text,
  };
}

type LoadedContext =
  | { ok: false; result: ApiResult }
  | { ok: true; owned: NonNullable<Awaited<ReturnType<typeof queries.getEpisodeForUser>>> };

async function loadContext(userId: string, episodeId: string): Promise<LoadedContext> {
  if (!isDbConfigured()) {
    return { ok: false, result: { status: 503, json: { error: SAVE_UNAVAILABLE_COPY } } };
  }
  const owned = await queries.getEpisodeForUser(userId, episodeId);
  if (!owned) {
    return { ok: false, result: { status: 404, json: { error: "Episode not found." } } };
  }
  return { ok: true, owned };
}

// ---------------------------------------------------------------------------
// POST /api/episodes/:id/analyze (§7.5)
// ---------------------------------------------------------------------------
export async function handleAnalyzePost(userId: string, episodeId: string): Promise<ApiResult> {
  const ctx = await loadContext(userId, episodeId);
  if (!ctx.ok) return ctx.result;
  const { episode } = ctx.owned;

  // Idempotent: segments must exist (paste creates them at POST /api/episodes;
  // upload creates them in transcribe).
  const segmentRows = await queries.listSegments(episodeId);
  if (segmentRows.length === 0) {
    return { status: 400, json: { errorCode: "no_transcript", error: "Transcribe or paste the episode first." } };
  }

  const existing = await queries.getAnalysis(episodeId);
  if (existing) {
    return { status: 200, json: { ok: true, analysis: serializeAnalysis(existing), cached: true } };
  }

  const segments = segmentRows.map(segmentRowToSegment);
  const result = await runAnalyze({
    segments,
    hasTimestamps: episode.hasTimestamps,
    show: { name: ctx.owned.show.name },
  });

  await queries.upsertAnalysis(episodeId, {
    chapters: result.chapters ?? null,
    topics: result.topics,
    candidateQuotes: result.candidateQuotes,
  });
  return {
    status: 200,
    json: {
      ok: true,
      cached: false,
      analysis: {
        chapters: result.chapters,
        topics: result.topics,
        candidateQuotes: result.candidateQuotes,
      },
      status: result.status,
    },
  };
}

function serializeAnalysis(row: queries.AnalysisRow) {
  return {
    chapters: row.chapters as { startMs: number; title: string }[] | null,
    topics: row.topics,
    candidateQuotes: row.candidateQuotes as unknown,
  };
}

// ---------------------------------------------------------------------------
// POST /api/episodes/:id/artifacts/:kind/generate (§7.5; {instruction?} regen)
// ---------------------------------------------------------------------------
const regenBuckets = new Map<string, number[]>();
const REGEN_LIMIT_PER_HOUR = 60;

export function regensInLastHour(userId: string, now = Date.now()): number {
  const hits = (regenBuckets.get(userId) ?? []).filter((t) => now - t < 3_600_000);
  regenBuckets.set(userId, hits);
  return hits.length;
}

export async function handleArtifactGeneratePost(
  userId: string,
  episodeId: string,
  kind: string,
  body: unknown,
): Promise<ApiResult> {
  if (!(ARTIFACT_KINDS as readonly string[]).includes(kind)) {
    return { status: 404, json: { error: "Unknown artifact." } };
  }
  const ctx = await loadContext(userId, episodeId);
  if (!ctx.ok) return ctx.result;
  const { episode, show, workspace } = ctx.owned;

  const instruction =
    typeof (body as { instruction?: unknown })?.instruction === "string"
      ? (body as { instruction: string }).instruction.slice(0, 200)
      : undefined;

  const existingRows = await queries.getArtifactsByEpisode(episodeId);
  const artifactKind = kind as ArtifactKind;
  const existing = existingRows.find((r) => r.kind === kind);

  if (instruction !== undefined && existing) {
    if (regensInLastHour(userId) >= REGEN_LIMIT_PER_HOUR) {
      return { status: 429, json: { error: "Too many regenerations. Try again later." } };
    }
    if (existing.regenCount >= 20) {
      return { status: 409, json: { errorCode: "regen_cap", error: "This artifact hit its 20 regenerations limit." } };
    }
    const hits = regenBuckets.get(userId) ?? [];
    hits.push(Date.now());
    regenBuckets.set(userId, hits);
  }

  // Idempotency: a writing/ready artifact without an instruction is a no-op.
  if (existing && existing.status !== "failed" && existing.status !== "fallback" && instruction === undefined) {
    return { status: 200, json: { ok: true, artifact: serializeArtifact(existing), cached: true } };
  }

  const segmentRows = await queries.listSegments(episodeId);
  if (segmentRows.length === 0) {
    return { status: 400, json: { errorCode: "no_transcript", error: "Transcribe or paste the episode first." } };
  }
  const segments = segmentRows.map(segmentRowToSegment);

  const analysisRow = await queries.getAnalysis(episodeId);
  const voice = (show.voiceProfile as VoiceProfile | null) ?? DEFAULT_VOICE_PROFILE;

  await queries.updateEpisode(episodeId, { status: "writing" });
  if (existing && existing.content) {
    await queries.upsertArtifact(episodeId, artifactKind, {
      status: "writing",
      previousContent: existing.content,
    });
  } else {
    await queries.upsertArtifact(episodeId, artifactKind, { status: "writing" });
  }

  const result = await generateArtifact({
    kind: artifactKind,
    segments,
    show: {
      name: show.name,
      defaultCta: show.defaultCta ?? undefined,
      vocabulary: show.vocabulary ?? [],
      allowedUrls: show.listenUrl ? [show.listenUrl] : [],
    },
    voice,
    voiceSamples: show.voiceSamples ?? [],
    meta: {
      title: episode.title ?? undefined,
      number: episode.number ?? undefined,
      guests: (episode.guests as string[] | null) ?? undefined,
    },
    instruction,
    analysisCandidates: (analysisRow?.candidateQuotes as never) ?? undefined,
    deps: {
      workspaceId: workspace.id,
      episodeId,
    },
  });

  const row = await queries.upsertArtifact(episodeId, artifactKind, {
    status: result.status === "fallback" ? "fallback" : result.errorCode ? "failed" : "ready",
    content: result.content,
    provider: result.provider,
    model: result.model,
    errorCode: result.errorCode,
    ...(instruction !== undefined && existing
      ? { regenCount: existing.regenCount + 1 }
      : {}),
  });

  // Episode becomes ready when every artifact has landed (the client polls
  // GET /api/episodes/:id; the last finishing generate flips the status and
  // sends the ready email — §7.5).
  const rows = await queries.getArtifactsByEpisode(episodeId);
  const allLanded = ARTIFACT_KINDS.every((k) =>
    rows.some((r) => r.kind === k && (r.status === "ready" || r.status === "fallback" || r.status === "failed")),
  );
  if (allLanded && episode.status !== "ready") {
    await queries.updateEpisode(episodeId, { status: "ready" });
    void sendReadyEmail(userId, episode.title ?? "your episode");
  }

  return { status: 200, json: { ok: true, artifact: serializeArtifact(row), cached: false } };
}

// ---------------------------------------------------------------------------
// PATCH /api/artifacts/:id — {content} save · {ready} · {undo:true} (§7.5)
// ---------------------------------------------------------------------------
export async function handleArtifactPatch(userId: string, artifactId: string, body: unknown): Promise<ApiResult> {
  if (!isDbConfigured()) return { status: 503, json: { error: SAVE_UNAVAILABLE_COPY } };
  const artifact = await queries.getArtifactForUser(userId, artifactId);
  if (!artifact) return { status: 404, json: { error: "Artifact not found." } };

  const b = (body ?? {}) as { content?: unknown; ready?: unknown; undo?: unknown };

  if (b.undo === true) {
    const row = await queries.undoArtifact(artifactId);
    return { status: 200, json: { ok: true, artifact: row ? serializeArtifact(row) : null } };
  }

  if (typeof b.ready === "boolean") {
    await queries.setArtifactReady(artifactId, b.ready);
    return { status: 200, json: { ok: true } };
  }

  if (b.content !== undefined) {
    const schema = artifactContentSchema(artifact.kind as ArtifactKind);
    const parsed = schema.safeParse(b.content);
    if (!parsed.success) {
      return { status: 400, json: { error: "That content doesn't match the artifact shape." } };
    }
    await queries.updateArtifactContent(artifactId, parsed.data);
    return { status: 200, json: { ok: true, savedAt: new Date().toISOString() } };
  }

  return { status: 400, json: { error: "Nothing to update." } };
}

// ---------------------------------------------------------------------------
// DELETE /api/episodes/:id — delete episode (+ blob) (§7.5)
// ---------------------------------------------------------------------------
export async function handleEpisodeDelete(userId: string, episodeId: string): Promise<ApiResult> {
  const ctx = await loadContext(userId, episodeId);
  if (!ctx.ok) return ctx.result;
  const { episode } = ctx.owned;
  // Blob deletion is best-effort at the storage layer; without BLOB_READ_WRITE_TOKEN
  // there is nothing to clean. TODO(owner keys): del() when configured.
  await queries.deleteEpisodeForUser(userId, episodeId);
  return { status: 200, json: { ok: true } };
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------
export function serializeArtifact(row: queries.ArtifactRow) {
  return {
    id: row.id,
    episodeId: row.episodeId,
    kind: row.kind,
    status: row.status,
    content: row.content,
    previousContent: row.previousContent,
    ready: row.readyFlag,
    regenCount: row.regenCount,
    provider: row.provider,
    model: row.model,
    errorCode: row.errorCode,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type SerializedArtifact = ReturnType<typeof serializeArtifact>;

export async function handleEpisodeWithArtifactsGet(userId: string, episodeId: string): Promise<ApiResult> {
  if (!isDbConfigured()) return { status: 503, json: { error: SAVE_UNAVAILABLE_COPY } };
  const owned = await queries.getEpisodeForUser(userId, episodeId);
  if (!owned) return { status: 404, json: { error: "Episode not found." } };
  const { episode } = owned;
  const artifactRows = await queries.getArtifactsByEpisode(episodeId);
  const analysisRow = await queries.getAnalysis(episodeId);
  const segmentRows = await queries.listSegments(episodeId);
  return {
    status: 200,
    json: {
      episode: {
        id: episode.id,
        title: episode.title,
        number: episode.number,
        source: episode.source,
        status: episode.status,
        errorCode: episode.errorCode,
        durationMs: episode.durationMs,
        hasTimestamps: episode.hasTimestamps,
        hasSpeakers: episode.hasSpeakers,
        createdAt: episode.createdAt.toISOString(),
      },
      artifacts: artifactRows.map(serializeArtifact),
      analysis: analysisRow ? serializeAnalysis(analysisRow) : null,
      hasSegments: segmentRows.length > 0,
      segments: segmentRows.map((r) => ({
        id: r.id,
        speaker: r.speaker ?? null,
        startMs: r.startMs ?? null,
        text: r.text,
      })),
      // M7 footer flag: effectivePlan keeps Pro until current_period_end.
      freePlan:
        effectivePlan(
          {
            plan: owned.workspace.plan,
            status: owned.workspace.status,
            founding: owned.workspace.founding,
            currentPeriodEnd: owned.workspace.currentPeriodEnd ?? null,
          },
          new Date(),
        ) === "free",
    },
  };
}

// ---------------------------------------------------------------------------
// Ready email (§6 copy) — Resend only when configured; never blocks.
// ---------------------------------------------------------------------------
async function sendReadyEmail(userId: string, title: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const to = await queries.getUserEmail(userId).catch(() => null);
  if (!to) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "EpisodeKit <hello@episodekit.app>",
        to: [to],
        subject: `Your package for “${title}” is ready`,
        text: "Show notes, chapters, a blog post, a newsletter and social posts are ready to review.",
      }),
    });
    if (!res.ok) console.error("ready email failed:", res.status);
  } catch (err) {
    console.error("ready email failed:", err);
  }
}
