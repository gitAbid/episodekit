// §8.1 — native Anthropic Messages adapter (system on top, usage in tokens).
// Same call policy: 60 s timeout, 1 retry on 429/5xx with a 2 s backoff.
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_TIMEOUT_MS,
  RETRY_BACKOFF_MS,
  ProviderError,
  type CompleteRequest,
  type CompleteResult,
  type LlmProvider,
} from "./types";

export interface AnthropicOptions {
  apiKey: () => string | undefined;
  baseUrl?: string;
  timeoutMs?: number;
  retryBackoffMs?: number;
  maxRetries?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

interface MessagesResponse {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export function createAnthropicProvider(opts: AnthropicOptions): LlmProvider {
  const id = "anthropic";
  const baseUrl = opts.baseUrl ?? "https://api.anthropic.com";
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryBackoffMs = opts.retryBackoffMs ?? RETRY_BACKOFF_MS;
  const maxRetries = opts.maxRetries ?? 1;
  const doFetch = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  return {
    id,
    async complete(req: CompleteRequest): Promise<CompleteResult> {
      const key = opts.apiKey();
      if (!key) throw new ProviderError("no_key", id, `${id}: missing API key`);

      const body: Record<string, unknown> = {
        model: req.model,
        max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
        temperature: req.temperature ?? 0.4,
        system: req.system,
        messages: [{ role: "user", content: req.user }],
      };

      let attempt = 0;
      for (;;) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await doFetch(`${baseUrl}/v1/messages`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": key,
              "anthropic-version": "2023-06-01",
            },
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
          const data = (await res.json()) as MessagesResponse;
          const text = (data.content ?? [])
            .filter((b) => b.type === "text")
            .map((b) => b.text ?? "")
            .join("");
          if (!text) throw new ProviderError("empty", id, `${id}: empty completion`);
          const usage = data.usage
            ? { in: data.usage.input_tokens ?? 0, out: data.usage.output_tokens ?? 0 }
            : undefined;
          return { text, usage };
        } catch (err) {
          if (err instanceof ProviderError) throw err;
          if (err instanceof Error && err.name === "AbortError") {
            throw new ProviderError("timeout", id, `${id}: timed out after ${timeoutMs}ms`);
          }
          throw new ProviderError("network", id, `${id}: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          clearTimeout(timer);
        }
      }
    },
  };
}
