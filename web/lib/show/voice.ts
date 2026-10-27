// §7.4/§7.5 — voice profile resolution and the POST /api/show/voice/learn and
// /api/show/voice/preview handlers (WP-07). AI runs ONLY through lib/ai
// (learnVoiceProfile/previewVoice); when every provider is unavailable the
// deterministic mode at the lib/ai boundary takes over and the response is
// labelled "deterministic" — a failed AI call never masquerades as a learn.
import type { ApiResult } from "@/lib/rss/preview";
import { NO_SHOW_COPY, VOICE_PROFILE_INVALID_COPY } from "@/lib/copy";
import { isDbConfigured } from "@/lib/env";
import * as queries from "@/db/queries";
import {
  learnVoiceProfile,
  learnVoiceProfileDeterministic,
  parseVoiceProfile,
  previewVoice,
  previewVoiceDeterministic,
  DEFAULT_VOICE_PROFILE,
  type VoiceProfile,
} from "@/lib/ai/voice";
import { effectiveAiSelection } from "@/lib/ai/settings";
import { resolveAppSettingsStore } from "@/lib/ai/settings-server";
import type { LlmProvider } from "@/lib/ai/types";
import { firstErrorMessage, voiceLearnSchema, voicePreviewSchema } from "./input";

export interface ShowVoiceDeps {
  /** provider chain override (tests inject fakes; the route uses the registry) */
  chain?: LlmProvider[];
}

/**
 * U3 gives "Learn my voice" ≤ 15 s. §8.1's 60 s timeout targets background
 * generation; an interactive onboarding step caps the provider timeout lower
 * so the deterministic answer still arrives inside the budget (DECISIONS.md).
 */
const VOICE_TIMEOUT_MS = 12_000;

/**
 * The show's effective voice profile: a stored §7.4 JSON when present and
 * valid, otherwise the spec default. Skip never writes a profile — null IS
 * the default — so this is the single read-time resolution point (U3).
 */
export function resolveShowVoiceProfile(
  show: { voiceProfile: unknown } | null | undefined,
): VoiceProfile {
  return (show ? parseVoiceProfile(show.voiceProfile) : null) ?? DEFAULT_VOICE_PROFILE;
}

/** Registry selection (app_settings.ai → env → defaults) for the handlers. */
async function resolveSelection() {
  return (await effectiveAiSelection(resolveAppSettingsStore())).selection;
}

/**
 * POST /api/show/voice/learn (U3): validate 1–3 samples (≥150 words each),
 * learn through the §8.1 provider chain, and persist profile + samples. When
 * every provider fails the deterministic profile is derived from the samples
 * and labelled; keyless previews return saved:false instead of faking a save.
 */
export async function handleVoiceLearn(
  userId: string,
  raw: unknown,
  deps: ShowVoiceDeps = {},
): Promise<ApiResult> {
  const parsed = voiceLearnSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: 400, json: { error: firstErrorMessage(parsed.error) } };
  }
  const samples = parsed.data.samples;

  const db = isDbConfigured();
  const show = db ? await queries.getShowByOwner(userId) : null;
  if (db && !show) {
    return { status: 404, json: { error: NO_SHOW_COPY } };
  }

  const result = await learnVoiceProfile({
    samples,
    deps: deps.chain?.length
      ? { chain: deps.chain }
      : { selection: await resolveSelection(), timeoutMs: VOICE_TIMEOUT_MS },
  });

  let profile: VoiceProfile;
  let learnStatus: "learned" | "deterministic";
  let provider: string | null;
  let model: string | null;
  if (result.ok) {
    profile = result.profile;
    learnStatus = "learned";
    provider = result.provider;
    model = result.model;
  } else {
    profile = learnVoiceProfileDeterministic(samples);
    learnStatus = "deterministic";
    provider = null;
    model = null;
  }

  let saved = false;
  if (show) {
    await queries.updateShow(show.id, { voiceProfile: profile, voiceSamples: samples });
    saved = true;
  }

  return { status: 200, json: { status: learnStatus, profile, provider, model, saved } };
}

/**
 * POST /api/show/voice/preview (M9/MK-8): write one short sample paragraph in
 * the voice. The profile may be posted (live editor state) or falls back to
 * the stored one. Deterministic text is labelled so the UI can say the AI
 * writer was unavailable instead of faking a model answer.
 */
export async function handleVoicePreview(
  userId: string,
  raw: unknown,
  deps: ShowVoiceDeps = {},
): Promise<ApiResult> {
  const parsed = voicePreviewSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: 400, json: { error: firstErrorMessage(parsed.error) } };
  }

  const db = isDbConfigured();
  const show = db ? await queries.getShowByOwner(userId) : null;

  let voice: VoiceProfile;
  if (parsed.data.profile !== undefined) {
    const fromRequest = parseVoiceProfile(parsed.data.profile);
    if (!fromRequest) {
      return { status: 400, json: { error: VOICE_PROFILE_INVALID_COPY } };
    }
    voice = fromRequest;
  } else {
    voice = resolveShowVoiceProfile(show);
  }

  const showContext = { name: show?.name ?? "the show" };
  const result = await previewVoice({
    voice,
    show: showContext,
    topic: parsed.data.topic,
    deps: deps.chain?.length
      ? { chain: deps.chain }
      : { selection: await resolveSelection(), timeoutMs: VOICE_TIMEOUT_MS },
  });

  if (result.ok) {
    return {
      status: 200,
      json: { status: "ai", text: result.text, provider: result.provider, model: result.model },
    };
  }
  return {
    status: 200,
    json: {
      status: "deterministic",
      text: previewVoiceDeterministic(voice, showContext),
      provider: null,
      model: null,
    },
  };
}
