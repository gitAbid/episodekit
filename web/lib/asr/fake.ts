/**
 * In-memory fake ASR adapter (§8.3 "a fake/in-memory adapter for tests").
 * Deterministic: one segment per script line, spread across the given chunk
 * offsets with the overlap dedupe exercised. No network, no key.
 */
import type { Segment } from "@/lib/quotes/types";
import { mergeChunks, type RawAsrSegment } from "./merge";
import type { AsrChunk } from "./groq";

export interface FakeAsrOptions {
  /** One text per chunk; defaults to a one-line placeholder per chunk. */
  linesPerChunk?: string[][];
  /** Seconds of audio each chunk covers (for end times). Default 598. */
  chunkDurationSec?: number;
}

export function fakeTranscribe(chunks: AsrChunk[], opts: FakeAsrOptions = {}): Segment[] {
  if (!chunks.length) return [];
  const duration = opts.chunkDurationSec ?? 598;
  return mergeChunks(
    chunks.map((chunk, i) => {
      const lines = opts.linesPerChunk?.[i] ?? [`Chunk ${i + 1} transcript line.`];
      const segments: RawAsrSegment[] = lines.map((text, j) => {
        const start = j === 0 ? 0.5 : (duration / lines.length) * j;
        return {
          start,
          end: Math.min(duration, start + 3),
          text,
        };
      });
      return { offsetMs: chunk.offsetMs, segments };
    }),
  );
}
