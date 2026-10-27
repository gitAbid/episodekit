// §7.5 admin AI API core (UI ships in WP-09): GET/PUT /api/admin/ai and
// POST /api/admin/ai/test. Handlers are framework-free and take their
// dependencies at the documented interfaces (app_settings store, owner gate,
// provider chain factory) so route files stay thin and tests stay honest.
import { AiSelectionSchema, effectiveAiSelection, keyPresent, type AiSelection, type AppSettingsStore, type SelectionSource } from "./settings";
import { PROVIDER_PRESETS, providerIds } from "./presets";
import { PROVIDER_IDS } from "./types";
import { buildProviderChain, modelFor } from "./registry";
import { estimateCost } from "./prices";
import { extractJson } from "./json";
import { DEFAULT_AI_SELECTION, resolveCustom } from "./settings";
import { requireOwner as defaultRequireOwner, type OwnerGateDeps, type OwnerGateResult } from "./owner";
import type { LlmProvider } from "./types";
import type { ModelTier } from "./registry";

type OwnerGateFn = (deps?: OwnerGateDeps) => Promise<OwnerGateResult>;

export interface AdminDeps {
  /** app_settings store; null = not wired yet (WP-02 seam) */
  store?: AppSettingsStore | null;
  requireOwner?: OwnerGateFn;
  env?: NodeJS.ProcessEnv;
  /** chain factory override for the test button (tests) */
  chainFor?: (selection: AiSelection, tier: ModelTier) => LlmProvider[];
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export interface AdminResponse {
  status: number;
  body: unknown;
}

// ---- GET --------------------------------------------------------------------

export async function adminAiGet(deps: AdminDeps = {}): Promise<AdminResponse> {
  const gate = await (deps.requireOwner ?? gateWith(defaultRequireOwner, deps))();
  if (!gate.ok) return { status: gate.status, body: { error: gate.reason } };

  const env = deps.env ?? process.env;
  const { selection, source } = await effectiveAiSelection(deps.store ?? null, { env });
  return {
    status: 200,
    body: {
      selection,
      source: source satisfies SelectionSource,
      defaultSelection: DEFAULT_AI_SELECTION,
      storeAvailable: Boolean(deps.store),
      providers: providerIds().map((id) => {
        const p = PROVIDER_PRESETS[id];
        return {
          id: p.id,
          label: p.label,
          baseUrl: p.id === "custom" ? resolveCustom(env).baseUrl || null : p.baseUrl,
          keyEnv: p.keyEnv,
          keyPresent: keyPresent(p, env),
          defaultLong: p.id === "custom" ? resolveCustom(env).longModel || null : p.defaultLong,
          defaultFast: p.id === "custom" ? resolveCustom(env).fastModel || null : p.defaultFast,
        };
      }),
    },
  };
}

// ---- PUT --------------------------------------------------------------------

export async function adminAiPut(deps: AdminDeps = {}, body: unknown): Promise<AdminResponse> {
  const gate = await (deps.requireOwner ?? gateWith(defaultRequireOwner, deps))();
  if (!gate.ok) return { status: gate.status, body: { error: gate.reason } };

  const env = deps.env ?? process.env;
  const parsed = AiSelectionSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { error: "invalid_selection", detail: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`) } };
  }
  if (parsed.data.provider === "custom" && !resolveCustom(env).baseUrl) {
    return { status: 400, body: { error: "custom_missing_base_url", detail: "Set AI_CUSTOM_BASE_URL before switching to the custom provider." } };
  }

  const store = deps.store;
  if (!store) {
    return { status: 503, body: { error: "settings_store_unavailable" } };
  }
  await store.put("ai", parsed.data);
  return { status: 200, body: { ok: true, selection: parsed.data, source: "settings" } };
}

// ---- POST /test -------------------------------------------------------------

export interface AdminTestBody {
  provider?: string;
  model?: string;
  tier?: ModelTier;
}

export async function adminAiTest(deps: AdminDeps = {}, body: AdminTestBody = {}): Promise<AdminResponse> {
  const gate = await (deps.requireOwner ?? gateWith(defaultRequireOwner, deps))();
  if (!gate.ok) return { status: gate.status, body: { error: gate.reason } };

  const env = deps.env ?? process.env;
  let selection: AiSelection;
  if (body.provider != null) {
    if (!PROVIDER_IDS.includes(body.provider as never)) {
      return { status: 400, body: { error: "unknown_provider" } };
    }
    const base = (await effectiveAiSelection(deps.store ?? null, { env })).selection;
    selection = {
      provider: body.provider as AiSelection["provider"],
      longModel: body.model ?? base.longModel,
      fastModel: body.model ?? base.fastModel,
      fallbackProvider: base.fallbackProvider,
    };
  } else {
    selection = (await effectiveAiSelection(deps.store ?? null, { env })).selection;
    if (body.model) {
      selection = { ...selection, ...(body.tier === "fast" ? { fastModel: body.model } : { longModel: body.model }) };
    }
  }

  const tier: ModelTier = body.tier ?? "fast";
  const model = modelFor(selection, tier);
  const chain = deps.chainFor
    ? deps.chainFor(selection, tier)
    : buildProviderChain(selection, { env, fetchImpl: deps.fetchImpl, sleep: deps.sleep });
  const provider = chain[0];

  const started = Date.now();
  try {
    const res = await provider.complete({
      system: "You are a health check. Return only JSON.",
      user: 'Return the JSON object {"ok":true}.',
      model,
      json: true,
      temperature: 0.2,
    });
    const latencyMs = Date.now() - started;
    const parsed = extractJson(res.text);
    const respondsOk = Boolean(parsed && typeof parsed === "object" && (parsed as { ok?: unknown }).ok === true);
    return {
      status: 200,
      body: {
        ok: respondsOk,
        provider: provider.id,
        model,
        latencyMs,
        usage: res.usage ?? null,
        costUsd: estimateCost(model, res.usage),
        text: respondsOk ? undefined : res.text.slice(0, 200),
      },
    };
  } catch (err) {
    return {
      status: 200,
      body: {
        ok: false,
        provider: provider.id,
        model,
        latencyMs: Date.now() - started,
        error: { code: (err as { code?: string }).code ?? "provider_failed", message: String(err).slice(0, 300) },
      },
    };
  }
}

// ---- gate plumbing ----------------------------------------------------------

function gateWith(requireOwner: OwnerGateFn, deps: AdminDeps): () => Promise<OwnerGateResult> {
  return () => requireOwner({ env: deps.env });
}
