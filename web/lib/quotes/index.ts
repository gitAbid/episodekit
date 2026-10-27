// Quote-by-reference (§7.3). Barrel export.
export {
  isExactQuote,
  normalizeQuoteStyle,
  normalizeWs,
  stripSpeakerLabels,
} from "./normalize";
export {
  buildNormalized,
  findExactInSegments,
  isVerbatim,
  normalizeForMatch,
  quoteText,
  trimRef,
} from "./matching";
export { QUOTE_MAX, QUOTE_MIN, trimQuoteSpan } from "./trim";
export { resolveQuoteRef, resolveQuotes } from "./resolve";
export type { ResolveOptions, ResolveResult } from "./resolve";
export { candidateQuoteRefs } from "./candidates";
export type { CandidateOptions } from "./candidates";
export { formatTimestamp, formatTranscriptLine, formatTranscriptLines } from "./format";
export type { ModelQuote, QuoteRef, Segment } from "./types";
