// §7.3 step 1: numbered transcript lines the model sees.
// Format: `[seg_000123|Maya|01:12] text` (speaker/time omitted when absent —
// never invented).
import type { Segment } from "./types";

export function formatTimestamp(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return "";
  const total = Math.floor(ms / 1000);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export function formatTranscriptLine(s: Segment): string {
  return `[${s.id}|${s.speaker ?? ""}|${formatTimestamp(s.startMs)}] ${s.text}`;
}

export function formatTranscriptLines(segments: Segment[]): string {
  return segments.map(formatTranscriptLine).join("\n");
}
