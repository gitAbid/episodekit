import { describe, expect, it } from "vitest";
import { fakeTranscribe } from "@/lib/asr/fake";

describe("fakeTranscribe (in-memory adapter for tests)", () => {
  it("returns deterministic segments with absolute timestamps", () => {
    const segments = fakeTranscribe([
      { blobPath: "a.webm", offsetMs: 0 },
      { blobPath: "b.webm", offsetMs: 598_000 },
    ]);
    expect(segments.map((s) => s.text)).toEqual([
      "Chunk 1 transcript line.",
      "Chunk 2 transcript line.",
    ]);
    expect(segments[1].startMs).toBe(598_500);
    expect(segments.map((s) => s.id)).toEqual(["seg_000000", "seg_000001"]);
  });

  it("accepts a scripted line list per chunk", () => {
    const segments = fakeTranscribe([{ blobPath: "a.webm", offsetMs: 0 }], {
      linesPerChunk: [["One.", "Two.", "Three."]],
    });
    expect(segments.map((s) => s.text)).toEqual(["One.", "Two.", "Three."]);
  });

  it("returns empty for no chunks", () => {
    expect(fakeTranscribe([])).toEqual([]);
  });
});
