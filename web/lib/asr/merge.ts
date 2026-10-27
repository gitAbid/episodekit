/**
 * Segment merge (§8.3): the browser produces ≤10-min Opus chunks with a 2 s
 * overlap; the server transcribes each chunk and merges:
 * 1. offset chunk-relative times to absolute ms;
 * 2. de-duplicate the 2 s overlap by timestamp — a leading segment of chunk N
 *    that starts inside chunk N's overlap window is dropped when chunk N-1
 *    already transcribed past the seam;
 * 3. merge Whisper segments into ~sentence-group segments (≤45 s / ≤500 chars).
 */
import type { Segment } from "@/lib/quotes/types";

export const OVERLAP_MS = 2000;
export const MAX_GROUP_SPAN_MS = 45_000;
export const MAX_GROUP_CHARS = 500;

/** Chunk-relative Whisper segment (verbose_json returns seconds). */
export interface RawAsrSegment {
  start: number;
  end: number;
  text: string;
}

export interface ChunkSegments {
  offsetMs: number;
  segments: RawAsrSegment[];
}

const SENTENCE_END = /[.!?…]["')\]]?$/;

function absolute(chunk: ChunkSegments): Segment[] {
  return chunk.segments.map((s) => ({
    id: "",
    idx: 0,
    speaker: null,
    startMs: Math.round(chunk.offsetMs + s.start * 1000),
    endMs: Math.round(chunk.offsetMs + s.end * 1000),
    text: s.text.trim(),
  }));
}

/**
 * Dedupe the overlap seam. A segment from chunk N that starts within
 * [offsetMs, offsetMs + OVERLAP_MS) duplicates audio chunk N-1 already
 * covered — drop it, but only when chunk N-1 actually transcribed up to the
 * seam (one of its segments ends at/after the chunk N start). Otherwise the
 * previous chunk missed its tail and dropping would lose words.
 */
export function dedupeOverlap(chunks: ChunkSegments[]): Segment[] {
  const ordered: Segment[] = [];
  for (let i = 0; i < chunks.length; i += 1) {
    const current = absolute(chunks[i]);
    if (i > 0) {
      const seam = chunks[i].offsetMs;
      const prevCoversSeam = ordered.some((s) => (s.endMs ?? 0) >= seam);
      for (const seg of current) {
        if (prevCoversSeam && seg.startMs !== null && seg.startMs < seam + OVERLAP_MS) {
          continue; // duplicate of the overlap region
        }
        ordered.push(seg);
      }
    } else {
      ordered.push(...current);
    }
  }
  return ordered.filter((s) => s.text.length > 0);
}

/**
 * Merge flat Whisper segments into sentence groups bounded by
 * ≤45 s span and ≤500 chars. Assigns seg_XXXXXX ids and sequential idx.
 */
export function mergeSentenceGroups(segments: Segment[]): Segment[] {
  const groups: Segment[] = [];
  const push = (group: Segment) => {
    groups.push({ ...group, id: segmentId(groups.length), idx: groups.length });
  };
  let open: Segment | null = null;

  for (const seg of segments) {
    // Fresh per-iteration binding: the loop's entry narrowing of `open` is
    // null (its initializer), so group building works on a clean local.
    // Assertion resets the loop-entry narrowing (open starts as null).
    let cur = open as Segment | null;
    if (cur) {
      const spanOver =
        seg.startMs !== null &&
        cur.startMs !== null &&
        seg.endMs !== null &&
        seg.endMs - cur.startMs > MAX_GROUP_SPAN_MS;
      const charsOver = cur.text.length + 1 + seg.text.length > MAX_GROUP_CHARS;
      if (spanOver || charsOver) {
        push(cur);
        cur = null;
      }
    }
    if (!cur) {
      cur = { ...seg };
    } else {
      cur = {
        ...cur,
        endMs: seg.endMs ?? cur.endMs,
        text: `${cur.text} ${seg.text}`.trim(),
      };
    }
    if (cur && SENTENCE_END.test(cur.text)) {
      push(cur);
      cur = null;
    }
    open = cur;
  }
  if (open) push(open);
  return groups;
}

/** "seg_000123" per §7.1. */
export function segmentId(idx: number): string {
  return `seg_${String(idx).padStart(6, "0")}`;
}

/** Full merge pipeline: ordered chunk results → stored Segment[]. */
export function mergeChunks(chunks: ChunkSegments[]): Segment[] {
  return mergeSentenceGroups(dedupeOverlap(chunks));
}
