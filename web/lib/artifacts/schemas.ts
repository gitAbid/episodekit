// §7.2 artifact content shapes (Zod). Every AI artifact is validated with
// these before storage; on failure the caller repairs once, then falls back
// to the deterministic builder (§8.1).
//
// Installed zod major is 4.x (spec predates zod 4) — API verified against
// node_modules/zod; logged in DECISIONS.md.
import { z } from "zod";
import type { QuoteRef } from "@/lib/quotes/types";

export type { QuoteRef };

export const QuoteRefSchema = z.object({
  segmentId: z.string().min(1),
  start: z.number().int().min(0),
  end: z.number().int().min(0),
  endSegmentId: z.string().min(1).optional(),
});

export const TitleStyle = z.enum(["Curiosity", "Benefit", "Guest", "Number", "Question", "Quote"]);
export type TitleStyle = z.output<typeof TitleStyle>;

const nonEmpty = z.string().min(1);

export const ShowNotesSchema = z.object({
  hook: nonEmpty, // 2–3 sentences (count enforced by prompts/post-checks, not chars)
  bullets: z.array(nonEmpty).min(4).max(7),
  guestLine: nonEmpty.optional(),
  quoteRefs: z.array(QuoteRefSchema).max(1),
  cta: nonEmpty,
});

export const ChapterSchema = z.object({
  startMs: z.number().int().min(0),
  title: z.string().min(1).max(50),
});

export const ChaptersSchema = z.object({
  items: z.array(ChapterSchema).min(5).max(12),
});

export const SummarySchema = z.object({
  oneLiner: z.string().min(1).max(140),
  short: nonEmpty, // 50–80 words
  long: nonEmpty, // 150–220 words
});

export const TitleItemSchema = z.object({
  text: z.string().min(1).max(80),
  style: TitleStyle,
  starred: z.boolean(),
});

export const TitlesSchema = z.object({
  items: z.array(TitleItemSchema).length(8),
});

export const BlogSchema = z.object({
  seoTitle: z.string().min(1).max(60),
  metaDescription: z.string().min(1).max(155),
  slug: nonEmpty,
  bodyMarkdown: nonEmpty, // contains {{quote:1}} placeholders rendered from refs
  quoteRefs: z.array(QuoteRefSchema).length(2),
});

export const NewsletterSchema = z.object({
  subjects: z.array(nonEmpty).length(3),
  chosen: z.number().int().min(0).max(2),
  previewText: z.string().min(1).max(90),
  bodyMarkdown: nonEmpty,
  quoteRefs: z.array(QuoteRefSchema).length(1),
  ctaText: z.string().min(1).max(30),
});

export const SocialSchema = z.object({
  linkedin: z.string().min(1).max(1300),
  thread: z.array(z.string().min(1).max(280)).min(4).max(6),
  instagram: z.object({
    caption: z.string().min(1).max(2200),
    hashtags: z.array(nonEmpty).min(5).max(10),
  }),
});

export const QuotesSchema = z.object({
  items: z.array(QuoteRefSchema).length(5),
});

export const ARTIFACT_KINDS = [
  "show_notes",
  "chapters",
  "summary",
  "titles",
  "blog",
  "newsletter",
  "social",
  "quotes",
] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

export const ArtifactContentSchema = {
  show_notes: ShowNotesSchema,
  chapters: ChaptersSchema,
  summary: SummarySchema,
  titles: TitlesSchema,
  blog: BlogSchema,
  newsletter: NewsletterSchema,
  social: SocialSchema,
  quotes: QuotesSchema,
} as const;

export function artifactContentSchema(kind: ArtifactKind) {
  return ArtifactContentSchema[kind];
}

export type ArtifactContent = {
  [K in ArtifactKind]: z.output<(typeof ArtifactContentSchema)[K]>;
}[ArtifactKind];
