// Quote resolution pipeline (§7.3 steps 2–3): normalize the model's `exact`,
// find it in the claimed segment (+ next 2), store offsets against the
// original text; drop what is not verbatim and fill from deterministic
// `analysis.candidate_quotes` (rankedSentences) to the requested count.
import { findExactInSegments, quoteText, trimRef } from "./matching";
import { normalizeWs } from "./normalize";
import { QUOTE_MAX, QUOTE_MIN } from "./trim";
import type { ModelQuote, QuoteRef, Segment } from "./types";

export interface ResolveOptions {
  /** target number of quotes (quotes artifact: 5) */
  count?: number;
  /** analysis.candidate_quotes fallback */
  candidates?: QuoteRef[];
  min?: number;
  max?: number;
  /** how many segments ahead to search (default 2) */
  window?: number;
}

export interface ResolveResult {
  quotes: QuoteRef[];
  /** model quotes discarded (invented, misplaced, malformed, out of limits) */
  dropped: number;
  /** quotes filled from deterministic candidates */
  filled: number;
}

// Resolve ONE model quote to verbatim offsets, or null (drop).
export function resolveQuoteRef(
  model: unknown,
  segments: Segment[],
  opts?: Pick<ResolveOptions, "min" | "max" | "window">,
): QuoteRef | null {
  if (!model || typeof model !== "object") return null;
  const { segmentId, exact } = model as Partial<ModelQuote>;
  if (typeof segmentId !== "string" || typeof exact !== "string") return null;
  if (normalizeWs(exact).length <= 20) return null; // legacy isExactQuote minimum
  const idx = segments.findIndex((s) => s.id === segmentId);
  if (idx < 0) return null;
  const span = findExactInSegments(exact, segments, idx, { window: opts?.window });
  if (!span) return null;
  return trimRef(span, segments, opts?.min ?? QUOTE_MIN, opts?.max ?? QUOTE_MAX);
}

export function resolveQuotes(
  model: unknown,
  segments: Segment[],
  opts: ResolveOptions = {},
): ResolveResult {
  const count = Math.max(0, opts.count ?? 5);
  const quotes: QuoteRef[] = [];
  const seen = new Set<string>();
  let dropped = 0;

  const push = (ref: QuoteRef): boolean => {
    const key = normalizeWs(quoteText(ref, segments)).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    quotes.push(ref);
    return true;
  };

  if (Array.isArray(model)) {
    for (const m of model) {
      const ref = resolveQuoteRef(m, segments, opts);
      if (!ref || !push(ref)) dropped++;
    }
  } else if (model != null) {
    dropped++; // malformed payload — everything falls back to candidates
  }

  let filled = 0;
  const candidates = Array.isArray(opts.candidates) ? opts.candidates : [];
  for (const c of candidates) {
    if (quotes.length >= count) break;
    if (!c || typeof c !== "object") continue;
    // Defensive: candidates come from storage — re-validate against limits.
    const ref = trimRef(c, segments, opts.min ?? QUOTE_MIN, opts.max ?? QUOTE_MAX);
    if (ref && push(ref)) filled++;
  }

  return { quotes, dropped, filled };
}
