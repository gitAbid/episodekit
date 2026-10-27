// §8.2 + §7.4 — voice preview: write one short sample paragraph IN the voice
// (plain text, not JSON) so the user can check the learned profile (M9).
import { buildSystemPrompt, type ShowContext } from "./index";
import type { VoiceProfile } from "@/lib/ai/voice";

export function buildVoicePreviewPrompt(
  show: ShowContext,
  voice: VoiceProfile,
  topic?: string,
): { system: string; user: string; json: false; temperature: number; tier: "fast" } {
  const system = buildSystemPrompt(show, voice);
  const user = [
    `Write ONE short sample paragraph (2-4 sentences) in this show's voice, as if introducing a new episode.`,
    topic ? `Topic of the sample: ${topic}.` : `Pick a plausible episode topic for this show.`,
    `Plain text only — no JSON, no headings, no quotes syntax.`,
  ].join(" ");
  return { system, user, json: false, temperature: 0.4, tier: "fast" };
}
