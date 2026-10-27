// Quote-by-reference matching (§7.3 steps 2–4).
//
// The model's `exact` text is located inside the ORIGINAL segment text via a
// normalization that keeps a map from normalized positions back to source
// offsets. Emitted quotes are always slices of the original transcript — the
// model text itself is never displayed (§7.3 step 4).
import { QUOTE_MAX, QUOTE_MIN, trimQuoteSpan } from "./trim";
import type { QuoteRef, Segment } from "./types";

export interface NormalizedText {
  norm: string;
  /** map[normalizedIndex] → original text index the char derives from */
  map: number[];
}

interface NormalizedArrays {
  chars: string[];
  map: number[];
}

function pushAll(norm: string[], map: number[], s: string, orig: number): void {
  for (const c of s) {
    norm.push(c);
    map.push(orig);
  }
}

// Normalization used for matching: same transformations as
// normalizeQuoteStyle + normalizeWs + lowercase, applied while recording the
// origin of every normalized char. Whitespace runs collapse to one space.
function buildNormalizedArrays(text: string): NormalizedArrays {
  const chars: string[] = [];
  const map: number[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      let j = i;
      while (j < text.length && /\s/.test(text[j])) j++;
      chars.push(" ");
      map.push(j - 1);
      i = j;
      continue;
    }
    switch (ch) {
      case "\u201C":
      case "\u201D":
      case "\u201E":
      case "\u201F":
        pushAll(chars, map, '"', i);
        break;
      case "\u2018":
      case "\u2019":
      case "\u201A":
      case "\u201B":
        pushAll(chars, map, "'", i);
        break;
      case "\u2014":
        pushAll(chars, map, "--", i);
        break;
      case "\u2013":
        pushAll(chars, map, "-", i);
        break;
      case "\u2026":
        pushAll(chars, map, "...", i);
        break;
      default:
        pushAll(chars, map, ch.toLowerCase(), i);
    }
    i++;
  }
  return { chars, map };
}

export function buildNormalized(text: string): NormalizedText {
  const { chars, map } = buildNormalizedArrays(text);
  return { norm: chars.join(""), map };
}

function isDotsAt(n: string[], i: number): boolean {
  return n[i] === "." && n[i + 1] === "." && n[i + 2] === ".";
}

// Mirrors normalizeQuoteStyle's edge-ellipsis strip on already-expanded text:
// leading `(...)+ <space>` and trailing `<space> (...)+` are removed, and the
// map is truncated along. Additionally strips edge quotation marks (an LLM
// habit; safe — the inner text must still match verbatim; see DECISIONS.md).
function stripQueryEdges(nt: NormalizedArrays): void {
  const { chars: norm, map } = nt;
  // Repeat all passes until stable: edge ellipses and quotation marks can
  // nest (e.g. trailing `…”` exposes new ellipses/whitespace when stripped).
  for (;;) {
    let stripped = false;
    if (isDotsAt(norm, 0)) {
      norm.splice(0, 3);
      map.splice(0, 3);
      if (norm[0] === " ") {
        norm.splice(0, 1);
        map.splice(0, 1);
      }
      stripped = true;
    }
    let k = norm.length;
    if (k > 0 && norm[k - 1] === " ") k--;
    if (k >= 3 && isDotsAt(norm, k - 3)) {
      norm.length = k - 3;
      map.length = k - 3;
      stripped = true;
    }
    if (norm.length && (norm[0] === '"' || norm[0] === "'")) {
      norm.shift();
      map.shift();
      stripped = true;
    }
    if (norm.length && (norm[norm.length - 1] === '"' || norm[norm.length - 1] === "'")) {
      norm.pop();
      map.pop();
      stripped = true;
    }
    if (norm.length && norm[0] === " ") {
      norm.shift();
      map.shift();
      stripped = true;
    }
    if (norm.length && norm[norm.length - 1] === " ") {
      norm.pop();
      map.pop();
      stripped = true;
    }
    if (!stripped) break;
  }
}

// Query-side normalization: collapsed, lowercased, edge ellipses/quotes gone.
export function normalizeForMatch(text: string): string {
  const nt = buildNormalizedArrays(text);
  stripQueryEdges(nt);
  return nt.chars.join("");
}

// Resolver semantics: is `exact` verbatim (post-normalization) anywhere in the
// source text? Used by tests and eval-style generators.
export function isVerbatim(exact: string, sourceText: string): boolean {
  const q = normalizeForMatch(exact);
  if (!q) return false;
  return buildNormalized(sourceText).norm.includes(q);
}

function tightenSpan(segments: Segment[], ref: QuoteRef): QuoteRef | null {
  const idx = segments.findIndex((s) => s.id === ref.segmentId);
  if (idx < 0) return null;
  let ei = ref.endSegmentId ? segments.findIndex((s) => s.id === ref.endSegmentId) : idx;
  if (ei < idx) return null;
  let { start, end } = ref;
  let si = idx;
  // shrink leading whitespace, walking across segment boundaries
  for (;;) {
    if (si > ei) return null;
    if (start >= segments[si].text.length) {
      if (si === ei) return null;
      si++;
      start = 0;
      continue;
    }
    if (/\s/.test(segments[si].text[start])) {
      start++;
      continue;
    }
    break;
  }
  // shrink trailing whitespace
  for (;;) {
    if (ei < si) return null;
    if (end <= 0) {
      if (ei === si) return null;
      ei--;
      end = segments[ei].text.length;
      continue;
    }
    if (/\s/.test(segments[ei].text[end - 1])) {
      end--;
      continue;
    }
    break;
  }
  if (start >= end && si === ei) return null;
  const out: QuoteRef = { segmentId: segments[si].id, start, end };
  if (ei > si) out.endSegmentId = segments[ei].id;
  return out;
}

