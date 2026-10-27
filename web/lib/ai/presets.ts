// §8.1 preset table — one generic OpenAI-compatible adapter + config presets,
// plus a native Anthropic Messages adapter. GLM presets add the multi-endpoint
// retry + working-endpoint cache ported from legacy `engine/glm.js`.
import type { ProviderId } from "./types";

export interface ProviderPreset {
  id: ProviderId;
  label: string;
  baseUrl: string;
  keyEnv: string;
  defaultLong: string;
  defaultFast: string;
  adapter: "openai" | "anthropic" | "glm";
  /** whether `response_format: json_object` is supported */
  jsonMode: boolean;
}

export const PROVIDER_PRESETS: Record<ProviderId, ProviderPreset> = {
  "glm-coding": {
    id: "glm-coding",
    label: "GLM (Coding Plan)",
    baseUrl: "https://api.z.ai/api/coding/paas/v4",
    keyEnv: "GLM_API_KEY",
    defaultLong: "glm-4.6",
    defaultFast: "glm-4.5-air",
    adapter: "glm",
    jsonMode: true,
  },
  "glm-open": {
    id: "glm-open",
    label: "GLM (open.bigmodel.cn)",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    keyEnv: "GLM_API_KEY",
    defaultLong: "glm-4.6",
    defaultFast: "glm-4-flash",
    adapter: "glm",
    jsonMode: true,
  },
  groq: {
    id: "groq",
    label: "Groq",
    // chosen from Groq's current production model list at build time
    // (DECISIONS.md 2026-10-27 · WP-04): gpt-oss-120b long / gpt-oss-20b fast
    baseUrl: "https://api.groq.com/openai/v1",
    keyEnv: "GROQ_API_KEY",
    defaultLong: "openai/gpt-oss-120b",
    defaultFast: "openai/gpt-oss-20b",
    adapter: "openai",
    jsonMode: true,
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    keyEnv: "OPENAI_API_KEY",
    defaultLong: "gpt-4o",
    defaultFast: "gpt-4o-mini",
    adapter: "openai",
    jsonMode: true,
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    keyEnv: "OPENROUTER_API_KEY",
    defaultLong: "anthropic/claude-sonnet-4.5",
    defaultFast: "openai/gpt-4o-mini",
    adapter: "openai",
    jsonMode: true,
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    baseUrl: "https://api.anthropic.com",
    keyEnv: "ANTHROPIC_API_KEY",
    defaultLong: "claude-sonnet-4-5",
    defaultFast: "claude-haiku-4-5",
    adapter: "anthropic",
    // Messages API has no response_format: json_object — JSON is instructed
    // by the prompt and enforced by the Zod + repair path.
    jsonMode: false,
  },
  custom: {
    id: "custom",
    label: "Custom (OpenAI-compatible)",
    baseUrl: "", // from AI_CUSTOM_BASE_URL — see settings.resolveCustom
    keyEnv: "AI_CUSTOM_API_KEY",
    defaultLong: "", // from AI_CUSTOM_MODEL_LONG
    defaultFast: "", // from AI_CUSTOM_MODEL_FAST
    adapter: "openai",
    jsonMode: true,
  },
};

export function providerIds(): ProviderId[] {
  return Object.keys(PROVIDER_PRESETS) as ProviderId[];
}
