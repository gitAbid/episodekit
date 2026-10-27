// §8.2 + §7.2 — show notes: hook, 4–7 bullets, optional guest line, ≤1 quote, CTA.
import { ShowNotesSchema } from "@/lib/artifacts/schemas";
import { assembleUserPrompt, TEMPERATURE_LONG, type AssembledPrompt, type PromptContext } from "./index";

const RULES = `Write show notes for this episode as JSON.
Rules:
- "hook": 2-3 sentences that make someone press play.
- "bullets": 4-7 "In this episode" bullets; one concrete takeaway each, no fluff.
- "guestLine": one sentence introducing the guest — only when there is a guest; omit the key otherwise.
- "quoteRefs": at most 1 quote, as {"segmentId": "...", "exact": "..."} copied character-for-character from that numbered transcript line.
- "cta": call to action, consistent with the show CTA given below.
Chapters are rendered separately — do not include them.`;

const SCHEMA_EXAMPLE = `{
  "hook": "2-3 sentence hook",
  "bullets": ["bullet 1", "bullet 2", "bullet 3", "bullet 4"],
  "guestLine": "one line about the guest (omit if no guest)",
  "quoteRefs": [{ "segmentId": "seg_000123", "exact": "exact words from that segment" }],
  "cta": "call to action"
}`;

export function buildShowNotesPrompt(ctx: PromptContext): AssembledPrompt & {
  schema: typeof ShowNotesSchema;
  temperature: number;
  tier: "long" | "fast";
} {
  const { user, truncated } = assembleUserPrompt({ rules: RULES, schemaExample: SCHEMA_EXAMPLE, ctx });
  return { user, truncated, schema: ShowNotesSchema, temperature: TEMPERATURE_LONG, tier: "long" };
}
