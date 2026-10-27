// §8.2 + §7.2 — blog post: 900–1300 words, H2s, SEO title ≤60, meta ≤155,
// slug, exactly 2 verified quotes via {{quote:n}} placeholders.
import { BlogSchema } from "@/lib/artifacts/schemas";
import { assembleUserPrompt, TEMPERATURE_LONG, type AssembledPrompt, type PromptContext } from "./index";

const RULES = `Write a blog post from this episode as JSON.
Rules:
- "seoTitle": at most 60 characters.
- "metaDescription": at most 155 characters.
- "slug": kebab-case.
- "bodyMarkdown": 900-1300 words in Markdown with ## section headings. Where a verified quote belongs, put the placeholder {{quote:1}} or {{quote:2}} on its own line — the two quotes are inserted from "quoteRefs" by order (1 then 2).
- "quoteRefs": exactly 2 quotes, each {"segmentId": "...", "exact": "..."} copied character-for-character from the numbered transcript lines.
Use only facts from the transcript.`;

const SCHEMA_EXAMPLE = `{
  "seoTitle": "SEO title, max 60 chars",
  "metaDescription": "meta description, max 155 chars",
  "slug": "episode-slug",
  "bodyMarkdown": "intro\\n\\n## Section\\n\\ntext\\n\\n{{quote:1}}\\n\\nmore text\\n\\n{{quote:2}}",
  "quoteRefs": [
    { "segmentId": "seg_000123", "exact": "exact words from that segment" },
    { "segmentId": "seg_000456", "exact": "another exact quote" }
  ]
}`;

export function buildBlogPrompt(ctx: PromptContext): AssembledPrompt & {
  schema: typeof BlogSchema;
  temperature: number;
  tier: "long" | "fast";
} {
  const { user, truncated } = assembleUserPrompt({ rules: RULES, schemaExample: SCHEMA_EXAMPLE, ctx });
  return { user, truncated, schema: BlogSchema, temperature: TEMPERATURE_LONG, tier: "long" };
}
