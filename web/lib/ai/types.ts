// §8.1 — every provider implements ONE interface. All AI calls in the app go
// through `lib/ai` (hard rule); keys only ever come from env vars.
export type ProviderId =
  | "glm-coding"
  | "glm-open"
  | "groq"
  | "openai"
  | "openrouter"
  | "anthropic"
  | "custom";

export const PROVIDER_IDS: ProviderId[] = [
  "glm-coding",
  "glm-open",
  "groq",
  "openai",
  "openrouter",
  "anthropic",
  "custom",
];

export interface CompleteRequest {
  system: string;
  user: string;
  model: string;
  /** ask the provider for a JSON object (response_format json_object where supported) */
  json: boolean;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface TokenUsage {
  /** prompt tokens */
  in: number;
  /** completion tokens */
  out: number;
}

export interface CompleteResult {
  text: string;
  usage?: TokenUsage;
}

export interface LlmProvider {
  /** preset id, or a provider-qualified label for endpoint-level attempts */
  id: string;
  complete(req: CompleteRequest): Promise<CompleteResult>;
}

export type ProviderErrorCode =
  | "no_key"
  | "timeout"
  | "rate_limited"
  | "server_error"
  | "bad_request"
  | "empty"
  | "network"
  | "all_endpoints_failed"
  | "provider_failed";

/** One failed provider attempt, surfaced for admin/debug. */
export interface AttemptError {
  provider: string;
  code: ProviderErrorCode | string;
  detail?: string;
}

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly providerId: string;
  readonly status?: number;
  readonly detail?: string;

  constructor(code: ProviderErrorCode, providerId: string, message?: string, status?: number, detail?: string) {
    super(message || `${providerId}: ${code}${status ? ` (http ${status})` : ""}`);
    this.name = "ProviderError";
    this.code = code;
    this.providerId = providerId;
    this.status = status;
    this.detail = detail;
  }
}

/** Default per-call output budget. Blog bodies (900–1300 words) fit well within it. */
export const DEFAULT_MAX_TOKENS = 4096;

/** §8.1 call policy: primary timeout is 60 s. */
export const DEFAULT_TIMEOUT_MS = 60_000;

/** 1 retry on 429/5xx with a 2 s backoff (§8.1). */
export const RETRY_BACKOFF_MS = 2_000;
