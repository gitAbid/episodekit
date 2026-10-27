/**
 * Chunk manifest stored in episodes.audio_blob_path (§7.1 has a single text
 * column; the browser-produced ≤10-min chunks + their offsets are serialized
 * as JSON — logged in DECISIONS.md). A plain single path string is still
 * readable as one chunk at 0 ms.
 */
export interface StoredChunk {
  path: string;
  offsetMs: number;
}

export function serializeChunkManifest(chunks: StoredChunk[]): string {
  return JSON.stringify(chunks);
}

export function parseChunkManifest(value: string | null | undefined): StoredChunk[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return fallback(value);
    const chunks = parsed.filter(
      (c): c is StoredChunk =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as StoredChunk).path === "string" &&
        typeof (c as StoredChunk).offsetMs === "number",
    );
    return chunks.length ? chunks : fallback(value);
  } catch {
    return fallback(value);
  }
}

function fallback(value: string): StoredChunk[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  return [{ path: trimmed, offsetMs: 0 }];
}

/** The chunk containing time `tMs` (the last one starting at or before it). */
export function chunkContaining(chunks: StoredChunk[], tMs: number): StoredChunk | null {
  if (!chunks.length) return null;
  let found = chunks[0];
  for (const chunk of chunks) {
    if (chunk.offsetMs <= tMs) found = chunk;
  }
  return found;
}
