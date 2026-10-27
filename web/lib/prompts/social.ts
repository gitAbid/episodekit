// §8.2 + §7.2 — social: LinkedIn ≤1300, thread 4–6 posts ≤280, Instagram
// caption ≤2200 + 5–10 hashtags.
import { SocialSchema } from "@/lib/artifacts/schemas";
import { assembleUserPrompt, TEMPERATURE_LONG, type AssembledPrompt, type PromptContext } from "./index";

const RULES = `Write social posts for this episode as JSON.
Rules:
- "linkedin": at most 1300 characters, one post.
- "thread": 4 to 6 short posts, each at most 280 characters, telling one story in order.
- "instagram.caption": at most 2200 characters.
- "instagram.hashtags": 5 to 10 hashtags, relevant to the episode.
Quotes must be copied character-for-character from the transcript if used.`;

const SCHEMA_EXAMPLE = `{
  "linkedin": "LinkedIn post, max 1300 chars",
  "thread": ["post 1 (max 280)", "post 2 (max 280)", "post 3 (max 280)", "post 4 (max 280)"],
  "instagram": { "caption": "caption, max 2200 chars", "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"] }
}`;

export function buildSocialPrompt(ctx: PromptContext): AssembledPrompt & {
  schema: typeof SocialSchema;
  temperature: number;
  tier: "long" | "fast";
} {
  const { user, truncated } = assembleUserPrompt({ rules: RULES, schemaExample: SCHEMA_EXAMPLE, ctx });
  return { user, truncated, schema: SocialSchema, temperature: TEMPERATURE_LONG, tier: "long" };
}
