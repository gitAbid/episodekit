// Ported quote tests from legacy engine/test.js (validator + punctuation
// tolerance + speaker-label honesty) plus tests for the §7.3 quote-by-reference
// API: normalize → find in segment (+next 2) → store offsets → trim 40–240.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeWs, sentences, stripSpeakerLabels } from "@/lib/engine";
import {
  isExactQuote,
  normalizeQuoteStyle,
} from "@/lib/quotes/normalize";
import {
  findExactInSegments,
  quoteText,
} from "@/lib/quotes/matching";
import { resolveQuoteRef, resolveQuotes } from "@/lib/quotes/resolve";
import { candidateQuoteRefs } from "@/lib/quotes/candidates";
import { QUOTE_MAX, QUOTE_MIN, trimQuoteSpan } from "@/lib/quotes/trim";
import { formatTranscriptLine, formatTranscriptLines } from "@/lib/quotes/format";
import type { ModelQuote, QuoteRef, Segment } from "@/lib/quotes/types";

const episode = readFileSync(
  new URL("../fixtures/demo-episode.txt", import.meta.url),
  "utf8",
);
const clean = normalizeWs(episode.split("\n---")[0]);

function makeSegments(text: string, perSegment = 2): Segment[] {
  const sents = sentences(normalizeWs(stripSpeakerLabels(text)));
  const segments: Segment[] = [];
  for (let i = 0; i < sents.length; i += perSegment) {
    const idx = segments.length;
    segments.push({
      id: `seg_${String(idx).padStart(6, "0")}`,
      idx,
      speaker: idx % 2 === 0 ? "Maya" : null,
      startMs: idx * 60_000,
      endMs: (idx + 1) * 60_000,
      text: sents.slice(i, i + perSegment).join(" "),
    });
  }
  return segments;
}

const segments = makeSegments(clean);
const fullSegmentText = segments.map((s) => s.text).join(" ");

describe("normalizeQuoteStyle (ported from engine/glm.js)", () => {
  it("typographic quotes become straight", () => {
    expect(normalizeQuoteStyle("\u201Chi\u201D \u201Eh\u201F \u2018a\u2019 \u201Ab\u201B")).toBe(
      '"hi" "h" \'a\' \'b\'',
    );
  });

  it("em dash → --, en dash → -, ellipsis → ..., nbsp → space", () => {
    expect(normalizeQuoteStyle("a\u2014b c\u2013d e\u2026f g\u00A0h")).toBe("a--b c-d e...f g h");
  });

  it("strips edge ellipses (truncation markers) but keeps interior ones", () => {
    expect(normalizeQuoteStyle("…hello world")).toBe("hello world");
    expect(normalizeQuoteStyle("...hello world")).toBe("hello world");
    expect(normalizeQuoteStyle("hello world...")).toBe("hello world");
    expect(normalizeQuoteStyle("hello … world")).toBe("hello ... world");
    // Legacy edge case, preserved verbatim: a space AFTER the trailing dots
    // blocks the strip regex (callers normalizeWs/trim first, so this never
    // reaches matching — normalizeForMatch strips those edges).
    expect(normalizeQuoteStyle("hello world … ")).toBe("hello world ... ");
  });
});

