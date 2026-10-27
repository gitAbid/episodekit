// §8.1 selection order: `app_settings.ai` (set in /admin) → env
// (AI_PROVIDER / AI_MODEL_LONG / AI_MODEL_FAST / AI_FALLBACK_PROVIDER) →
// defaults. Keys only ever live in env vars; the admin surface reports key
// presence, never values.
import { z } from "zod";
import { PROVIDER_IDS, ProviderId } from "./types";
import { PROVIDER_PRESETS, ProviderPreset } from "./presets";

/** `app_settings` row key holding the AI selection (§7.1: "ai provider selection (no secrets)"). */
export const AI_SETTINGS_KEY = "ai";

export const AiSelectionSchema = z.object({
  provider: z.enum(PROVIDER_IDS as [ProviderId, ...ProviderId[]]),
  longModel: z.string().min(1),
  fastModel: z.string().min(1),
  fallbackProvider: z.enum(PROVIDER_IDS as [ProviderId, ...ProviderId[]]),
});
export type AiSelection = z.output<typeof AiSelectionSchema>;

export const DEFAULT_AI_SELECTION: AiSelection = {
  provider: "glm-coding",
  longModel: PROVIDER_PRESETS["glm-coding"].defaultLong,
  fastModel: PROVIDER_PRESETS["glm-coding"].defaultFast,
  fallbackProvider: "groq",
};

/**
 * Documented persistence interface for `app_settings`. WP-02's DB layer
 * provides the Drizzle-backed implementation; until then the admin routes
 * receive `null` (GET serves the env/default view, PUT returns 503) and the
 * selection simply comes from env/defaults. No other module touches the DB.
 */
export interface AppSettingsStore {
  get(key: string): Promise<unknown | null>;
  put(key: string, value: unknown): Promise<void>;
}

export type SelectionSource = "settings" | "env" | "default";

/** Env-based selection — only counts when AI_PROVIDER names a known preset. */
export function selectionFromEnv(env: NodeJS.ProcessEnv): AiSelection | null {
  const id = env.AI_PROVIDER as ProviderId | undefined;
  if (!id || !PROVIDER_IDS.includes(id)) return null;
  const preset = PROVIDER_PRESETS[id];
  let longModel = env.AI_MODEL_LONG || preset.defaultLong;
  let fastModel = env.AI_MODEL_FAST || preset.defaultFast;
  if (id === "custom") {
    longModel = env.AI_CUSTOM_MODEL_LONG || longModel;
    fastModel = env.AI_CUSTOM_MODEL_FAST || fastModel;
  }
  const fallback = env.AI_FALLBACK_PROVIDER as ProviderId | undefined;
  return {
    provider: id,
    longModel,
    fastModel,
    fallbackProvider: fallback && PROVIDER_IDS.includes(fallback) ? fallback : DEFAULT_AI_SELECTION.fallbackProvider,
  };
}

/** The `custom` preset resolves its base URL + models from env at use time. */
export function resolveCustom(env: NodeJS.ProcessEnv): { baseUrl: string; longModel: string; fastModel: string } {
  return {
    baseUrl: env.AI_CUSTOM_BASE_URL || "",
    longModel: env.AI_CUSTOM_MODEL_LONG || "",
    fastModel: env.AI_CUSTOM_MODEL_FAST || "",
  };
}

export interface EffectiveSelection {
  selection: AiSelection;
  source: SelectionSource;
}

export async function effectiveAiSelection(
  store?: AppSettingsStore | null,
  opts?: { env?: NodeJS.ProcessEnv },
): Promise<EffectiveSelection> {
  const env = opts?.env ?? process.env;
  if (store) {
    try {
      const raw = await store.get(AI_SETTINGS_KEY);
      const parsed = AiSelectionSchema.safeParse(raw);
      if (parsed.success) return { selection: parsed.data, source: "settings" };
    } catch {
      // unreadable store must never break generation — env/defaults still apply
    }
  }
  const fromEnv = selectionFromEnv(env);
  if (fromEnv) return { selection: fromEnv, source: "env" };
  return { selection: DEFAULT_AI_SELECTION, source: "default" };
}

/** "key present ✓/✗" for the admin surface — booleans only, never values. */
export function keyPresent(preset: ProviderPreset, env: NodeJS.ProcessEnv): boolean {
  if (!env[preset.keyEnv]) return false;
  if (preset.id === "custom") return Boolean(resolveCustom(env).baseUrl); // key AND base URL
  return true;
}
