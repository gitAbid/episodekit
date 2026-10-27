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

// ---- deterministic no-AI mode (§8.1 last resort, added in WP-07) ------------
// U3 gives "Learn my voice" ≤15 s; with no usable provider key the chain above
// fails in seconds and onboarding must still produce a profile. Both functions
// below derive ONLY from the user's own input (extractive, never invented);
// fields a lexicon-free analyzer cannot honestly infer stay at the §7.4
// defaults. Callers must label the result as the basic version — it is never
// presented as a learned AI profile.

/** First-person pronoun counts decide person (word-boundary, contractions included). */
const PRONOUN_RE = {
  I: /\bI\b|\bI'm\b|\bI've\b|\bI'll\b|\bI'd\b|\bme\b|\bmy\b|\bmine\b|\bmyself\b/gi,
  we: /\bwe\b|\bwe're\b|\bwe've\b|\bwe'll\b|\bwe'd\b|\bus\b|\bour\b|\bours\b|\bourselves\b/gi,
  they: /\bthey\b|\bthey're\b|\bthey've\b|\bthey'll\b|\bthem\b|\btheir\b|\btheirs\b/gi,
} as const;

/** Sentence splitter without the engine's 40-char floor: short-sentence
 * authors would otherwise look "long" because their sentences get dropped. */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function learnVoiceProfileDeterministic(samples: string[]): VoiceProfile {
  const text = samples.join(" ").replace(/\s+/g, " ").trim();
  const count = (re: RegExp) => (text.match(re)?.length ?? 0);
  const iCount = count(PRONOUN_RE.I);
  const weCount = count(PRONOUN_RE.we);
  const theyCount = count(PRONOUN_RE.they);
  const max = Math.max(iCount, weCount, theyCount);
  const person: VoiceProfile["person"] =
    max === 0 ? DEFAULT_VOICE_PROFILE.person : iCount === max ? "I" : weCount === max ? "we" : "they";

  const sents = splitSentences(text);
  const words = text.split(" ").filter(Boolean);
  const avgWords = sents.length ? words.length / sents.length : 0;
  const sentenceLength: VoiceProfile["sentenceLength"] =
    sents.length === 0 || (avgWords >= 12 && avgWords <= 22)
      ? DEFAULT_VOICE_PROFILE.sentenceLength
      : avgWords < 12
        ? "short"
        : "long";

  const emojiCount = (text.match(/\p{Extended_Pictographic}/gu) ?? []).length;
  const emoji: VoiceProfile["emoji"] =
    emojiCount === 0 ? DEFAULT_VOICE_PROFILE.emoji : emojiCount <= 5 ? "light" : "heavy";

  return { ...DEFAULT_VOICE_PROFILE, person, sentenceLength, emoji };
}

/**
 * A ~60-word sample paragraph rendered from the profile's own parameters
 * (person, tone, sentence length, emoji). Pure function of its inputs so the
 * preview card always reflects the editor state; contains no never-say term
 * because the template vocabulary is fixed.
 */
export function previewVoiceDeterministic(voice: VoiceProfile, show?: { name?: string }): string {
  const name = show?.name?.trim() || "the show";
  const subject = voice.person === "I" ? "I" : voice.person === "we" ? "We" : "They";
  const poss = voice.person === "I" ? "my" : voice.person === "we" ? "our" : "their";
  const casual = voice.formality <= 2;

  const opener = `This week on ${name}: a ${voice.tone.join(", ")} look at the habits behind a calmer week.`;
  const core =
    voice.sentenceLength === "short"
      ? `${subject} ${casual ? "get into" : "discuss"} ${poss} favorite routine.`
      : `${subject} ${casual ? "get into" : "discuss"} why small routines beat big plans, and what ${poss} listeners can borrow from them.`;
  const extra =
    voice.sentenceLength === "short"
      ? ""
      : `And a quick answer to a listener question about keeping ${poss} workflow simple.`;
  const closer =
    voice.energy >= 4
      ? "Bring some energy — this one moves."
      : voice.humor >= 4
        ? casual
          ? "There's at least one bad joke ahead."
          : "There is at least one bad joke ahead."
        : casual
          ? "Have a listen."
          : "Enjoy the episode.";
  const marks = voice.emoji === "heavy" ? " 🎧✨" : voice.emoji === "light" ? " 🎧" : "";
  return `${[opener, core, extra, closer].filter(Boolean).join(" ")}${marks}`;
}
