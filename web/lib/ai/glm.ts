// §8.1 — GLM presets: multi-endpoint retry + working-endpoint cache, ported
// from legacy `engine/glm.js`. GLM keys come in flavors (z.ai coding plan,
// z.ai open platform, bigmodel.cn) that are not interchangeable and not
// reachable-diagnosable from inside a serverless function, so a preset tries
// its known-good flavors per call and remembers the winner on the warm
// instance (globalThis — survives across invocations on the same lambda).
// Owner note (spec §8.1): error 1113 = the Z.ai account has no coding-plan
// resource package; the app then runs on the fallback provider automatically.
import {
  DEFAULT_TIMEOUT_MS,
  RETRY_BACKOFF_MS,
  ProviderError,
  type CompleteRequest,
  type CompleteResult,
  type LlmProvider,
  type ProviderId,
} from "./types";

export interface GlmEndpoint {
  url: string;
  model: string;
}

const CODING_V4 = "https://api.z.ai/api/coding/paas/v4/chat/completions";
const ZAI_PAS_V4 = "https://api.z.ai/api/paas/v4/chat/completions";
const BIGMODEL_V4 = "https://open.bigmodel.cn/api/paas/v4/chat/completions";

/**
 * Endpoint+model flavors to try, most likely first. The chosen model leads;
 * the preset's sibling default model follows (legacy behaviour: an endpoint
 * that rejects one model may still serve the other), then the alternate host.
 */
export function glmEndpointCandidates(presetId: "glm-coding" | "glm-open", model: string): GlmEndpoint[] {
  if (presetId === "glm-open") {
    return [
      { url: BIGMODEL_V4, model },
      { url: BIGMODEL_V4, model: model === "glm-4.6" ? "glm-4-flash" : "glm-4.6" },
    ];
  }
  return [
    { url: CODING_V4, model },
    { url: CODING_V4, model: model === "glm-4.6" ? "glm-4.5-air" : "glm-4.6" },
    { url: ZAI_PAS_V4, model },
    { url: BIGMODEL_V4, model },
  ];
}

// ---- working-endpoint cache (globalThis, per warm instance) -----------------

const CACHE_KEY = "__episodekitGlmWorking";

interface GlmGlobal {
  [CACHE_KEY]?: Record<string, GlmEndpoint>;
}

function cache(): Record<string, GlmEndpoint> {
  const g = globalThis as typeof globalThis & GlmGlobal;
  if (!g[CACHE_KEY]) g[CACHE_KEY] = {};
  return g[CACHE_KEY]!;
}

export function resetGlmWorkingCache(): void {
  const g = globalThis as typeof globalThis & GlmGlobal;
  delete g[CACHE_KEY];
}

function cachedEndpoint(presetId: ProviderId, candidates: GlmEndpoint[]): GlmEndpoint | null {
  const saved = cache()[presetId];
  if (!saved) return null;
  return candidates.find((c) => c.url === saved.url && c.model === saved.model) ?? null;
}

export interface GlmProviderOptions {
  presetId: "glm-coding" | "glm-open";
  model: string;
  apiKey: () => string | undefined;
  timeoutMs?: number;
  retryBackoffMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export function createGlmProvider(opts: GlmProviderOptions): LlmProvider {
  const { presetId, model } = opts;
  const id = presetId;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryBackoffMs = opts.retryBackoffMs ?? RETRY_BACKOFF_MS;
  const doFetch = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  function requestBody(ep: GlmEndpoint, req: CompleteRequest): string {
    return JSON.stringify({
      model: ep.model,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
      temperature: req.temperature ?? 0.4,
      max_tokens: req.maxTokens ?? 4096,
      ...(req.json ? { response_format: { type: "json_object" } } : {}),
    });
  }

  function headers(key: string): Record<string, string> {
    return { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
  }

  async function postOnce(ep: GlmEndpoint, body: string, key: string, signal: AbortSignal): Promise<Response> {
    return doFetch(ep.url, { method: "POST", headers: headers(key), body, signal });
  }

  function parseOk(data: ChatCompletionResponse, ep: GlmEndpoint): CompleteResult {
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new ProviderError("empty", `${id}:${new URL(ep.url).host}`, `${id}: empty completion`);
    return {
      text: content,
      usage: data.usage
        ? { in: data.usage.prompt_tokens ?? 0, out: data.usage.completion_tokens ?? 0 }
        : undefined,
    };
  }

  async function attempt(ep: GlmEndpoint, req: CompleteRequest, key: string): Promise<CompleteResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const body = requestBody(ep, req);
      const res = await postOnce(ep, body, key, controller.signal);
      if (!res.ok) {
        const detail = (await res.text().catch(() => "")).slice(0, 200);
        // Same retry contract as the generic adapter, per endpoint flavor:
        // 1 retry on 429/5xx with backoff, then move to the next flavor.
        if (res.status === 429 || res.status >= 500) {
          await sleep(retryBackoffMs);
          const res2 = await postOnce(ep, body, key, controller.signal);
          if (res2.ok) return parseOk((await res2.json()) as ChatCompletionResponse, ep);
        }
        throw new ProviderError(
          res.status === 429 ? "rate_limited" : res.status >= 500 ? "server_error" : "bad_request",
          `${id}:${new URL(ep.url).host}`,
          `${id}: http ${res.status} @ ${ep.url}: ${detail}`,
          res.status,
          detail,
        );
      }
      return parseOk((await res.json()) as ChatCompletionResponse, ep);
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new ProviderError("timeout", `${id}:${new URL(ep.url).host}`, `${id}: timed out after ${timeoutMs}ms`);
      }
      throw new ProviderError(
        "network",
        `${id}:${new URL(ep.url).host}`,
        `${id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    id,
    async complete(req: CompleteRequest): Promise<CompleteResult> {
      const key = opts.apiKey();
      if (!key) throw new ProviderError("no_key", id, `${id}: missing GLM_API_KEY`);
      const candidates = glmEndpointCandidates(presetId, model);
      const cached = cachedEndpoint(presetId, candidates);
      const ordered = cached ? [cached, ...candidates.filter((c) => c !== cached)] : candidates;
      const errors: string[] = [];
      for (const ep of ordered) {
        try {
          const result = await attempt(ep, req, key);
          cache()[presetId] = { url: ep.url, model: ep.model };
          return result;
        } catch (err) {
          errors.push(err instanceof Error ? err.message : String(err));
        }
      }
      throw new ProviderError("all_endpoints_failed", id, `${id}: all endpoints failed [${errors.join(" | ")}]`);
    },
  };
}