describe("isExactQuote (legacy validator semantics)", () => {
  const q0 = sentences(clean)[0];

  it("verbatim accepted", () => {
    expect(isExactQuote(q0, clean)).toBe(true);
  });

  it("curly-quoted / ellipsized verbatim quotes accepted (no silent fallback)", () => {
    const styled = q0
      .replace(/"/g, "\u201C")
      .replace(/'/g, "\u2019")
      .replace(/ - /g, " \u2014 ");
    expect(isExactQuote(styled, clean)).toBe(true);
    expect(isExactQuote(q0.slice(0, -1) + "\u2026", clean)).toBe(true);
  });

  it("punctuation-normalized but paraphrased quote still rejected", () => {
    const paraphrased = q0.replace(/\bthe\b/g, "a").replace(/\bis\b/g, "was");
    expect(isExactQuote(paraphrased, clean)).toBe(false);
  });

  it("invented quotes rejected", () => {
    expect(isExactQuote("This quote was never in the episode, it is invented.", clean)).toBe(false);
  });

  it("short or non-string input rejected → caller falls back", () => {
    expect(isExactQuote("too short", clean)).toBe(false);
    expect(isExactQuote(null, clean)).toBe(false);
    expect(isExactQuote(undefined, clean)).toBe(false);
    expect(isExactQuote(42 as unknown, clean)).toBe(false);
  });
});

describe("resolveQuoteRef: model text is never displayed — offsets are", () => {
  it("resolves a styled model quote to verbatim source offsets", () => {
    const seg = segments[1];
    const source = sentences(seg.text)[0];
    const styled: ModelQuote = {
      segmentId: seg.id,
      exact: "\u201C" + source.replace(/'/g, "\u2019") + "\u2026\u201D",
    };
    const ref = resolveQuoteRef(styled, segments);
    expect(ref).not.toBeNull();
    const ref2 = ref as QuoteRef;
    expect(ref2.segmentId).toBe(seg.id);
    expect(seg.text.slice(ref2.start, ref2.end)).toBe(source); // verbatim, not the styled text
    expect(quoteText(ref2, segments)).toBe(source);
  });

  it("paraphrased model text is dropped, never emitted", () => {
    const seg = segments[0];
    const source = sentences(seg.text)[0];
    const paraphrased = source.replace(/\bthe\b/g, "a").replace(/\bis\b/g, "was");
    expect(resolveQuoteRef({ segmentId: seg.id, exact: paraphrased }, segments)).toBeNull();
  });

  it("unknown segment id → dropped", () => {
    const source = sentences(segments[0].text)[0];
    expect(resolveQuoteRef({ segmentId: "seg_999999", exact: source }, segments)).toBeNull();
  });

  it("malformed input → dropped", () => {
    expect(resolveQuoteRef({ segmentId: segments[0].id, exact: "" }, segments)).toBeNull();
    expect(resolveQuoteRef(null as unknown as ModelQuote, segments)).toBeNull();
  });

  it("quotes shorter than the 40-char floor are dropped", () => {
    const seg = segments[0];
    const short = seg.text.slice(0, 30);
    expect(trimQuoteSpan(short)).toBeNull();
    expect(resolveQuoteRef({ segmentId: seg.id, exact: short }, segments)).toBeNull();
  });

  it("spans into the next segment get endSegmentId and reconstruct exactly", () => {
    const a = segments[0];
    const b = segments[1];
    const lastOfA = sentences(a.text).at(-1) as string;
    const firstOfB = sentences(b.text)[0];
    const spanned = `${lastOfA} ${firstOfB}`;
    const ref = resolveQuoteRef({ segmentId: a.id, exact: spanned }, segments);
    expect(ref).not.toBeNull();
    const ref2 = ref as QuoteRef;
    expect(ref2.segmentId).toBe(a.id);
    expect(ref2.endSegmentId).toBe(b.id);
    // The 40–240 trim may shorten the span; whatever is emitted is a verbatim
    // prefix of it, reconstructed purely from offsets.
    const text = quoteText(ref2, segments);
    expect(text.length).toBeGreaterThanOrEqual(QUOTE_MIN);
    expect(text.length).toBeLessThanOrEqual(QUOTE_MAX);
    expect(spanned.startsWith(text)).toBe(true);
    expect(fullSegmentText.includes(text)).toBe(true);
  });

  it("search window is the segment plus the next two", () => {
    // A quote living two segments ahead of the claimed one is still found.
    const claimed = segments[0];
    const far = segments[2];
    const source = sentences(far.text)[0];
    const ref = resolveQuoteRef({ segmentId: claimed.id, exact: source }, segments);
    expect(ref).not.toBeNull();
    expect((ref as QuoteRef).segmentId).toBe(far.id);
  });
});

describe("trim rule: 40–240 chars at word/sentence boundaries", () => {
  it("keeps quotes already within limits", () => {
    const okText = "a".repeat(QUOTE_MIN);
    expect(trimQuoteSpan(okText)).toEqual([0, QUOTE_MIN]);
    expect(trimQuoteSpan("b".repeat(QUOTE_MAX))).toEqual([0, QUOTE_MAX]);
  });

  it("cuts long quotes at the last sentence boundary within the cap", () => {
    const s1 = `${"a".repeat(80)}. `;
    const s2 = `${"b".repeat(80)}. `;
    const s3 = `${"c".repeat(80)}.`;
    const text = s1 + s2 + s3;
    const span = trimQuoteSpan(text) as [number, number];
    const cut = text.slice(...span);
    expect(cut).toBe((s1 + s2).trim());
    expect(cut.length).toBeLessThanOrEqual(QUOTE_MAX);
    expect(cut.length).toBeGreaterThanOrEqual(QUOTE_MIN);
  });

  it("falls back to a word boundary when no sentence end fits", () => {
    const text = `${"word ".repeat(80)}end`;
    const span = trimQuoteSpan(text) as [number, number];
    const cut = text.slice(...span);
    expect(cut.length).toBeLessThanOrEqual(QUOTE_MAX);
    expect(cut.endsWith("word")).toBe(true); // never splits a word
  });

  it("emitted quotes stay inside 40–240 and remain a prefix of the source", () => {
    const long = sentences(clean).join(" ");
    const span = trimQuoteSpan(long) as [number, number];
    const cut = long.slice(span[0], span[1]);
    expect(cut.length).toBeGreaterThanOrEqual(QUOTE_MIN);
    expect(cut.length).toBeLessThanOrEqual(QUOTE_MAX);
    expect(long.slice(span[0]).startsWith(cut)).toBe(true);
  });
});

describe("resolveQuotes: drop, dedupe, fill from deterministic candidates", () => {
  const candidates = candidateQuoteRefs(segments);

  it("candidates are verbatim, episode-ordered, 40–240, deterministic", () => {
    expect(candidates.length).toBeGreaterThan(0);
    let prev: QuoteRef | null = null;
    for (const ref of candidates) {
      const seg = segments.find((s) => s.id === ref.segmentId) as Segment;
      const text = seg.text.slice(ref.start, ref.end);
      expect(text.length).toBeGreaterThanOrEqual(QUOTE_MIN);
      expect(text.length).toBeLessThanOrEqual(QUOTE_MAX);
      expect(seg.text.includes(text)).toBe(true);
      if (prev) {
        const prevSeg = segments.find((s) => s.id === prev?.segmentId) as Segment;
        if (prevSeg.idx === seg.idx) {
          expect(ref.start).toBeGreaterThan(prev.start);
        } else {
          expect(seg.idx).toBeGreaterThan(prevSeg.idx);
        }
      }
      prev = ref;
    }
    expect(candidateQuoteRefs(segments)).toEqual(candidates);
  });

  it("fills to the target count from candidates when the model invents quotes", () => {
    const invented: ModelQuote[] = [
      { segmentId: segments[0].id, exact: "Totally invented words that were never spoken aloud here." },
      { segmentId: "seg_424242", exact: "Also invented, and attached to a phantom segment id." },
    ];
    const { quotes, filled } = resolveQuotes(invented, segments, { count: 5, candidates });
    expect(quotes).toHaveLength(5);
    expect(filled).toBe(5);
    for (const ref of quotes) {
      expect(fullSegmentText.includes(quoteText(ref, segments))).toBe(true);
    }
  });

  it("null model → all candidates (deterministic fallback)", () => {
    const { quotes, filled, dropped } = resolveQuotes(null, segments, { count: 5, candidates });
    expect(quotes).toHaveLength(5);
    expect(filled).toBe(5);
    expect(dropped).toBe(0);
  });

  it("dedupes repeated model quotes", () => {
    const seg = segments[0];
    const source = sentences(seg.text)[0];
    const { quotes } = resolveQuotes(
      [
        { segmentId: seg.id, exact: source },
        { segmentId: seg.id, exact: source },
      ],
      segments,
      { count: 5, candidates },
    );
    const texts = quotes.map((r) => quoteText(r, segments));
    expect(new Set(texts).size).toBe(texts.length);
  });
});

describe("speaker-labeled transcripts: quotes verbatim vs label-free source", () => {
  const labeled =
    "Speaker 1: Welcome back to the show. Today we are talking about deep work and why focus is the most expensive resource in modern work. Host: Nobody budgets attention like money, and that is the whole problem we unpack today. Speaker 2: I think the calendar is the real fix because a to-do item is a wish while a calendar block is a promise. Speaker 1: Remember the research on task switching, because one notification can cost you twenty minutes of real depth. Host: So subtraction beats addition, and the professional with three tools out-ships the one with thirty.";
  const labeledClean = normalizeWs(stripSpeakerLabels(labeled));
  const labeledSegments = makeSegments(labeled);

  it("resolved quotes are verbatim relative to the label-free source", () => {
    const refs = candidateQuoteRefs(labeledSegments);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(labeledClean.includes(quoteText(ref, labeledSegments))).toBe(true);
    }
  });

  it("model quotes claiming a labeled segment resolve to label-free text", () => {
    const seg = labeledSegments[0];
    const source = sentences(seg.text)[0];
    const ref = resolveQuoteRef({ segmentId: seg.id, exact: source }, labeledSegments);
    expect(ref).not.toBeNull();
    expect(labeledClean.includes(quoteText(ref as QuoteRef, labeledSegments))).toBe(true);
  });
});

describe("findExactInSegments (normalized search with offset mapping)", () => {
  it("maps whitespace variance and a dropped final period back to source offsets", () => {
    const seg = segments[0];
    const source = sentences(seg.text)[0];
    const messy = source.replace(/\.$/, "").replace(/ /g, "  ");
    const span = findExactInSegments(messy, segments, 0);
    expect(span).not.toBeNull();
    expect(quoteText(span as QuoteRef, segments)).toBe(source.replace(/\.$/, ""));
  });
});

describe("numbered transcript lines (§7.3 step 1)", () => {
  it("formats id|speaker|mm:ss per segment", () => {
    const seg: Segment = {
      id: "seg_000123",
      idx: 3,
      speaker: "Maya",
      startMs: 72_500,
      endMs: null,
      text: "Hello there.",
    };
    expect(formatTranscriptLine(seg)).toBe("[seg_000123|Maya|01:12] Hello there.");
  });

  it("omits missing speaker and timestamp without inventing either", () => {
    const seg: Segment = {
      id: "seg_000124",
      idx: 4,
      speaker: null,
      startMs: null,
      endMs: null,
      text: "Hello again.",
    };
    expect(formatTranscriptLine(seg)).toBe("[seg_000124||] Hello again.");
    expect(formatTranscriptLines([seg])).toBe("[seg_000124||] Hello again.");
  });
});
