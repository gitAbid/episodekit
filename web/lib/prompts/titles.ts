// §8.2 + §7.2 — titles: exactly 8, ≤80 chars, 6 styles, star the best.
import { TitlesSchema } from "@/lib/artifacts/schemas";
import { assembleUserPrompt, TEMPERATURE_LONG, type AssembledPrompt, type PromptContext } from "./index";

const RULES = `Write episode title options as JSON.
Rules:
- "items": exactly 8 titles.
- "text": at most 80 characters each.
- "style": one of "Curiosity", "Benefit", "Guest", "Number", "Question", "Quote" — vary the styles across the 8.
- "starred": true for the single strongest title, false for all others.
No clickbait that the transcript cannot back up.`;

const SCHEMA_EXAMPLE = `{
  "items": [
    { "text": "title under 80 chars", "style": "Curiosity", "starred": true },
    { "text": "another title", "style": "Benefit", "starred": false }
  ]
}`;

export function buildTitlesPrompt(ctx: PromptContext): AssembledPrompt & {
  schema: typeof TitlesSchema;
  temperature: number;
  tier: "long" | "fast";
} {
  const { user, truncated } = assembleUserPrompt({ rules: RULES, schemaExample: SCHEMA_EXAMPLE, ctx });
  return { user, truncated, schema: TitlesSchema, temperature: TEMPERATURE_LONG, tier: "long" };
}
