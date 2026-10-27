// §8.2 — shorten-to-fit (U13): copy a text to a hard character limit in the
// show's voice. Plain text in, plain text out.
import { buildSystemPrompt, type ShowContext } from "./index";
import type { VoiceProfile } from "@/lib/ai/voice";

export function buildShortenPrompt(args: {
  show: ShowContext;
  voice: VoiceProfile;
  text: string;
  maxChars: number;
}): { system: string; user: string; json: false; temperature: number; tier: "fast" } {
  const system = buildSystemPrompt(args.show, args.voice);
  const user = [
    `Shorten the TEXT below to at most ${args.maxChars} characters.`,
    `Keep the meaning, the voice, and any structure. Do not add facts.`,
    `Return ONLY the shortened text — no JSON, no explanations, no character counts.`,
    `TEXT:\n${args.text}`,
  ].join("\n");
  return { system, user, json: false, temperature: 0.2, tier: "fast" };
}
