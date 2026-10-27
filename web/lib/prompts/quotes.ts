// §8.2 + §7.3 — quotes: 5 pull quotes the model claims as {segmentId, exact};
// the server resolves them to verbatim offsets (model text never displayed).
import { QuotesSchema } from "@/lib/artifacts/schemas";
import { assembleUserPrompt, TEMPERATURE_LONG, type AssembledPrompt, type PromptContext } from "./index";

const RULES = `Pick the 5 most powerful moments from this episode as JSON.
Rules:
- "items": exactly 5 quotes, each {"segmentId": "...", "exact": "..."}.
- "exact" must be the text copied character-for-character from that numbered transcript line — same words, same punctuation. Anything not copied exactly is discarded and replaced.
- Prefer complete thoughts that stand alone, roughly 40-240 characters.`;

const SCHEMA_EXAMPLE = `{
  "items": [
    { "segmentId": "seg_000123", "exact": "exact words copied from that segment" }
  ]
}`;

export function buildQuotesPrompt(ctx: PromptContext): AssembledPrompt & {
  schema: typeof QuotesSchema;
  temperature: number;
  tier: "long" | "fast";
} {
  const { user, truncated } = assembleUserPrompt({ rules: RULES, schemaExample: SCHEMA_EXAMPLE, ctx });
  return { user, truncated, schema: QuotesSchema, temperature: TEMPERATURE_LONG, tier: "long" };
}
