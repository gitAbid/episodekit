// §7.3 step 5: trim quotes to 40–240 chars at word/sentence boundaries.
// Operates on (and returns offsets into) a verbatim slice, so the emitted
// text is always a substring of the transcript.

export const QUOTE_MIN = 40;
export const QUOTE_MAX = 240;

// Returns [start, end] offsets into `text` (a verbatim slice) with length
// within [min, max], cut at the last sentence end — else word boundary —
// before the cap. Returns null when the text cannot satisfy the limits
// (e.g. shorter than the floor): the caller drops the quote.
export function trimQuoteSpan(text: string, min = QUOTE_MIN, max = QUOTE_MAX): [number, number] | null {
  if (min < 1 || max < min) return null;
  let end = text.length;
  if (end > max) {
    const head = text.slice(0, max);
    let cut = -1;
    // last sentence end (". ", "! ", "? ", or at the cap) within the cap
    for (let i = head.length - 1; i >= min - 1 && i >= 0; i--) {
      if (/[.!?]/.test(head[i]) && (i + 1 === head.length || /\s/.test(head[i + 1]))) {
        cut = i + 1;
        break;
      }
    }
    if (cut < min) {
      // no usable sentence boundary → word boundary
      const sp = head.lastIndexOf(" ");
      cut = sp >= min ? sp : max;
    }
    end = cut;
  }
  let start = 0;
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  const len = end - start;
  if (len < min || len > max) return null;
  return [start, end];
}
