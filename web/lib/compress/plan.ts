/**
 * Pure decision functions for browser compression (M2, ported from
 * site/app.html): decode the file, resample to mono 16 kHz (OfflineAudioContext),
 * re-encode Opus at ~24 kbps, and split into ≤10-min chunks with a 2 s overlap
 * so the server can dedupe by timestamp (§8.3). The AudioContext/MediaRecorder
 * graph lives in lib/compress/browser.ts (client only); everything decided
 * here is unit-testable in Node.
 */

export const SAMPLE_RATE = 16_000;
/** ~24 kbps per M2 → ~1.8 MB per 10-min chunk (well under the 25 MB ASR limit). */
export const BITRATE_BPS = 24_000;
export const CHUNK_SEC = 600;
export const OVERLAP_SEC = 2;
/** mp3/m4a/wav/aac/ogg/webm/mp4/mov · up to 2 hours (M2). */
export const MAX_DURATION_SEC = 2 * 3600;

export interface PlannedChunk {
  index: number;
  /** Absolute start in the source audio (seconds). */
  startSec: number;
  /** Absolute end in the source audio (seconds). */
  endSec: number;
  /** Absolute start in ms — the offset passed to the ASR merge. */
  offsetMs: number;
  /** Chunks after the first include the previous 2 s as an overlap prefix. */
  hasOverlapPrefix: boolean;
}

/**
 * Split [0, durationSec] into ≤CHUNK_SEC chunks. Chunk N starts at
 * N * (CHUNK_SEC - OVERLAP_SEC) so consecutive chunks share a 2 s seam.
 */
export function planChunks(durationSec: number): PlannedChunk[] {
  const step = CHUNK_SEC - OVERLAP_SEC;
  const chunks: PlannedChunk[] = [];
  for (let startSec = 0; startSec < durationSec; startSec += step) {
    const endSec = Math.min(startSec + CHUNK_SEC, durationSec);
    chunks.push({
      index: chunks.length,
      startSec,
      endSec,
      offsetMs: Math.round(startSec * 1000),
      hasOverlapPrefix: startSec > 0,
    });
  }
  // Absorb a tiny trailing chunk (≤ OVERLAP_SEC of new audio) into the
  // previous chunk — a 2 s upload + ASR call is pure waste. The previous
  // chunk then ends at durationSec (≤ CHUNK_SEC + OVERLAP_SEC, still tiny).
  if (chunks.length > 1) {
    const last = chunks[chunks.length - 1];
    const prev = chunks[chunks.length - 2];
    if (last.endSec - prev.endSec <= OVERLAP_SEC) {
      prev.endSec = durationSec;
      chunks.pop();
    }
  }
  return chunks;
}

/** Wire size estimate for one chunk: bytes = seconds * bitsPerSecond / 8. */
export function estimateChunkBytes(seconds: number, bitrateBps = BITRATE_BPS): number {
  return (seconds * bitrateBps) / 8;
}

export interface MimeChoice {
  mimeType: string;
  /** Container without codecs parameter — used for the Blob type + upload. */
  container: string;
  extension: string;
}

/**
 * Encoder choice, ported from site/app.html: prefer WebM/Opus, fall back to
 * MP4 (Safari's MediaRecorder), otherwise give up cleanly (the paste tab
 * still works).
 */
export function chooseMimeType(isTypeSupported: (type: string) => boolean): MimeChoice | null {
  if (isTypeSupported("audio/webm;codecs=opus")) {
    return { mimeType: "audio/webm;codecs=opus", container: "audio/webm", extension: "webm" };
  }
  if (isTypeSupported("audio/mp4")) {
    return { mimeType: "audio/mp4", container: "audio/mp4", extension: "mp4" };
  }
  return null;
}
