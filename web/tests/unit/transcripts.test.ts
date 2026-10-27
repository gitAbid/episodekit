import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detectFormat, parseTranscript } from "@/lib/transcripts";

const fixture = (name: string) =>
  readFileSync(join(process.cwd(), "tests/fixtures/transcripts", name), "utf8");

// U5 chip copy is exactly "<Label> · speakers and timestamps found" for
// Riverside; other formats derive their labels from the M2 format names.
describe("detectFormat", () => {
  it("labels Riverside with both speakers and timestamps", () => {
    const d = detectFormat(fixture("riverside.txt"));
    expect(d.format).toBe("riverside");
    expect(d.hasTimestamps).toBe(true);
    expect(d.hasSpeakers).toBe(true);
    expect(d.chip).toBe("Riverside · speakers and timestamps found");
  });

  it("labels bracket-timestamped speaker lines as Otter", () => {
    const d = detectFormat(fixture("otter.txt"));
    expect(d.format).toBe("otter");
    expect(d.hasTimestamps).toBe(true);
    expect(d.hasSpeakers).toBe(true);
    expect(d.chip).toBe("Otter · speakers and timestamps found");
  });

  it("labels speaker-only lines as Descript", () => {
    const d = detectFormat(fixture("descript.txt"));
    expect(d.format).toBe("descript");
    expect(d.hasTimestamps).toBe(false);
    expect(d.hasSpeakers).toBe(true);
    expect(d.chip).toBe("Descript · speakers found");
  });

  it("labels SRT with timestamps only", () => {
    const d = detectFormat(fixture("srt.txt"));
    expect(d.format).toBe("srt");
    expect(d.hasTimestamps).toBe(true);
    expect(d.hasSpeakers).toBe(false);
    expect(d.chip).toBe("SRT · timestamps found");
  });

  it("labels VTT with timestamps only", () => {
    const d = detectFormat(fixture("vtt.txt"));
    expect(d.format).toBe("vtt");
    expect(d.hasTimestamps).toBe(true);
    expect(d.hasSpeakers).toBe(false);
    expect(d.chip).toBe("VTT · timestamps found");
  });

  it("labels plain text without extras", () => {
    const d = detectFormat(fixture("plain.txt"));
    expect(d.format).toBe("plain");
    expect(d.hasTimestamps).toBe(false);
    expect(d.hasSpeakers).toBe(false);
    expect(d.chip).toBe("Plain text");
  });

  it("empty input is plain with nothing found", () => {
    expect(detectFormat("   \n  ")).toMatchObject({ format: "plain", hasTimestamps: false, hasSpeakers: false });
  });
});

describe("parseTranscript — SRT", () => {
  it("parses cues into timestamped segments sorted by start", () => {
    const r = parseTranscript(fixture("srt.txt"));
    expect(r.segments).toHaveLength(3);
    expect(r.segments[0]).toEqual({
      speaker: null,
      startMs: 0,
      endMs: 4120,
      text: "Welcome back to the show.",
    });
    expect(r.segments[2]).toMatchObject({ startMs: 41_000, text: "We budget our dollars, we calendar our hours." });
  });

  it("sorts unsorted timestamps by start (edge case)", () => {
    const r = parseTranscript(fixture("srt-unsorted.txt"));
    expect(r.segments.map((s) => s.startMs)).toEqual([0, 41_000]);
    expect(r.segments[0].text).toBe("Welcome back to the show.");
  });

  it("parses speaker-prefixed cue text", () => {
    const text = "1\n00:00:01,000 --> 00:00:02,000\nMaya: Hello there.\n";
    const r = parseTranscript(text);
    expect(r.hasSpeakers).toBe(true);
    expect(r.segments[0]).toMatchObject({ speaker: "Maya", text: "Hello there." });
  });

  it("parses speakerless cues (edge case)", () => {
    const r = parseTranscript(fixture("srt.txt"));
    expect(r.hasSpeakers).toBe(false);
    expect(r.segments.every((s) => s.speaker === null)).toBe(true);
  });
});

describe("parseTranscript — VTT", () => {
  it("parses cues, keeps cue identifiers as non-speakers", () => {
    const r = parseTranscript(fixture("vtt.txt"));
    expect(r.format).toBe("vtt");
    expect(r.segments).toHaveLength(3);
    expect(r.segments[0]).toEqual({
      speaker: null,
      startMs: 0,
      endMs: 4120,
      text: "Welcome back to the show.",
    });
    expect(r.segments[2]).toMatchObject({ startMs: 72_500, text: "Almost nobody manages it like money." });
  });

  it("handles NOTE blocks and cue settings", () => {
    const text = [
      "WEBVTT",
      "",
      "NOTE this is a comment",
      "",
      "00:00.000 --> 00:02.000 position:50% align:start",
      "Two minute cue.",
    ].join("\n");
    const r = parseTranscript(text);
    expect(r.segments).toHaveLength(1);
    expect(r.segments[0]).toMatchObject({ startMs: 0, endMs: 2000, text: "Two minute cue." });
  });
});