// Locate `exact` in segments[fromIdx .. fromIdx+window] (default window 2 =
// the segment plus the next two, §7.3). Returns offsets into the original
// segment text, or null when the text is not verbatim.
export function findExactInSegments(
  exact: string,
  segments: Segment[],
  fromIdx: number,
  opts?: { window?: number },
): QuoteRef | null {
  if (typeof exact !== "string" || !segments.length) return null;
  const window = opts?.window ?? 2;
  if (fromIdx < 0 || fromIdx >= segments.length) return null;
  const q = normalizeForMatch(exact);
  if (!q) return null;

  // 1) inside a single segment
  const last = Math.min(fromIdx + window, segments.length - 1);
  for (let i = fromIdx; i <= last; i++) {
    const hay = buildNormalized(segments[i].text);
    const at = hay.norm.indexOf(q);
    if (at >= 0) {
      const start = hay.map[at];
      const end = hay.map[at + q.length - 1] + 1;
      return tightenSpan(segments, { segmentId: segments[i].id, start, end });
    }
  }

  // 2) span across the window (≤3 segments) — needs endSegmentId
  if (last > fromIdx) {
    const starts: number[] = [];
    let joined = "";
    for (let i = fromIdx; i <= last; i++) {
      if (joined) joined += " ";
      starts.push(joined.length);
      joined += segments[i].text;
    }
    const hay = buildNormalized(joined);
    const at = hay.norm.indexOf(q);
    if (at >= 0) {
      const jStart = hay.map[at];
      const jEnd = hay.map[at + q.length - 1] + 1;
      let first = 0;
      let lastSeg = 0;
      for (let i = 0; i < starts.length; i++) {
        if (jStart >= starts[i]) first = i;
        if (jEnd > starts[i]) lastSeg = i;
      }
      if (lastSeg > first) {
        const span: QuoteRef = {
          segmentId: segments[fromIdx + first].id,
          start: jStart - starts[first],
          end: jEnd - starts[lastSeg],
          endSegmentId: segments[fromIdx + lastSeg].id,
        };
        return tightenSpan(segments, span);
      }
      // matched fully inside the first segment of the join — already covered
      return null;
    }
  }
  return null;
}

// Render a quote by offsets — the only sanctioned way to display a quote
// (§7.3 step 4). Never pass model text to the UI.
export function quoteText(ref: QuoteRef, segments: Segment[]): string {
  const idx = segments.findIndex((s) => s.id === ref.segmentId);
  if (idx < 0 || ref.start < 0) return "";
  if (!ref.endSegmentId) {
    if (ref.end < ref.start) return "";
    return segments[idx].text.slice(ref.start, ref.end);
  }
  const e = segments.findIndex((s) => s.id === ref.endSegmentId);
  if (e < idx || e - idx > 2) return "";
  const parts: string[] = [segments[idx].text.slice(ref.start)];
  for (let i = idx + 1; i < e; i++) parts.push(segments[i].text);
  parts.push(segments[e].text.slice(0, ref.end));
  return parts.join(" ");
}

// Apply the 40–240 trim (§7.3 step 5) to a resolved span, keeping offsets
// valid against the original segment text. Returns null when the span cannot
// satisfy the limits (the quote is then dropped, §7.3 step 3).
export function trimRef(
  span: QuoteRef,
  segments: Segment[],
  min = QUOTE_MIN,
  max = QUOTE_MAX,
): QuoteRef | null {
  const idx = segments.findIndex((s) => s.id === span.segmentId);
  if (idx < 0) return null;
  const eIdx = span.endSegmentId
    ? segments.findIndex((s) => s.id === span.endSegmentId)
    : idx;
  if (eIdx < idx || eIdx - idx > 2) return null;
  const segs = segments.slice(idx, eIdx + 1);
  const starts: number[] = [];
  let joined = "";
  for (const s of segs) {
    if (joined) joined += " ";
    starts.push(joined.length);
    joined += s.text;
  }
  const spanStart = starts[0] + span.start;
  const spanEnd = starts[starts.length - 1] + span.end;
  if (spanStart < 0 || spanEnd > joined.length || spanStart >= spanEnd) return null;
  const t = trimQuoteSpan(joined.slice(spanStart, spanEnd), min, max);
  if (!t) return null;
  const s2 = spanStart + t[0];
  const e2 = spanStart + t[1];
  let fi = 0;
  let li = 0;
  for (let i = 0; i < starts.length; i++) {
    if (s2 >= starts[i]) fi = i;
    if (e2 > starts[i]) li = i;
  }
  const out: QuoteRef = { segmentId: segs[fi].id, start: s2 - starts[fi], end: e2 - starts[li] };
  if (li > fi) out.endSegmentId = segs[li].id;
  return out;
}
