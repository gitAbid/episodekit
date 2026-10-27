// M12 — deterministic tool output from lib/engine (§8.1 last resort). Every
// string is extracted from the pasted transcript or is a fixed, honest
// template line — nothing is model text. Mirrors WP-04's rule: fallback
// content is NOT padded to AI minima; it returns what the transcript yields.
import {
  analyzeTranscript,
  buildArticle,
  buildDiscussionKit,
  buildEmailSeries,
  buildTitles,
} from "@/lib/engine";
import type { ToolId } from "./defs";
import type { DiscussionResult, EmailSeriesResult, ShowNotesResult, TitlesResult, TitleStyle } from "./schemas";

/** Classify an extractive title into one of the §7.2 styles. */
function classifyTitle(text: string): TitleStyle {
  if (/^(what|why|how)\b/i.test(text)) return "Question";
  if (/\d/.test(text)) return "Number";
  return "Curiosity";
}

export function deterministicShowNotes(text: string): ShowNotesResult {
  const a = analyzeTranscript(text);
  const article = buildArticle(text, a);
  return {
    title: article.title,
    hook: a.keyQuotes.slice(0, 2).join(" ") || article.sections[0]?.paragraphs[0]?.slice(0, 300) || "",
    bullets: (a.keyQuotes.slice(2, 8).length >= 4 ? a.keyQuotes.slice(2, 8) : a.keyQuotes.slice(0, 4)).map((b) =>
      b.slice(0, 200),
    ),
    quote: a.keyQuotes[0] ?? null,
    cta: "Invite listeners to follow the show.",
  };
}

export function deterministicTitles(text: string): TitlesResult {
  const a = analyzeTranscript(text);
  return {
    themes: a.themes.slice(0, 5),
    titles: buildTitles(a).map((t) => ({ text: t.slice(0, 80), style: classifyTitle(t) })),
  };
}

export function deterministicEmailSeries(text: string): EmailSeriesResult {
  const a = analyzeTranscript(text);
  return { days: buildEmailSeries(a) };
}

export function deterministicDiscussion(text: string): DiscussionResult {
  const a = analyzeTranscript(text);
  const kit = buildDiscussionKit(a);
  return {
    title: kit.title,
    opener: kit.opener,
    open: kit.open,
    qs: kit.qs,
    apply: kit.apply,
    closing: kit.closing,
  };
}

export function deterministicToolResult(tool: ToolId, text: string) {
  switch (tool) {
    case "show-notes":
      return deterministicShowNotes(text);
    case "episode-titles":
      return deterministicTitles(text);
    case "email-series":
      return deterministicEmailSeries(text);
    case "discussion-guide":
      return deterministicDiscussion(text);
  }
}
