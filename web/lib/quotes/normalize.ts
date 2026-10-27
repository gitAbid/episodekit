// Quote normalization (§7.3 step 2).
// - normalizeQuoteStyle: faithful port from legacy engine/glm.js.
// - normalizeWs, stripSpeakerLabels: re-exported from the engine port
//   (single source of truth, per spec "normalizeWs from engine/lib.js").
import { normalizeWs, stripSpeakerLabels } from "@/lib/engine";

export { normalizeWs, stripSpeakerLabels };

// LLMs habitually return typographic variants of otherwise-verbatim text
// (curly quotes, em-dashes, ellipses). Normalize those before comparison so a
// genuinely verbatim quote is not rejected for punctuation styling — while a
// paraphrase still fails the substring check.
export function normalizeQuoteStyle(s: string): string {
  return String(s)
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/\u2014/g, "--")
    .replace(/\u2013/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    // LLMs mark truncation with ellipses; the visible text is still verbatim,
    // so strip edge ellipses and let the prefix match.
    .replace(/(^(\.\.\.|…)+\s*)|(\s*(\.\.\.|…)+$)/g, "");
}

// Legacy isExactQuote semantics (engine/glm.js): normalized, lowercased
// substring check with a minimum length. Kept as the parity baseline; the
// offset-matching resolver in matching.ts is the stricter, reference-based path.
export function isExactQuote(quote: unknown, source: string): boolean {
  if (typeof quote !== "string" || quote.length <= 20) return false;
  const norm = (t: string) => normalizeQuoteStyle(normalizeWs(t)).toLowerCase();
  return norm(source).includes(norm(quote));
}
