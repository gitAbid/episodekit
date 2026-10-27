// §8.1 — the ONE generic OpenAI-compatible adapter. Every non-GLM preset is a
// config object over this. Call policy per attempt: 60 s timeout, 1 retry on
// 429/5xx with a 2 s backoff.
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_TIMEOUT_MS,
  RETRY_BACKOFF_MS,
  ProviderError,
  type CompleteRequest,
  type CompleteResult,
  type LlmProvider,
} from "./types";

export interface OpenAiCompatOptions {
  id: string;
  baseUrl: string;
  /** env lookup wrapped in a closure so tests can inject; keys never leave env */
  apiKey: () => string | undefined;
  jsonMode?: boolean;
  timeoutMs?: number;
  retryBackoffMs?: number;
  maxRetries?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

export function createOpenAiCompatProvider(opts: OpenAiCompatOptions): LlmProvider {
  const {
    id,
    baseUrl,
    jsonMode = true,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retryBackoffMs = RETRY_BACKOFF_MS,
    maxRetries = 1,
  } = opts;
  const doFetch = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  return {
    id,
    async complete(req: CompleteRequest): Promise<CompleteResult> {
      const key = opts.apiKey();
      if (!key) throw new ProviderError("no_key", id, `${id}: missing API key`);

      const body: Record<string, unknown> = {
        model: req.model,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
        temperature: req.temperature ?? 0.4,
        max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
        ...(req.json && jsonMode ? { response_format: { type: "json_object" } } : {}),
      };

      let attempt = 0;
      for (;;) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const onOuterAbort = () => controller.abort();
        req.signal?.addEventListener("abort", onOuterAbort);
        try {
          const res = await doFetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
          if (!res.ok) {
            const detail = (await res.text().catch(() => "")).slice(0, 200);
            const retryable = res.status === 429 || res.status >= 500;
            const code = res.status === 429 ? "rate_limited" : res.status >= 500 ? "server_error" : "bad_request";
            if (retryable && attempt < maxRetries) {
              attempt++;
              await sleep(retryBackoffMs);
              continue;
            }
            throw new ProviderError(code, id, `${id}: http ${res.status}: ${detail}`, res.status, detail);
          }
          const data = (await res.json()) as ChatCompletionResponse;
          const content = data.choices?.[0]?.message?.content;
          if (!content) throw new ProviderError("empty", id, `${id}: empty completion`);
          const usage = data.usage
            ? { in: data.usage.prompt_tokens ?? 0, out: data.usage.completion_tokens ?? 0 }
            : undefined;
          return { text: content, usage };
        } catch (err) {
          if (err instanceof ProviderError) throw err;
          if (err instanceof Error && err.name === "AbortError") {
            throw new ProviderError("timeout", id, `${id}: timed out after ${timeoutMs}ms`);
          }
          throw new ProviderError("network", id, `${id}: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          clearTimeout(timer);
          req.signal?.removeEventListener("abort", onOuterAbort);
        }
      }
    },
  };
}
