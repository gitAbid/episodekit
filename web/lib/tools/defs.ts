// M12 free tools — ids, legacy-path metadata and the artifact each tool is
// grounded in. Copy follows §0.4 rule 4 (plain, second person, no hype) with
// SEO title/description ported from the legacy pages (faith-specific copy
// removed; see DECISIONS.md 2026-10-27 · WP-09).
export const TOOL_IDS = ["show-notes", "episode-titles", "email-series", "discussion-guide"] as const;
export type ToolId = (typeof TOOL_IDS)[number];

export interface ToolDef {
  id: ToolId;
  /** URL path segment (kept from the legacy site, M12 "keep URLs"). */
  path: string;
  h1: string;
  title: string;
  metaDescription: string;
  /** Page intro under the H1. */
  intro: string;
  textareaLabel: string;
  textareaPlaceholder: string;
  generateLabel: string;
  resultHeading: string;
  /** CTA band (MK-10, copy verbatim from the mockup). */
  cta: { heading: string; sub: string; button: string };
}

const CTA = {
  heading: "Get the full package from audio",
  sub: "Chapters, blog post, newsletter and social posts. Free for 2 episodes a month.",
  button: "Start free",
} as const;

export const TOOL_DEFS: Record<ToolId, ToolDef> = {
  "show-notes": {
    id: "show-notes",
    path: "show-notes",
    h1: "Podcast Show Notes Generator",
    title: "Free Podcast Show Notes Generator — EpisodeKit",
    metaDescription:
      "Paste your episode transcript and get structured show notes: a titled writeup with section headings built from what was actually said. Free, no signup, quotes verbatim.",
    intro:
      "Paste your episode transcript — get structured show notes: a titled writeup with section headings, written from what was actually said in the episode. No signup, instant, and the pull quote is copied word-for-word from your transcript (nothing invented).",
    textareaLabel: "Paste your transcript",
    textareaPlaceholder: "Paste your episode transcript here… (full transcript = best headings)",
    generateLabel: "Generate show notes",
    resultHeading: "Your show notes",
    cta: CTA,
  },
  "episode-titles": {
    id: "episode-titles",
    path: "episode-titles",
    h1: "Podcast Episode Title Generator",
    title: "Free Podcast Episode Title Generator — EpisodeKit",
    metaDescription:
      "Paste your episode transcript or notes and get title ideas grounded in the actual episode — plus the themes it's really about. Free, no signup.",
    intro:
      "Stuck on what to call this week's episode? Paste your transcript or show notes — you'll get title ideas built from the episode's own themes, plus the themes your episode is actually about. Free, no signup.",
    textareaLabel: "Paste your transcript",
    textareaPlaceholder: "Paste your episode transcript, show notes, or outline here…",
    generateLabel: "Generate title ideas",
    resultHeading: "Your titles",
    cta: CTA,
  },
  "email-series": {
    id: "email-series",
    path: "email-series",
    h1: "Episode → 5-Day Email Series",
    title: "Free Email Series Generator — turn an episode into a 5-day drip — EpisodeKit",
    metaDescription:
      "Paste an episode transcript and get a 5-day email series: each day anchored on a real quote from the episode, with a reflection, action step, and sign-off. Free, no signup.",
    intro:
      "Paste this week's episode and get a drip for your list: each day is anchored on an actual quote from the episode, with a reflection, one action step, and a sign-off. Free, no signup.",
    textareaLabel: "Paste your transcript",
    textareaPlaceholder: "Paste your episode transcript here… (the fuller the episode, the better the series)",
    generateLabel: "Generate email series",
    resultHeading: "Your 5-day series",
    cta: CTA,
  },
  "discussion-guide": {
    id: "discussion-guide",
    path: "discussion-guide",
    h1: "Podcast Discussion Kit Generator",
    title: "Free Podcast Discussion Kit Generator — EpisodeKit",
    metaDescription:
      "Paste an episode transcript and get a community discussion kit: opener, warm-up questions, quote-anchored discussion questions, and action prompts. Free, no signup.",
    intro:
      "Paste your episode transcript (or show notes). You'll get a kit for your community — Discord, Facebook group, or Patreon feed: opener, warm-up questions, discussion questions anchored to exact moments in the episode, and action prompts. Free, instant, no signup.",
    textareaLabel: "Paste your transcript",
    textareaPlaceholder:
      "Paste the episode transcript here… (a few paragraphs is enough; the full transcript is better)",
    generateLabel: "Generate discussion kit",
    resultHeading: "Your discussion kit",
    cta: CTA,
  },
};

export function isToolId(value: string): value is ToolId {
  return (TOOL_IDS as readonly string[]).includes(value);
}

/** Route path for the public API of a tool (§7.5 POST /api/public/tools/:tool). */
export function toolApiPath(id: ToolId): string {
  return `/api/public/tools/${id}`;
}
