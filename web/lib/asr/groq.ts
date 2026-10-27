/**
 * Groq Whisper ASR adapter (§8.3).
 *
 * transcribe(chunks, opts) → Segment[] where chunks are the ≤10-min Opus
 * files the browser uploaded ({blobPath, offsetMs}). Each chunk is POSTed to
 * Groq /openai/v1/audio/transcriptions with verbose_json + segment
 * timestamps, transcribed with concurrency 3, then merged: 2 s overlap
 * dedupe by timestamp + sentence-group merge (lib/asr/merge).
 *
 * Error handling is ported from api/asr.js (AsrError with code + status,
 * injectable fetch for tests). Language gate: whisper `language` ≠ english
 * or Latin ratio < 0.6 → unsupported_language, no quota used (U19).
 */
import type { Segment } from "@/lib/quotes/types";
import { isSupportedAsrLanguage } from "./language";
import { mergeChunks, type ChunkSegments } from "./merge";

export class AsrError extends Error {
  constructor(
    public code: string,
    public status = 502,
  ) {
    super(code);
    this.name = "AsrError";
  }
}

export const GROQ_MODEL = "whisper-large-v3-turbo";
export const ASR_CONCURRENCY = 3;
export const GROQ_ASR_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
/** Whisper tokens are ~4 chars; the prompt accepts ≤200 tokens. */
const PROMPT_MAX_CHARS = 800;

export interface AsrChunk {
  blobPath: string;
  offsetMs: number;
}

export interface FetchChunkResult {
  body: ArrayBuffer | Blob;
  contentType: string;
  filename: string;
}

export interface GroqTranscribeDeps {
  fetchImpl?: typeof fetch;
  /** Fetches an uploaded chunk from Blob storage (boundary; mocked in tests). */
  fetchChunk?: (blobPath: string) => Promise<FetchChunkResult>;
  apiKey?: string;
}

/** Key resolution order ported from api/asr.js (ASR_API_KEY then provider key). */
export function resolveAsrApiKey(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.ASR_API_KEY || env.GROQ_API_KEY || null;
}

/** Vocabulary + guest names, capped at ~200 tokens. */
export function buildAsrPrompt(vocab: string[]): string {
  const terms = vocab.map((v) => v.trim()).filter(Boolean);
  let prompt = "";
  for (const term of terms) {
    const candidate = prompt ? `${prompt}, ${term}` : term;
    if (candidate.length > PROMPT_MAX_CHARS) break;
    prompt = candidate;
  }
  return prompt;
}

interface VerboseJsonSegment {
  start: number;
  end: number;
  text: string;
}

async function transcribeOne(
  chunk: AsrChunk,
  prompt: string,
  deps: Required<Pick<GroqTranscribeDeps, "fetchImpl" | "fetchChunk">> & { apiKey: string },
): Promise<ChunkSegments> {
  const { body, contentType, filename } = await deps.fetchChunk(chunk.blobPath);
  const form = new FormData();
  form.append("file", new File([body], filename, { type: contentType || "audio/webm" }), filename);
  form.append("model", GROQ_MODEL);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  form.append("language", "en");
  if (prompt) form.append("prompt", prompt);

  const res = await deps.fetchImpl(GROQ_ASR_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${deps.apiKey}` },
    body: form,
  });
  // Ported from api/asr.js: provider errors become AsrError("groq_<status>").
  if (!res.ok) throw new AsrError(`groq_${res.status}`, 502);
  const j = (await res.json()) as {
    text?: string;
    language?: string;
    segments?: VerboseJsonSegment[];
  };
  const segments = (j.segments ?? []).filter((s) => s.text && s.text.trim());
  if (!segments.length) throw new AsrError("empty_transcript", 422);
  const text = segments.map((s) => s.text).join(" ");
  if (!isSupportedAsrLanguage(j.language, text)) {
    throw new AsrError("unsupported_language", 422);
  }
  return { offsetMs: chunk.offsetMs, segments };
}

/**
 * Transcribe uploaded chunks on Groq and merge into stored Segment[].
 * Concurrency 3; results are merged in chunk order regardless of completion.
 */
export async function transcribeWithGroq(
  chunks: AsrChunk[],
  opts: { vocab: string[] },
  deps: GroqTranscribeDeps = {},
): Promise<Segment[]> {
  if (!chunks.length) throw new AsrError("empty_audio", 400);
  const apiKey = deps.apiKey ?? resolveAsrApiKey();
  if (!apiKey) throw new AsrError("not_configured", 503);
  const fetchImpl = deps.fetchImpl ?? fetch;
  const fetchChunk =
    deps.fetchChunk ??
    (async () => {
      throw new AsrError("not_configured", 503);
    });
  const prompt = buildAsrPrompt(opts.vocab);

  const results: ChunkSegments[] = new Array(chunks.length);
  let next = 0;
  const worker = async () => {
    while (next < chunks.length) {
      const index = next;
      next += 1;
      results[index] = await transcribeOne(chunks[index], prompt, {
        fetchImpl,
        fetchChunk,
        apiKey,
      });
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(ASR_CONCURRENCY, chunks.length) }, () => worker()),
  );
  return mergeChunks(results);
}
