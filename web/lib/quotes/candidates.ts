// Deterministic candidate quotes (§7.3 step 3): exact sentences ranked by
// engine `rankedSentences()`, returned as QuoteRefs into the original segment
// text. These fill `analysis.candidate_quotes` and backfill dropped model
// quotes — no model text involved.
import { rankedSentences, sentences, themes } from "@/lib/engine";
import { findExactInSegments, trimRef } from "./matching";
import { normalizeWs } from "./normalize";
import { QUOTE_MAX, QUOTE_MIN } from "./trim";
import type { QuoteRef, Segment } from "./types";

export interface CandidateOptions {
  /** how many candidates to return (default 12, like the engine's keyQuotes) */
  count?: number;
  min?: number;
  max?: number;
}

export function candidateQuoteRefs(segments: Segment[], opts: CandidateOptions = {}): QuoteRef[] {
  const count = Math.max(0, opts.count ?? 12);
  const min = opts.min ?? QUOTE_MIN;
  const max = opts.max ?? QUOTE_MAX;
  const fullText = segments.map((s) => s.text).join(" ");
  const th = themes(fullText, 10).filter((t) => t.length >= 5);

  const entries: QuoteRef[] = [];
  const seen = new Set<string>(); // dedupe identical sentences (repetition spam)
  for (let i = 0; i < segments.length; i++) {
    for (const s of sentences(segments[i].text)) {
      if (seen.has(s)) continue;
      seen.add(s);
      const span = findExactInSegments(s, segments, i, { window: 0 });
      if (!span) continue;
      const trimmed = trimRef(span, segments, min, max);
      if (trimmed) entries.push(trimmed);
    }
  }

  const ranked = rankedSentences(
    entries.map((r) => {
      const seg = segments.find((s) => s.id === r.segmentId);
      return normalizeWs((seg ? seg.text : "").slice(r.start, r.end));
    }),
    th,
  );
  const top = new Set(ranked.slice(0, count).map((r) => r.i));
  return entries.filter((_, i) => top.has(i)); // episode order preserved
}
