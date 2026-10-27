// §8.1 provider registry: preset table, selection order (app_settings.ai →
// env → defaults), key presence, provider chain construction.
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_AI_SELECTION, effectiveAiSelection, selectionFromEnv } from "@/lib/ai/settings";
import { PROVIDER_PRESETS, providerIds } from "@/lib/ai/presets";
import { buildProvider, buildProviderChain } from "@/lib/ai/registry";
import { keyPresent } from "@/lib/ai/settings";
import { scriptedFetch, noSleep } from "./helpers/ai";

function envOf(entries: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return entries as NodeJS.ProcessEnv;
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).__episodekitGlmWorking;
});

describe("§8.1 preset table", () => {
  it("has all seven presets with the spec'd base URLs and default models", () => {
    expect(providerIds()).toEqual([
      "glm-coding",
      "glm-open",
      "groq",
      "openai",
      "openrouter",
      "anthropic",
      "custom",
    ]);
    expect(PROVIDER_PRESETS["glm-coding"].baseUrl).toBe("https://api.z.ai/api/coding/paas/v4");
    expect(PROVIDER_PRESETS["glm-coding"].defaultLong).toBe("glm-4.6");
    expect(PROVIDER_PRESETS["glm-coding"].defaultFast).toBe("glm-4.5-air");
    expect(PROVIDER_PRESETS["glm-coding"].keyEnv).toBe("GLM_API_KEY");
    expect(PROVIDER_PRESETS["glm-open"].baseUrl).toBe("https://open.bigmodel.cn/api/paas/v4");
    expect(PROVIDER_PRESETS["glm-open"].defaultFast).toBe("glm-4-flash");
    expect(PROVIDER_PRESETS.groq.baseUrl).toBe("https://api.groq.com/openai/v1");
    expect(PROVIDER_PRESETS.openai.baseUrl).toBe("https://api.openai.com/v1");
    expect(PROVIDER_PRESETS.openrouter.baseUrl).toBe("https://openrouter.ai/api/v1");
    expect(PROVIDER_PRESETS.anthropic.adapter).toBe("anthropic");
    expect(PROVIDER_PRESETS.anthropic.baseUrl).toContain("api.anthropic.com");
    expect(PROVIDER_PRESETS.custom.keyEnv).toBe("AI_CUSTOM_API_KEY");
  });

  it("marks glm-coding as default and groq as fallback (spec §8.1)", () => {
    expect(DEFAULT_AI_SELECTION.provider).toBe("glm-coding");
    expect(DEFAULT_AI_SELECTION.longModel).toBe("glm-4.6");
    expect(DEFAULT_AI_SELECTION.fastModel).toBe("glm-4.5-air");
    expect(DEFAULT_AI_SELECTION.fallbackProvider).toBe("groq");
  });
});

describe("selection order: app_settings.ai → env → defaults", () => {
  it("returns defaults when no store and no env", async () => {
    const { selection, source } = await effectiveAiSelection(null, {
      env: envOf({}),
    });
    expect(selection).toEqual(DEFAULT_AI_SELECTION);
    expect(source).toBe("default");
  });

  it("reads a valid store object wholesale", async () => {
    const store = {
      get: async () => ({
        provider: "openai",
        longModel: "gpt-4o",
        fastModel: "gpt-4o-mini",
        fallbackProvider: "anthropic",
      }),
      put: async () => {},
    };
    const { selection, source } = await effectiveAiSelection(store, { env: envOf({}) });
    expect(selection.provider).toBe("openai");
    expect(selection.fallbackProvider).toBe("anthropic");
    expect(source).toBe("settings");
  });

  it("falls through to env when the store object is invalid", async () => {
    const store = { get: async () => ({ provider: "nope" }), put: async () => {} };
    const { selection, source } = await effectiveAiSelection(store, {
      env: envOf({
        AI_PROVIDER: "groq",
        AI_MODEL_LONG: "openai/gpt-oss-120b",
        AI_MODEL_FAST: "openai/gpt-oss-20b",
        AI_FALLBACK_PROVIDER: "glm-coding",
      }),
    });
    expect(selection.provider).toBe("groq");
    expect(selection.longModel).toBe("openai/gpt-oss-120b");
    expect(selection.fallbackProvider).toBe("glm-coding");
    expect(source).toBe("env");
  });

  it("falls through to defaults when the store throws", async () => {
    const store = { get: async () => { throw new Error("db down"); }, put: async () => {} };
    const { selection, source } = await effectiveAiSelection(store, { env: envOf({}) });
    expect(selection).toEqual(DEFAULT_AI_SELECTION);
    expect(source).toBe("default");
  });

  it("env provider without explicit models uses the preset defaults", () => {
    const s = selectionFromEnv(envOf({ AI_PROVIDER: "groq" }));
    expect(s).not.toBeNull();
    expect(s!.provider).toBe("groq");
    expect(s!.longModel).toBe(PROVIDER_PRESETS.groq.defaultLong);
    expect(s!.fastModel).toBe(PROVIDER_PRESETS.groq.defaultFast);
    expect(s!.fallbackProvider).toBe(DEFAULT_AI_SELECTION.fallbackProvider);
  });

  it("ignores an invalid AI_PROVIDER env and returns null (caller uses defaults)", () => {
    expect(selectionFromEnv(envOf({ AI_PROVIDER: "skynet" }))).toBeNull();
    expect(selectionFromEnv(envOf({}))).toBeNull();
  });
});

