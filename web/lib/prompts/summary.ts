// §8.2 + §7.2 — summary: one-liner ≤140, short 50–80 words, long 150–220 words.
import { SummarySchema } from "@/lib/artifacts/schemas";
import { assembleUserPrompt, TEMPERATURE_LONG, type AssembledPrompt, type PromptContext } from "./index";

const RULES = `Summarize this episode as JSON.
Rules:
- "oneLiner": at most 140 characters, what the episode is about.
- "short": 50-80 words.
- "long": 150-220 words.
Use only facts from the transcript.`;

const SCHEMA_EXAMPLE = `{
  "oneLiner": "one sentence, max 140 chars",
  "short": "50-80 word summary",
  "long": "150-220 word summary"
}`;

export function buildSummaryPrompt(ctx: PromptContext): AssembledPrompt & {
  schema: typeof SummarySchema;
  temperature: number;
  tier: "long" | "fast";
} {
  const { user, truncated } = assembleUserPrompt({ rules: RULES, schemaExample: SCHEMA_EXAMPLE, ctx });
  return { user, truncated, schema: SummarySchema, temperature: TEMPERATURE_LONG, tier: "long" };
}
