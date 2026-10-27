import { describe, expect, it } from "vitest";
import { mergeChunks, mergeSentenceGroups, OVERLAP_MS } from "@/lib/asr/merge";

interface Raw {
  start: number; // seconds, chunk-relative
  end: number;
  text: string;
}

const chunk = (offsetMs: number, segments: Raw[]) => ({ offsetMs, segments });

const sec = (s: number) => s * 1000;

describe("mergeChunks — overlap dedupe by timestamp", () => {
  it("offsets chunk-relative times to absolute ms", () => {
    const merged = mergeChunks([
      chunk(0, [{ start: 0, end: 4.1, text: "Hello" }]),
      chunk(sec(598), [{ start: 2.5, end: 6, text: "World" }]),
    ]);
    expect(merged.map((s) => [s.startMs, s.endMs])).toEqual([
      [0, 4100],
      [sec(600.5), sec(604)],
    ]);
  });

  it("drops later-chunk segments inside the 2 s overlap window", () => {
    // Chunk 2 starts at 598 s; its first 2 s duplicate chunk 1's tail.
    const merged = mergeChunks([
      chunk(0, [
        { start: 596, end: 600, text: "tail of chunk one." },
      ]),
      chunk(sec(598), [
        { start: 0.5, end: 1.9, text: "tail of chunk one." }, // duplicate in overlap
        { start: 2.4, end: 5, text: "fresh content." },
      ]),
    ]);
    expect(merged.map((s) => s.text)).toEqual(["tail of chunk one.", "fresh content."]);
    expect(merged.every((s) => !s.text.includes("duplicate") || s.text === "tail of chunk one")).toBe(true);
  });

  it("keeps overlap-window segments when the previous chunk has no coverage there", () => {
    // Previous chunk's transcription ended early (no segment near the seam):
    // dropping would lose words, so the overlap segment survives.
    const merged = mergeChunks([
      chunk(0, [{ start: 0, end: 500, text: "early." }]),
      chunk(sec(598), [{ start: 0.5, end: 1.9, text: "seam words." }, { start: 3, end: 6, text: "next." }]),
    ]);
    expect(merged.map((s) => s.text)).toEqual(["early.", "seam words.", "next."]);
  });

  it("exposes the 2 s overlap constant", () => {
    expect(OVERLAP_MS).toBe(2000);
  });
});

describe("mergeSentenceGroups — ≤45 s / ≤500 chars", () => {
  const seg = (startMs: number, endMs: number, text: string) => ({
    id: `seg_${String(startMs).padStart(6, "0")}`,
    idx: 0,
    speaker: null,
    startMs,
    endMs,
    text,
  });

  it("groups segments up to sentence-ending punctuation", () => {
    const groups = mergeSentenceGroups([
      seg(0, 1000, "Hello there,"),
      seg(1000, 2000, "welcome back."),
      seg(2000, 3000, "New thought starts"),
    ]);
    expect(groups.map((g) => g.text)).toEqual(["Hello there, welcome back.", "New thought starts"]);
  });

  it("flushes a group before exceeding 45 s of span", () => {
    const groups = mergeSentenceGroups([
      seg(0, 20_000, "A sentence without an end"),
      seg(20_000, 44_000, "still going"),
      seg(44_000, 50_000, "this one pushes past the limit."),
    ]);
    // Adding the third would make the span 50 s > 45 s, so it flushes first.
    expect(groups.map((g) => g.text)).toEqual([
      "A sentence without an end still going",
      "this one pushes past the limit.",
    ]);
  });

  it("flushes a group before exceeding 500 chars", () => {
    const long = "word ".repeat(120).trim(); // 600 chars, no sentence end
    const groups = mergeSentenceGroups([seg(0, 1000, long), seg(1000, 2000, "tail")]);
    expect(groups).toHaveLength(2);
    expect(groups[0].text).toBe(long);
    expect(groups[1].text).toBe("tail");
  });

  it("flushes a group when adding the next segment alone crosses 500 chars", () => {
    const long = "w".repeat(499);
    const groups = mergeSentenceGroups([seg(0, 1000, long), seg(1000, 2000, "plus one more")]);
    expect(groups).toHaveLength(2);
  });

  it("renumbers ids and idx sequentially", () => {
    const groups = mergeSentenceGroups([
      seg(0, 1000, "One."),
      seg(1000, 2000, "Two."),
      seg(2000, 3000, "Three."),
    ]);
    expect(groups.map((g) => g.id)).toEqual(["seg_000000", "seg_000001", "seg_000002"]);
    expect(groups.map((g) => g.idx)).toEqual([0, 1, 2]);
  });

  it("keeps null timestamps (paste path) grouped by sentence only", () => {
    const groups = mergeSentenceGroups([
      { id: "seg_0", idx: 0, speaker: null, startMs: null, endMs: null, text: "One." },
      { id: "seg_1", idx: 1, speaker: null, startMs: null, endMs: null, text: "Two." },
    ]);
    // No timestamps → span checks skip; sentence ends flush each.
    expect(groups.map((g) => g.text)).toEqual(["One.", "Two."]);
  });

  it("preserves the speaker of the first segment in a group", () => {
    const groups = mergeSentenceGroups([
      { id: "seg_0", idx: 0, speaker: "Maya", startMs: null, endMs: null, text: "One," },
      { id: "seg_1", idx: 1, speaker: "Dev", startMs: null, endMs: null, text: "two." },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].speaker).toBe("Maya");
    expect(groups[0].text).toBe("One, two.");
  });
});