describe("key presence (admin shows ✓/✗, keys never leave env)", () => {
  it("reports per-provider key presence from env", () => {
    const env = envOf({ GLM_API_KEY: "k", AI_CUSTOM_BASE_URL: "https://x.example" });
    expect(keyPresent(PROVIDER_PRESETS["glm-coding"], env)).toBe(true);
    expect(keyPresent(PROVIDER_PRESETS.groq, env)).toBe(false);
    // custom needs base URL + key
    expect(keyPresent(PROVIDER_PRESETS.custom, env)).toBe(false);
    expect(
      keyPresent(PROVIDER_PRESETS.custom, envOf({ AI_CUSTOM_BASE_URL: "https://x", AI_CUSTOM_API_KEY: "k" })),
    ).toBe(true);
  });
});

describe("provider chain construction", () => {
  it("returns [primary, fallback] and skips the fallback when identical to primary", () => {
    const sel = { ...DEFAULT_AI_SELECTION };
    expect(buildProviderChain(sel, { env: envOf({ GLM_API_KEY: "k", GROQ_API_KEY: "g" }) }).map((p) => p.id))
      .toEqual(["glm-coding", "groq"]);
    const same = { provider: "groq", longModel: "m", fastModel: "m", fallbackProvider: "groq" } as const;
    expect(buildProviderChain(same, { env: envOf({ GROQ_API_KEY: "g" }) }).map((p) => p.id)).toEqual(["groq"]);
  });

  it("throws a configuration error for custom without base URL (U10 still applies)", () => {
    expect(() => buildProviderChain({ ...DEFAULT_AI_SELECTION, provider: "custom" }, { env: envOf({}) })).toThrow();
  });

  it("passes the tier model to the underlying adapter request", async () => {
    const fetchImpl = scriptedFetch([
      { choices: [{ message: { content: "{\"ok\":true}" } }], usage: { prompt_tokens: 1, completion_tokens: 1 } },
    ]);
    const provider = buildProvider(
      { provider: "groq", longModel: "long-model-x", fastModel: "fast-model-y", fallbackProvider: "groq" },
      { env: envOf({ GROQ_API_KEY: "g" }), fetchImpl, sleep: noSleep },
    );
    await provider.complete({ system: "s", user: "u", model: "long-model-x", json: true });
    await provider.complete({ system: "s", user: "u", model: "fast-model-y", json: true });
    expect(fetchImpl.calls[0].url).toBe("https://api.groq.com/openai/v1/chat/completions");
    const body0 = JSON.parse(String(fetchImpl.calls[0].init.body));
    expect(body0.model).toBe("long-model-x");
    const body1 = JSON.parse(String(fetchImpl.calls[1].init.body));
    expect(body1.model).toBe("fast-model-y");
    expect(body1.response_format).toEqual({ type: "json_object" });
  });
});
