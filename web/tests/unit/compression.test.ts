import { describe, expect, it } from "vitest";
import {
  BITRATE_BPS,
  CHUNK_SEC,
  MAX_DURATION_SEC,
  OVERLAP_SEC,
  SAMPLE_RATE,
  chooseMimeType,
  estimateChunkBytes,
  planChunks,
} from "@/lib/compress/plan";

// Pure decision functions ported from site/app.html (decode → resample 16 kHz
// mono → Opus re-encode → ≤10-min chunks with 2 s overlap).
describe("compression plan (ported from site/app.html)", () => {
  it("keeps the ported constants", () => {
    expect(SAMPLE_RATE).toBe(16_000);
    expect(BITRATE_BPS).toBe(24_000); // ~24 kbps → ~1.8 MB per 10-min chunk
    expect(CHUNK_SEC).toBe(600);
    expect(OVERLAP_SEC).toBe(2);
    expect(MAX_DURATION_SEC).toBe(2 * 3600); // ≤2 h for MVP
  });

  it("plans one chunk for a short episode", () => {
    const chunks = planChunks(300);
    expect(chunks).toEqual([{ index: 0, startSec: 0, endSec: 300, offsetMs: 0, hasOverlapPrefix: false }]);
  });

  it("plans ≤10-min chunks with a 2 s overlap prefix", () => {
    const chunks = planChunks(1200); // 20 min
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({ startSec: 0, endSec: 600, offsetMs: 0 });
    expect(chunks[1]).toMatchObject({ startSec: 598, endSec: 1200, offsetMs: 598_000, hasOverlapPrefix: true });
    // Absorbing the 2 s trailing stub may extend a chunk by ≤ OVERLAP_SEC.
    expect(chunks[1].endSec - chunks[1].startSec).toBeLessThanOrEqual(CHUNK_SEC + OVERLAP_SEC);
  });

  it("plans the last chunk without exceeding the duration", () => {
    const chunks = planChunks(1300);
    expect(chunks.at(-1)).toMatchObject({ startSec: 1196, endSec: 1300 });
    expect(planChunks(1200.4)).toHaveLength(3);
  });

  it("estimates ~1.8 MB for a 10-minute chunk at 24 kbps", () => {
    const bytes = estimateChunkBytes(CHUNK_SEC);
    expect(bytes).toBe((600 * 24_000) / 8);
    expect(bytes / 1e6).toBeCloseTo(1.8, 1);
  });

  it("prefers webm/opus, falls back to mp4, else null", () => {
    expect(chooseMimeType((t) => t === "audio/webm;codecs=opus")).toEqual({
      mimeType: "audio/webm;codecs=opus",
      extension: "webm",
      container: "audio/webm",
    });
    expect(chooseMimeType((t) => t === "audio/mp4")).toEqual({
      mimeType: "audio/mp4",
      extension: "mp4",
      container: "audio/mp4",
    });
    expect(chooseMimeType(() => false)).toBeNull();
  });
});
