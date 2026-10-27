// §8.2 + §7.4 — voice learn: 1–3 past show notes → the voice profile JSON.
import { buildSystemPrompt, assembleUserPrompt, TEMPERATURE_ANALYZE, type PromptContext } from "./index";
import { VoiceProfileSchema, type VoiceProfile } from "@/lib/ai/voice";
import { DEFAULT_VOICE_PROFILE } from "@/lib/ai/voice";

const RULES = `Learn this author's voice from their past show notes and return their voice profile as JSON.
Rules:
- "tone": exactly 3 adjectives.
- "formality", "energy", "humor": integers 1-5 (5 = most).
- "person": the pronoun they write as: "I", "we" or "they".
- "sentenceLength": "short", "medium" or "long".
- "emoji": "none", "light" or "heavy".
- "signaturePhrases": up to 5 phrases they actually reuse.
- "neverSay": up to 30 words or phrases this author would never use (stock AI phrasing goes here).
- "alwaysInclude": up to 5 phrases they consistently use.
- "ctaStyle": how they close, at most 120 characters.`;

const SCHEMA_EXAMPLE = `{
  "tone": ["clear", "warm", "direct"],
  "formality": 3,
  "energy": 3,
  "humor": 2,
  "person": "we",
  "sentenceLength": "medium",
  "emoji": "none",
  "signaturePhrases": [],
  "neverSay": ["delve"],
  "alwaysInclude": [],
  "ctaStyle": "Invite listeners to follow the show."
}`;

/** Samples stand in for transcript segments: same numbered-line treatment is
 * unnecessary, so a minimal context is synthesized (no metadata, no CTA). */
export function buildVoiceLearnPrompt(
  samples: string[],
  voice: VoiceProfile = DEFAULT_VOICE_PROFILE,
): {
  system: string;
  user: string;
  schema: typeof VoiceProfileSchema;
  temperature: number;
  tier: "fast";
} {
  const ctx: PromptContext = {
    show: { name: "the show" },
    voice,
    segments: [],
  };
  const { user } = assembleUserPrompt({
    rules: RULES,
    schemaExample: SCHEMA_EXAMPLE,
    ctx,
    maxTokens: 8_000, // samples are short; a tight budget keeps this fast
  });
  const sampleBlocks = samples
    .slice(0, 3)
    .map((s, i) => `Writing sample ${i + 1}:\n${s.trim()}`)
    .join("\n\n");
  return {
    system: buildSystemPrompt({ name: "the show" }, voice),
    user: `${user}\n\n${sampleBlocks}`,
    schema: VoiceProfileSchema,
    temperature: TEMPERATURE_ANALYZE,
    tier: "fast",
  };
}
