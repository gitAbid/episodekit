// Property test (§7.3): 1,000 mutated model quotes — curly quotes, truncation,
// paraphrase — must NEVER cause a non-substring of the transcript to be emitted.
// Seeded deterministic PRNG instead of fast-check: zero extra dependencies and
// reproducible failures. Logged in DECISIONS.md.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeWs, sentences, stripSpeakerLabels } from "@/lib/engine";
import { isVerbatim } from "@/lib/quotes/matching";
import { quoteText } from "@/lib/quotes/matching";
import { resolveQuotes } from "@/lib/quotes/resolve";
import { candidateQuoteRefs } from "@/lib/quotes/candidates";
import { QUOTE_MAX, QUOTE_MIN } from "@/lib/quotes/trim";
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
const transcript = segments.map((s) => s.text).join("\n");
const candidates = candidateQuoteRefs(segments);

// Deterministic LCG (Numerical Recipes constants).
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Cosmetic-only mutations: still verbatim after normalization. */
function mutateCosmetic(q: string, r: () => number): string {
  let out = q;
  if (r() < 0.7) out = out.replace(/"/g, "\u201D").replace(/'/g, "\u2019");
  if (r() < 0.3) {
    const dashed = out.replace(/ - /g, " \u2014 ");
    if (isVerbatim(dashed, transcript)) out = dashed; // em-dash doubles in length; keep only if still verbatim
  }
  if (r() < 0.4) out = "\u2026" + out;
  if (r() < 0.4) out = out + "\u2026";
  if (r() < 0.3) out = `\u201C${out}\u201D`;
  if (r() < 0.3) out = out.replace(/ /g, "\u00A0");
  if (r() < 0.3) out = out.replace(/ /g, "  ");
  if (r() < 0.2) out = out.toUpperCase();
  return out;
}

/** Truncation: cut mid-quote, optionally mark with an ellipsis. */
function mutateTruncated(q: string, r: () => number): string {
  const minCut = Math.max(1, Math.floor(q.length * 0.3));
  const cut = minCut + Math.floor(r() * Math.max(1, q.length - minCut - 1));
  const prefix = q.slice(0, cut);
  return r() < 0.6 ? prefix + (r() < 0.5 ? "\u2026" : "...") : prefix;
}

/** Paraphrase: word-level edits that break verbatim matching. */
function mutateParaphrase(q: string, r: () => number): string {
  const swaps: [RegExp, string][] = [
    [/\bthe\b/g, "a"],
    [/\bis\b/g, "was"],
    [/\band\b/g, "plus"],
    [/\bto\b/g, "toward"],
    [/\bit\b/g, "that"],
  ];
  let out = q;
  const nSwaps = 1 + Math.floor(r() * 2);
  for (let i = 0; i < nSwaps; i++) {
    const [re, rep] = swaps[Math.floor(r() * swaps.length)];
    if (re.test(out)) out = out.replace(re, rep);
  }
  if (r() < 0.5) {
    // drop a random interior word
    const ws = out.split(" ");
    if (ws.length > 4) {
      const i = 1 + Math.floor(r() * (ws.length - 2));
      out = ws.filter((_, j) => j !== i).join(" ");
    }
  }
  if (r() < 0.4) {
    // insert an invented word
    const ws = out.split(" ");
    const i = 1 + Math.floor(r() * (ws.length - 1));
    ws.splice(i, 0, "basically");
    out = ws.join(" ");
  }
  return out;
}

/** THE invariant: every emitted quote is an exact substring of the transcript. */
function everyQuoteIsSubstring(refs: QuoteRef[]): void {
  for (const ref of refs) {
    const segIdx = segments.findIndex((s) => s.id === ref.segmentId);
    expect(segIdx).toBeGreaterThanOrEqual(0);
    const endIdx = ref.endSegmentId
      ? segments.findIndex((s) => s.id === ref.endSegmentId)
      : segIdx;
    expect(endIdx).toBeGreaterThanOrEqual(segIdx);
    expect(endIdx - segIdx).toBeLessThanOrEqual(2); // span ≤3 segments
    const spanText = segments
      .slice(segIdx, endIdx + 1)
      .map((s) => s.text)
      .join(" ");
    const text = quoteText(ref, segments);
    expect(text.length).toBeGreaterThan(0);
    expect(spanText.includes(text)).toBe(true);
    expect(transcript.includes(text)).toBe(true);
    expect(text.length).toBeGreaterThanOrEqual(QUOTE_MIN);
    expect(text.length).toBeLessThanOrEqual(QUOTE_MAX);
  }
}

describe("property: 1,000 mutated quotes never emit a non-substring", () => {
  it("cosmetic, truncated and paraphrased model text stays verbatim or is dropped", () => {
    const random = rng(20261027);
    const allSents = sentences(clean);
    let cosmetic = 0;
    let truncated = 0;
    let paraphrase = 0;
    let cosmeticAccepted = 0;

    for (let i = 0; i < 1000; i++) {
      const seg = segments[Math.floor(random() * segments.length)];
      const sents = sentences(seg.text);
      const source = sents[Math.floor(random() * sents.length)];
      const roll = random();
      let mutated: string;
      let kind: "cosmetic" | "truncated" | "paraphrase";
      if (roll < 0.4) {
        mutated = mutateCosmetic(source, random);
        kind = "cosmetic";
        expect(isVerbatim(mutated, transcript)).toBe(true);
      } else if (roll < 0.7) {
        mutated = mutateTruncated(source, random);
        kind = "truncated";
      } else {
        mutated = mutateParaphrase(source, random);
        // Ensure this is a true paraphrase: not verbatim anywhere in the transcript.
        if (isVerbatim(mutated, transcript)) mutated = mutateParaphrase(mutated, random);
        if (isVerbatim(mutated, transcript)) {
          mutated = `${mutated} plus a phrase that was never spoken in this episode at all`;
        }
        expect(isVerbatim(mutated, transcript)).toBe(false);
        kind = "paraphrase";
      }

      // A second random verbatim quote and one invented quote ride along,
      // exercising the full resolve + fill pipeline like a real model payload.
      const other = allSents[Math.floor(random() * allSents.length)];
      const model: ModelQuote[] = [
        { segmentId: seg.id, exact: mutated },
        { segmentId: seg.id, exact: mutateCosmetic(other, random) },
        { segmentId: seg.id, exact: "Invented filler sentence that was never spoken in this episode." },
      ];
      const { quotes } = resolveQuotes(model, segments, { count: 5, candidates });

      everyQuoteIsSubstring(quotes);
      expect(quotes).toHaveLength(5); // always filled to count from deterministic candidates

      if (kind === "cosmetic") {
        cosmetic++;
        // Cosmetic mutations must resolve, and to the ORIGINAL verbatim text
        // (full sentence when it fits the cap, otherwise a verbatim prefix).
        const emitted = quotes.find((q) => q.segmentId === seg.id);
        expect(emitted).toBeDefined();
        if (emitted) {
          cosmeticAccepted++;
          const text = quoteText(emitted, segments);
          if (source.length <= QUOTE_MAX) expect(text).toBe(source);
          else expect(source.startsWith(text)).toBe(true);
        }
      } else if (kind === "truncated") {
        truncated++;
        // Truncated verbatim text may resolve to the verbatim prefix (substring
        // asserted above) or be dropped and refilled from candidates.
      } else {
        paraphrase++;
        // The mutated non-substring must NOT leak into any emitted quote.
        for (const q of quotes) {
          expect(quoteText(q, segments).includes("basically")).toBe(false);
          expect(quoteText(q, segments).includes("never spoken in this episode")).toBe(false);
        }
      }
    }

    // Sanity: the generator exercised all three mutation classes and the
    // resolver accepted verbatim material rather than always falling back.
    expect(cosmetic + truncated + paraphrase).toBe(1000);
    expect(cosmetic).toBeGreaterThan(200);
    expect(truncated).toBeGreaterThan(100);
    expect(paraphrase).toBeGreaterThan(200);
    expect(cosmeticAccepted).toBeGreaterThan(200);
  });
});
