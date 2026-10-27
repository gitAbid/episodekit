// §8.2 + §7.2 — chapters: 5–12, first at 00:00, ≥2 min apart, title ≤50 chars.
import { ChaptersSchema } from "@/lib/artifacts/schemas";
import { assembleUserPrompt, TEMPERATURE_LONG, type AssembledPrompt, type PromptContext } from "./index";

const RULES = `Write podcast chapters for this episode as JSON.
Rules:
- "items": 5 to 12 chapters.
- Use startMs values taken from the numbered transcript lines (milliseconds); the first chapter starts at 0.
- Chapters must be at least 2 minutes (120000 ms) apart.
- "title": at most 50 characters, descriptive, no clickbait.
- Only chapter ranges the transcript actually covers.`;

const SCHEMA_EXAMPLE = `{
  "items": [
    { "startMs": 0, "title": "Opening" },
    { "startMs": 180000, "title": "Main theme" }
  ]
}`;

export function buildChaptersPrompt(ctx: PromptContext): AssembledPrompt & {
  schema: typeof ChaptersSchema;
  temperature: number;
  tier: "long" | "fast";
} {
  const { user, truncated } = assembleUserPrompt({ rules: RULES, schemaExample: SCHEMA_EXAMPLE, ctx });
  return { user, truncated, schema: ChaptersSchema, temperature: TEMPERATURE_LONG, tier: "long" };
}
