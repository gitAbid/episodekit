// §7.4 voice profile — shape, defaults, learn + preview.
import { z } from "zod";
import type { LlmProvider } from "./types";

export const VoiceProfileSchema = z.object({
  tone: z.array(z.string().min(1)).length(3),
  formality: z.number().int().min(1).max(5),
  energy: z.number().int().min(1).max(5),
  humor: z.number().int().min(1).max(5),
  person: z.enum(["I", "we", "they"]),
  sentenceLength: z.enum(["short", "medium", "long"]),
  emoji: z.enum(["none", "light", "heavy"]),
  signaturePhrases: z.array(z.string().min(1)).max(5),
  neverSay: z.array(z.string().min(1)).max(30),
  alwaysInclude: z.array(z.string().min(1)).max(5),
  ctaStyle: z.string().min(1).max(120),
});
export type VoiceProfile = z.output<typeof VoiceProfileSchema>;

export const DEFAULT_VOICE_PROFILE: VoiceProfile = {
  tone: ["clear", "warm", "curious"],
  formality: 3,
  energy: 3,
  humor: 2,
  person: "we",
  sentenceLength: "medium",
  emoji: "none",
  signaturePhrases: [],
  neverSay: ["delve", "game-changer", "unlock", "dive deep", "in today's fast-paced world"],
  alwaysInclude: [],
  ctaStyle: "Invite listeners to follow the show.",
};

// ---- shared deps for the voice functions ------------------------------------

export interface VoiceDeps {
  /** full provider chain override (tests) */
  chain?: LlmProvider[];
  /** registry inputs when no chain is given */
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export type LearnVoiceResult =
  | { ok: true; profile: VoiceProfile; provider: string; model: string; repaired: boolean }
  | { ok: false; profile: VoiceProfile; provider: string | null; errorCode: string };

export type PreviewVoiceResult =
  | { ok: true; text: string; provider: string; model: string }
  | { ok: false; errorCode: string };

export function parseVoiceProfile(json: unknown): VoiceProfile | null {
  const parsed = VoiceProfileSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

// ---- voice learn + preview orchestration ------------------------------------
// Provider plumbing for §7.4. Prompt builders receive the profile as a
// parameter, so there is no runtime import cycle with lib/prompts.
import { buildVoiceLearnPrompt } from "@/lib/prompts/voice-learn";
import { buildVoicePreviewPrompt } from "@/lib/prompts/voice-preview";
import type { ShowContext } from "@/lib/prompts";
import { extractJson, repairPrompt } from "./json";
import { buildProviderChain, type ModelTier } from "./registry";
import type { AiSelection } from "./settings";

export interface VoiceChainDeps {
  /** full provider chain override (tests, admin test button) */
  chain?: LlmProvider[];
  /** registry inputs used when no chain is given (with `selection`, required then) */
  selection?: AiSelection;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
}

function chainFrom(deps: VoiceChainDeps | undefined, tier: ModelTier = "fast"): LlmProvider[] {
  if (deps?.chain?.length) return deps.chain;
  if (!deps?.selection) throw new Error("voice functions need a provider chain or a selection");
  return buildProviderChain(deps.selection, {
    env: deps.env,
    fetchImpl: deps.fetchImpl,
    sleep: deps.sleep,
    timeoutMs: deps.timeoutMs,
    tier,
  });
}

function modelFor(deps: VoiceChainDeps | undefined): string {
  return deps?.selection ? deps.selection.fastModel : "glm-4.5-air";
}

const SCHEMA_HINT = `{"tone":["adjective","adjective","adjective"],"formality":1-5,"energy":1-5,"humor":1-5,"person":"I"|"we"|"they","sentenceLength":"short"|"medium"|"long","emoji":"none"|"light"|"heavy","signaturePhrases":[],"neverSay":[],"alwaysInclude":[],"ctaStyle":"..."}`;

export async function learnVoiceProfile(args: {
  samples: string[];
  deps?: VoiceChainDeps;
}): Promise<LearnVoiceResult> {
  const chain = chainFrom(args.deps);
  const model = modelFor(args.deps);
  const prompt = buildVoiceLearnPrompt(args.samples);
  const baseUser = prompt.user;

  for (const provider of chain) {
    try {
      const res = await provider.complete({
        system: prompt.system,
        user: baseUser,
        model,
        json: true,
        temperature: prompt.temperature,
      });
      const parsed = parseVoiceProfile(extractJson(res.text));
      if (parsed) return { ok: true, profile: parsed, provider: provider.id, model, repaired: false };

      // one §8.1 repair call, same provider
      const repaired = await provider.complete({
        system: prompt.system,
        user: repairPrompt(baseUser, SCHEMA_HINT, "not a valid voice profile JSON"),
        model,
        json: true,
        temperature: prompt.temperature,
      });
      const parsed2 = parseVoiceProfile(extractJson(repaired.text));
      if (parsed2) return { ok: true, profile: parsed2, provider: provider.id, model, repaired: true };
    } catch {
      // provider failed — try the next one; total failure returns the default profile
    }
  }
  return { ok: false, profile: DEFAULT_VOICE_PROFILE, provider: null, errorCode: "voice_learn_failed" };
}

export async function previewVoice(args: {
  voice: VoiceProfile;
  show?: ShowContext;
  topic?: string;
  deps?: VoiceChainDeps;
}): Promise<PreviewVoiceResult> {
  const chain = chainFrom(args.deps);
  const model = modelFor(args.deps);
  const prompt = buildVoicePreviewPrompt(args.show ?? { name: "the show" }, args.voice, args.topic);
  for (const provider of chain) {
    try {
      const res = await provider.complete({
        system: prompt.system,
        user: prompt.user,
        model,
        json: false,
        temperature: prompt.temperature,
      });
      const text = res.text.trim();
      if (text) return { ok: true, text, provider: provider.id, model };
    } catch {
      // next provider
    }
  }
  return { ok: false, errorCode: "voice_preview_failed" };
}
