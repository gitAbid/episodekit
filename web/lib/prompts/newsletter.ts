// §8.2 + §7.2 — newsletter: 3 subjects, chosen index, preview ≤90, body 250–400
// words, exactly 1 verified quote, CTA text ≤30.
import { NewsletterSchema } from "@/lib/artifacts/schemas";
import { assembleUserPrompt, TEMPERATURE_LONG, type AssembledPrompt, type PromptContext } from "./index";

const RULES = `Write a newsletter email from this episode as JSON.
Rules:
- "subjects": exactly 3 subject-line options.
- "chosen": index (0, 1 or 2) of the strongest subject.
- "previewText": at most 90 characters.
- "bodyMarkdown": 250-400 words. Where the verified quote belongs, put the placeholder {{quote:1}} on its own line.
- "quoteRefs": exactly 1 quote, {"segmentId": "...", "exact": "..."} copied character-for-character from a numbered transcript line.
- "ctaText": at most 30 characters, consistent with the show CTA.`;

const SCHEMA_EXAMPLE = `{
  "subjects": ["subject 1", "subject 2", "subject 3"],
  "chosen": 0,
  "previewText": "preview, max 90 chars",
  "bodyMarkdown": "email body\\n\\n{{quote:1}}\\n\\nclosing",
  "quoteRefs": [{ "segmentId": "seg_000123", "exact": "exact words from that segment" }],
  "ctaText": "Listen now"
}`;

export function buildNewsletterPrompt(ctx: PromptContext): AssembledPrompt & {
  schema: typeof NewsletterSchema;
  temperature: number;
  tier: "long" | "fast";
} {
  const { user, truncated } = assembleUserPrompt({ rules: RULES, schemaExample: SCHEMA_EXAMPLE, ctx });
  return { user, truncated, schema: NewsletterSchema, temperature: TEMPERATURE_LONG, tier: "long" };
}