describe("parseTranscript — Riverside / Otter speaker-timestamped", () => {
  it("parses Name (00:12:03): text with speakers and ms timestamps", () => {
    const r = parseTranscript(fixture("riverside.txt"));
    expect(r.segments.map((s) => s.speaker)).toEqual(["Maya", "Dev", "Maya"]);
    expect(r.segments[0]).toMatchObject({ startMs: 0, text: "Welcome back to the show. Today we talk about focus." });
    expect(r.segments[1]).toMatchObject({ startMs: 12_000 });
    expect(r.segments[2]).toMatchObject({ startMs: 63_000 });
  });

  it("keeps continuation lines attached to the previous speaker segment", () => {
    const text = ["Maya (00:00:01): First line.", "continues here.", "Dev (00:02:00): Second."].join("\n");
    const r = parseTranscript(text);
    expect(r.segments).toHaveLength(2);
    expect(r.segments[0].text).toBe("First line. continues here.");
    expect(r.segments[0].speaker).toBe("Maya");
  });

  it("parses CRLF input (edge case)", () => {
    const r = parseTranscript(fixture("riverside-crlf.txt"));
    expect(r.format).toBe("riverside");
    expect(r.segments).toHaveLength(3);
    expect(r.segments[0]).toMatchObject({ speaker: "Maya", text: "Welcome back to the show." });
  });

  it("parses [00:12:03] Name: text (Otter shape) with minutes-only times", () => {
    const text = ["[0:05] Maya: short form.", "[12:03] Dev: long form."].join("\n");
    const r = parseTranscript(text);
    expect(r.format).toBe("otter");
    expect(r.segments[0]).toMatchObject({ speaker: "Maya", startMs: 5_000 });
    expect(r.segments[1]).toMatchObject({ speaker: "Dev", startMs: 723_000 });
  });

  it("parses a speakerless timestamped shape only when a name is present is NOT plain", () => {
    // A line like "(00:12:03) text" has no speaker; it stays plain text.
    const r = parseTranscript("(00:12:03) Just a parenthetical remark.\nAnother line.");
    expect(r.format).toBe("plain");
    expect(r.hasSpeakers).toBe(false);
  });
});

describe("parseTranscript — Descript / plain", () => {
  it("parses Speaker: text without timestamps, preserving order", () => {
    const r = parseTranscript(fixture("descript.txt"));
    expect(r.segments).toHaveLength(3);
    expect(r.segments.every((s) => s.startMs === null && s.endMs === null)).toBe(true);
    expect(r.segments[1]).toMatchObject({ speaker: "Dev" });
  });

  it("plain text becomes one segment per paragraph without speakers", () => {
    const r = parseTranscript(fixture("plain.txt"));
    expect(r.segments).toHaveLength(2);
    expect(r.segments[0].text).toContain("focus is the");
    expect(r.segments.every((s) => s.speaker === null && s.startMs === null)).toBe(true);
  });

  it("trims and drops empty paragraphs", () => {
    const r = parseTranscript("First.\n\n\n\nSecond.\n");
    expect(r.segments.map((s) => s.text)).toEqual(["First.", "Second."]);
  });

  it("empty input yields no segments", () => {
    expect(parseTranscript("  ").segments).toEqual([]);
  });
});

describe("parseTranscript — stored flags", () => {
  it("reports hasTimestamps/hasSpeakers used for episodes columns", () => {
    expect(parseTranscript(fixture("riverside.txt"))).toMatchObject({ hasTimestamps: true, hasSpeakers: true });
    expect(parseTranscript(fixture("srt.txt"))).toMatchObject({ hasTimestamps: true, hasSpeakers: false });
    expect(parseTranscript(fixture("descript.txt"))).toMatchObject({ hasTimestamps: false, hasSpeakers: true });
    expect(parseTranscript(fixture("plain.txt"))).toMatchObject({ hasTimestamps: false, hasSpeakers: false });
  });
});

describe("detection false positives (plain prose with colons)", () => {
  it("does not read prose like 'a second: …' as speaker labels", () => {
    const prose = [
      "Remember that the next time someone says it will only take",
      "a second: seconds are how attention debt is issued, and the interest rate is",
      "brutal.",
      "",
      "Every app that promises to organize your attention is also competing for",
      "scripts: I am offline until noon; send it and I will get there.",
    ].join("\n");
    const r = parseTranscript(prose);
    expect(r.format).toBe("plain");
    expect(r.hasSpeakers).toBe(false);
  });

  it("still accepts multi-word capitalized names and Speaker N labels", () => {
    const text = ["Dr Maya Patel: Welcome.", "Speaker 2: Thanks for having me."].join("\n");
    const r = parseTranscript(text);
    expect(r.format).toBe("descript");
    expect(r.segments.map((s) => s.speaker)).toEqual(["Dr Maya Patel", "Speaker 2"]);
  });
});
