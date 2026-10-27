// Shared quote types.
//
// Segment mirrors the §7.1 `segments` table (snake_case columns are mapped to
// camelCase at the DB boundary; logged in DECISIONS.md).
export interface Segment {
  /** "seg_000123" */
  id: string;
  idx: number;
  speaker: string | null;
  startMs: number | null;
  endMs: number | null;
  text: string;
}

// §7.2: char offsets into segment text; endSegmentId for spans ≤3 segments.
export interface QuoteRef {
  segmentId: string;
  start: number;
  end: number;
  endSegmentId?: string;
}

// What the model returns (§7.3 step 2). `exact` is model text and is NEVER
// displayed — it is only used to locate offsets in the transcript.
export interface ModelQuote {
  segmentId: string;
  exact: string;
}
