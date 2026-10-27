// Ported from legacy engine/test.js (renderers excluded — engine/index.js
// renderers are not part of WP-03). Asserts the deterministic engine keeps its
// observable behaviour after the TypeScript port.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  generateSuiteDeterministic,
  normalizeWs,
  stripSpeakerLabels,
} from "@/lib/engine";
import { isReligionNeutral } from "@/lib/artifacts/postcheck";

const episode = readFileSync(
  new URL("../fixtures/demo-episode.txt", import.meta.url),
  "utf8",
);
const clean = normalizeWs(episode.split("\n---")[0]); // strip CC0 footer; whitespace-normalized source of truth
const suite = generateSuiteDeterministic(clean);

describe("suite shape", () => {
  it("titles: 5–6 candidates", () => {
    expect(suite.titles.length).toBeGreaterThanOrEqual(5);
    expect(suite.titles.length).toBeLessThanOrEqual(6);
  });

  it("summary exists", () => {
    expect(typeof suite.summary.text).toBe("string");
  });

  it("article has 3+ sections with headings", () => {
    expect(suite.article.sections.length).toBeGreaterThanOrEqual(3);
  });

  it("discussion kit has 4+ anchored questions", () => {
    expect(suite.discussion.qs.length).toBeGreaterThanOrEqual(4);
  });

  it("email series: exactly 5 days", () => {
    expect(suite.series).toHaveLength(5);
  });

  it("social: 2+ pull quotes", () => {
    expect(suite.social.pullQuotes.length).toBeGreaterThanOrEqual(2);
  });
});

describe("honesty: every quote is an exact sentence from the episode", () => {
  it("discussion quotes verbatim", () => {
    for (const q of suite.discussion.qs) expect(clean.includes(q.quote)).toBe(true);
  });

  it("series anchors verbatim", () => {
    for (const d of suite.series) expect(clean.includes(d.anchor)).toBe(true);
  });

  it("pull quotes verbatim", () => {
    for (const q of suite.social.pullQuotes) expect(clean.includes(q)).toBe(true);
  });
});

describe("no religious terminology anywhere in output", () => {
  it("output is religion-free", () => {
    expect(isReligionNeutral(JSON.stringify(suite))).toBe(true);
  });
});

describe("quality gates", () => {
  it("summary 100–180 words", () => {
    expect(suite.summary.wordCount).toBeGreaterThanOrEqual(100);
    expect(suite.summary.wordCount).toBeLessThanOrEqual(180);
  });

  it("X posts ≤ 280 chars", () => {
    for (const p of suite.social.xPosts) expect(p.text.length).toBeLessThanOrEqual(280);
  });

  it("pull quotes ≥ 60 chars", () => {
    for (const q of suite.social.pullQuotes) expect(q.length).toBeGreaterThanOrEqual(60);
  });

  it("article sections non-trivial", () => {
    for (const s of suite.article.sections) {
      expect(s.paragraphs.length).toBeGreaterThanOrEqual(1);
      expect(s.paragraphs.join(" ").length).toBeGreaterThan(50);
    }
  });

  it("themes are real episode words", () => {
    const themeHits = suite.stats.themes.filter((t) => clean.toLowerCase().includes(t));
    expect(themeHits.length).toBeGreaterThanOrEqual(4);
  });
});

describe("summary is extractive", () => {
  it("summary sentences verbatim from source", () => {
    const sumSentences = suite.summary.text.split(/(?<=[.!?])\s+/);
    for (const s of sumSentences) expect(clean.includes(s.trim())).toBe(true);
  });
});

describe("speaker-labeled transcripts (real ASR shape)", () => {
  const labeled =
    "Speaker 1: Welcome back to the show. Today we are talking about deep work and why focus is the most expensive resource in modern work. Host: Nobody budgets attention like money, and that is the whole problem we unpack today. Speaker 2: I think the calendar is the real fix because a to-do item is a wish while a calendar block is a promise. Speaker 1: Remember the research on task switching, because one notification can cost you twenty minutes of real depth. Host: So subtraction beats addition, and the professional with three tools out-ships the one with thirty.";
  const labeledClean = normalizeWs(stripSpeakerLabels(labeled));
  const labeledSuite = generateSuiteDeterministic(labeled);

  it("'speaker' not a theme", () => {
    expect(labeledSuite.stats.themes.includes("speaker")).toBe(false);
  });

  it("labeled-transcript quotes verbatim vs label-free source", () => {
    for (const q of labeledSuite.discussion.qs) {
      expect(labeledClean.includes(q.quote)).toBe(true);
    }
  });

  it("real themes surface", () => {
    expect(
      labeledSuite.stats.themes.includes("calendar") ||
        labeledSuite.stats.themes.includes("attention"),
    ).toBe(true);
  });
});

describe("degenerate inputs", () => {
  it("repeated sentences deduped (no duplicate quotes)", () => {
    const rep = Array(40)
      .fill("This one sentence repeats over and over again because repetition is the test.")
      .join(" ");
    const repSuite = generateSuiteDeterministic(rep);
    const quotes = repSuite.discussion.qs.map((q) => q.quote);
    expect(new Set(quotes).size).toBe(quotes.length);
  });
});

describe("lowercase ASR transcripts", () => {
  const lower =
    "welcome back to the show everybody. today we are talking about deep work and why focus is the most expensive resource in modern work. nobody budgets attention like money and that is the whole problem. a calendar block is a promise while a to-do item is a wish. one notification can tax the entire morning because attention compounds like debt.";
  const lowerSuite = generateSuiteDeterministic(lower);

  it("lowercase transcript still yields full artifacts", () => {
    expect(lowerSuite.discussion.qs.length).toBeGreaterThanOrEqual(4);
  });

  it("lowercase transcript segments into sections", () => {
    expect(lowerSuite.article.sections.length).toBeGreaterThanOrEqual(3);
  });
});

describe("determinism", () => {
  it("same input, same output (ignoring generatedAt)", () => {
    const now = new Date("2026-10-27T00:00:00Z");
    const s1 = generateSuiteDeterministic(clean, { now });
    const s2 = generateSuiteDeterministic(clean, { now });
    expect(s1).toEqual(s2);
    expect(s1.generatedAt).toBe(now.toISOString());
  });
});
