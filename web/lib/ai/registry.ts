// §8.1 registry: build a provider (or the [primary, fallback] chain) from an
// AiSelection. This is the ONLY place provider objects are constructed.
import { PROVIDER_PRESETS, ProviderPreset } from "./presets";
import { resolveCustom, type AiSelection } from "./settings";
import { createOpenAiCompatProvider } from "./openai-compat";
import { createAnthropicProvider } from "./anthropic";
import { createGlmProvider } from "./glm";
import type { LlmProvider } from "./types";

export type ModelTier = "long" | "fast";

export interface RegistryOptions {
  env?: NodeJS.ProcessEnv;
  /** which model slot providers are constructed with (default "long") */
  tier?: ModelTier;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
}

export function modelFor(selection: AiSelection, tier: ModelTier): string {
  return tier === "fast" ? selection.fastModel : selection.longModel;
}

/** Resolve the preset's base URL + models, applying `custom`'s env indirection. */
export function resolvePreset(selection: AiSelection, env: NodeJS.ProcessEnv): ProviderPreset {
  const preset = PROVIDER_PRESETS[selection.provider];
  if (selection.provider === "custom") {
    const custom = resolveCustom(env);
    if (!custom.baseUrl) {
      throw new Error("custom provider requires AI_CUSTOM_BASE_URL");
    }
    return {
      ...preset,
      baseUrl: custom.baseUrl,
      defaultLong: custom.longModel,
      defaultFast: custom.fastModel,
    };
  }
  return preset;
}

export function buildProvider(selection: AiSelection, opts?: RegistryOptions & { tier?: ModelTier }): LlmProvider {
  const env = opts?.env ?? process.env;
  const preset = resolvePreset(selection, env);
  const key = () => env[preset.keyEnv];
  const shared = {
    fetchImpl: opts?.fetchImpl,
    sleep: opts?.sleep,
    timeoutMs: opts?.timeoutMs,
  };

  if (preset.adapter === "glm") {
    return createGlmProvider({
      presetId: preset.id as "glm-coding" | "glm-open",
      model: modelFor(selection, opts?.tier ?? "long"),
      apiKey: key,
      ...shared,
    });
  }
  if (preset.adapter === "anthropic") {
    return createAnthropicProvider({ apiKey: key, ...shared });
  }
  return createOpenAiCompatProvider({
    id: preset.id,
    baseUrl: preset.baseUrl,
    apiKey: key,
    jsonMode: preset.jsonMode,
    ...shared,
  });
}

/**
 * The §8.1 call-policy chain: [primary, fallback]. The fallback is skipped
 * when it names the same provider as the primary (retrying the identical
 * configuration is not a fallback).
 */
export function buildProviderChain(selection: AiSelection, opts?: RegistryOptions): LlmProvider[] {
  const tier = opts?.tier ?? "long";
  const chain: LlmProvider[] = [buildProvider(selection, { ...opts, tier })];
  if (selection.fallbackProvider !== selection.provider) {
    chain.push(buildProvider({ ...selection, provider: selection.fallbackProvider }, { ...opts, tier }));
  }
  return chain;
}
