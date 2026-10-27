// §8.2 — analyze step (fast model, temperature 0.2): topics, candidate quotes,
// chapters when timestamps exist. Feeds `analysis` (§7.1) and quote backfill.
import { z } from "zod";
import { buildSystemPrompt, assembleUserPrompt, TEMPERATURE_ANALYZE, type PromptContext } from "./index";

export const AnalyzeResultSchema = z.object({
  topics: z.array(z.string().min(1)).min(3).max(10),
  candidateQuotes: z
    .array(z.object({ segmentId: z.string().min(1), exact: z.string().min(1) }))
    .min(3)
    .max(15),
  chapters: z
    .array(z.object({ startMs: z.number().int().min(0), title: z.string().min(1).max(50) }))
    .max(12)
    .optional(),
});
export type AnalyzeResult = z.output<typeof AnalyzeResultSchema>;

const RULES = `Analyze this podcast episode transcript as JSON.
Rules:
- "topics": 3-10 topics the episode covers, 1-4 words each.
- "candidateQuotes": 5-12 of the most powerful moments, each {"segmentId": "...", "exact": "..."} with "exact" copied character-for-character from that numbered transcript line.
- "chapters": only if the lines carry timestamps: 5-12 chapters {"startMs" from the lines, "title" at most 50 chars}, first at 0, at least 2 minutes apart. Omit the key when there are no timestamps.`;

const SCHEMA_EXAMPLE = `{
  "topics": ["topic one", "topic two"],
  "candidateQuotes": [{ "segmentId": "seg_000123", "exact": "exact words from that segment" }],
  "chapters": [{ "startMs": 0, "title": "Opening" }]
}`;

export interface AnalyzePrompt {
  system: string;
  user: string;
  schema: typeof AnalyzeResultSchema;
  temperature: number;
  tier: "fast";
  truncated: boolean;
}

export function buildAnalyzePrompt(ctx: PromptContext): AnalyzePrompt {
  const { user, truncated } = assembleUserPrompt({ rules: RULES, schemaExample: SCHEMA_EXAMPLE, ctx });
  return {
    system: buildSystemPrompt(ctx.show, ctx.voice),
    user,
    schema: AnalyzeResultSchema,
    temperature: TEMPERATURE_ANALYZE,
    tier: "fast",
    truncated,
  };
}
