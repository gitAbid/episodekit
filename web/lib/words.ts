// Client-safe word helpers (no lib/ai imports — countWords is used in browser
// bundles by the voice forms; the zod schemas in lib/show/input reuse it).

/** Whitespace-split word count, matching the onboarding counter. */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** M1: past show notes have at least 150 words (1–3 samples, §7.5). */
export const MIN_SAMPLE_WORDS = 150;
