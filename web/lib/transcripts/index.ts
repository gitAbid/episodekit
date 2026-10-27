/**
 * Transcript parsers for the paste path (M2): plain text, SRT, VTT and the
 * speaker-timestamped exports of Riverside/Descript/Otter —
 * `Name (00:12:03): text` and `[00:12:03] Name: text`.
 *
 * Detection returns the format label used by the U5 chip
 * ("Riverside · speakers and timestamps found"); labels derive from the M2
 * format names. Timestamps + speakers are kept when present (they become
 * episodes.has_timestamps / has_speakers and the segments columns).
 */

export type TranscriptFormat = "plain" | "srt" | "vtt" | "riverside" | "descript" | "otter";

export interface ParsedSegment {
  speaker: string | null;
  startMs: number | null;
  endMs: number | null;
  text: string;
}

export interface DetectResult {
  format: TranscriptFormat;
  hasTimestamps: boolean;
  hasSpeakers: boolean;
  /** U5 chip copy, e.g. "Riverside · speakers and timestamps found". */
  chip: string;
}

export interface ParseResult extends DetectResult {
  segments: ParsedSegment[];
}

/** `Name (00:12:03): text` — Riverside's classic export shape. */
const PAREN_LINE = /^(.{1,60}?)\s*\((\d{1,2}:\d{1,2}(?::\d{1,2})?(?:[.,]\d{1,3})?)\):\s?(.*)$/;
/** `[00:12:03] Name: text` — the bracket-timestamped export shape. */
const BRACKET_LINE = /^\[(\d{1,2}:\d{1,2}(?::\d{1,2})?(?:[.,]\d{1,3})?)\]\s*(.{1,60}?):\s?(.*)$/;
/** `Name: text` without timestamps (Descript plain export). */
const SPEAKER_LINE = /^([A-Za-z0-9][A-Za-z0-9 ._'-]{0,39}):\s?(.+)$/;
/** Speaker prefix inside an SRT/VTT cue, e.g. "Maya: text". */
const CUE_SPEAKER = /^([A-Za-z0-9][A-Za-z0-9 ._'-]{0,39}):\s?(.+)$/;

/**
 * A plausible speaker label: 1–4 capitalized words ("Maya", "Speaker 2",
 * "Dr Maya Patel"). Keeps prose like "a second: seconds are how…" or
 * "scripts: I am offline…" from reading as speaker-labelled lines.
 */
function looksLikeSpeakerLabel(label: string): boolean {
  const words = label.trim().split(/\s+/);
  if (words.length > 4) return false;
  return words.every((w) => /^(?:[A-Z][A-Za-z0-9'._-]*|\d+)$/.test(w));
}

const SRT_TIMING = /^(\d{1,2}:\d{1,2}(?::\d{1,2})?(?:[.,]\d{1,3})?)\s*-->\s*(\d{1,2}:\d{1,2}(?::\d{1,2})?(?:[.,]\d{1,3})?)/;

/** "hh:mm:ss" | "mm:ss" (+ optional ",mmm"/".mmm") → ms. */
export function timestampToMs(raw: string): number | null {
  const m = raw.trim().match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:[.,](\d{1,3}))?$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const c = m[3] !== undefined ? Number(m[3]) : null;
  const frac = m[4] !== undefined ? Number(m[4].padEnd(3, "0")) : 0;
  if (c === null) return (a * 60 + b) * 1000 + frac; // mm:ss
  return (a * 3600 + b * 60 + c) * 1000 + frac; // hh:mm:ss
}

const normalize = (text: string): string => text.replace(/\r\n?/g, "\n");

function countMatches(text: string, re: RegExp): number {
  let n = 0;
  for (const line of text.split("\n")) {
    if (re.test(line)) n += 1;
  }
  return n;
}

function countSpeakerLines(text: string): number {
  let n = 0;
  for (const line of text.split("\n")) {
    const m = line.match(SPEAKER_LINE);
    if (m && looksLikeSpeakerLabel(m[1])) n += 1;
  }
  return n;
}

function chipFor(label: string, hasTimestamps: boolean, hasSpeakers: boolean): string {
  const parts = [
    hasSpeakers ? "speakers" : null,
    hasTimestamps ? "timestamps" : null,
  ].filter(Boolean);
  return parts.length ? `${label} · ${parts.join(" and ")} found` : label;
}

const LABELS: Record<TranscriptFormat, string> = {
  plain: "Plain text",
  srt: "SRT",
  vtt: "VTT",
  riverside: "Riverside",
  descript: "Descript",
  otter: "Otter",
};

export function detectFormat(rawText: string): DetectResult {
  const text = normalize(rawText);
  const trimmed = text.trim();
  if (!trimmed) {
    return { format: "plain", hasTimestamps: false, hasSpeakers: false, chip: LABELS.plain };
  }

  const firstLine = trimmed.split("\n")[0].trim();
  const timingLines = countMatches(text, SRT_TIMING);
  if (!firstLine.startsWith("WEBVTT") && timingLines >= 1) {
    return { format: "srt", hasTimestamps: true, hasSpeakers: false, chip: chipFor(LABELS.srt, true, false) };
  }
  if (firstLine.startsWith("WEBVTT")) {
    return { format: "vtt", hasTimestamps: true, hasSpeakers: false, chip: chipFor(LABELS.vtt, true, false) };
  }

  const parenLines = countMatches(text, PAREN_LINE);
  if (parenLines >= 2) {
    return { format: "riverside", hasTimestamps: true, hasSpeakers: true, chip: chipFor(LABELS.riverside, true, true) };
  }
  const bracketLines = countMatches(text, BRACKET_LINE);
  if (bracketLines >= 2) {
    return { format: "otter", hasTimestamps: true, hasSpeakers: true, chip: chipFor(LABELS.otter, true, true) };
  }

  const speakerLines = countSpeakerLines(text);
  if (speakerLines >= 2) {
    return { format: "descript", hasTimestamps: false, hasSpeakers: true, chip: chipFor(LABELS.descript, false, true) };
  }

  return { format: "plain", hasTimestamps: false, hasSpeakers: false, chip: LABELS.plain };
}

function parseSrtVtt(text: string, format: "srt" | "vtt"): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  const blocks = text.split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const timingIndex = lines.findIndex((l) => SRT_TIMING.test(l));
    if (timingIndex === -1) continue; // WEBVTT header, NOTE blocks, cue ids alone
    const timing = lines[timingIndex].match(SRT_TIMING);
    if (!timing) continue;
    const startMs = timestampToMs(timing[1]);
    const endMs = timestampToMs(timing[2]);
    const cueText = lines.slice(timingIndex + 1).join(" ").trim();
    if (!cueText || startMs === null) continue;
    // Riverside-style SRT exports put "Name: text" inside the cue.
    const speakerMatch = cueText.match(CUE_SPEAKER);
    if (speakerMatch && endMs !== null && looksLikeSpeakerLabel(speakerMatch[1])) {
      segments.push({ speaker: speakerMatch[1].trim(), startMs, endMs, text: speakerMatch[2].trim() });
    } else {
      segments.push({ speaker: null, startMs, endMs: endMs ?? null, text: cueText });
    }
    void format;
  }
  segments.sort((a, b) => (a.startMs ?? 0) - (b.startMs ?? 0));
  return segments;
}

function parseSpeakerTimestamped(
  text: string,
  re: RegExp,
  groups: { time: number; speaker: number; text: number },
): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(re);
    if (m) {
      const startMs = timestampToMs(m[groups.time]);
      segments.push({
        speaker: m[groups.speaker].trim(),
        startMs,
        endMs: null,
        text: m[groups.text].trim(),
      });
    } else if (line.trim() && segments.length > 0) {
      // Continuation line: same speaker, same moment.
      const prev = segments[segments.length - 1];
      prev.text = `${prev.text} ${line.trim()}`;
    }
  }
  if (segments.some((s) => s.startMs !== null)) {
    segments.sort((a, b) => (a.startMs ?? 0) - (b.startMs ?? 0));
  }
  return segments;
}

function parseSpeakerOnly(text: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(SPEAKER_LINE);
    if (m && looksLikeSpeakerLabel(m[1])) {
      segments.push({ speaker: m[1].trim(), startMs: null, endMs: null, text: m[2].trim() });
    } else if (line.trim() && segments.length > 0) {
      const prev = segments[segments.length - 1];
      prev.text = `${prev.text} ${line.trim()}`;
    }
  }
  return segments;
}

function parsePlain(text: string): ParsedSegment[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter(Boolean)
    .map((text) => ({ speaker: null, startMs: null, endMs: null, text }));
}

/**
 * Parse pasted transcript text into segments. Detection and parsing share the
 * same format rules, so the chip the user sees matches what gets stored.
 */
export function parseTranscript(rawText: string): ParseResult {
  const detected = detectFormat(rawText);
  const text = normalize(rawText);
  const trimmed = text.trim();
  if (!trimmed) {
    return { ...detected, segments: [] };
  }

  let segments: ParsedSegment[];
  switch (detected.format) {
    case "srt":
    case "vtt":
      segments = parseSrtVtt(text, detected.format);
      break;
    case "riverside":
      segments = parseSpeakerTimestamped(text, PAREN_LINE, { time: 2, speaker: 1, text: 3 });
      break;
    case "otter":
      segments = parseSpeakerTimestamped(text, BRACKET_LINE, { time: 1, speaker: 2, text: 3 });
      break;
    case "descript":
      segments = parseSpeakerOnly(text);
      break;
    default:
      segments = parsePlain(text);
  }

  // The chip must not promise what parsing did not deliver (e.g. a single
  // "(00:12)" line in an otherwise plain text block).
  const hasTimestamps = segments.some((s) => s.startMs !== null);
  const hasSpeakers = segments.some((s) => s.speaker !== null);
  return {
    format: detected.format,
    hasTimestamps,
    hasSpeakers,
    chip: chipFor(LABELS[detected.format], hasTimestamps, hasSpeakers),
    segments,
  };
}
