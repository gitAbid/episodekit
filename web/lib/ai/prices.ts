// §8.1 — per-model price table for `usage_events.cost_usd` estimates.
// Prices are USD per 1M tokens, list price, verified 2026-10-27 from the
// vendor pricing pages (Groq console docs, OpenAI docs, Anthropic docs).
// Unknown models cost 0 (spec: "0 if unknown").
//
// GLM models: the default provider runs on the GLM Coding Plan (subscription,
// no per-token bill) and bigmodel.cn list prices were not verifiable at build
// time — both are logged as 0 rather than guessed (DECISIONS.md, WP-04).
import type { TokenUsage } from "./types";

export interface ModelPrice {
  inPerM: number;
  outPerM: number;
  /** where the number came from — kept next to the data so it never goes stale silently */
  source: string;
}

export const MODEL_PRICES: Record<string, ModelPrice> = {
  // Groq (console.groq.com/docs/models, 2026-10-27)
  "openai/gpt-oss-120b": { inPerM: 0.15, outPerM: 0.6, source: "groq docs 2026-10-27" },
  "openai/gpt-oss-20b": { inPerM: 0.075, outPerM: 0.3, source: "groq docs 2026-10-27" },
  // OpenAI (developers.openai.com/api/docs/pricing, 2026-10-27)
  "gpt-4o": { inPerM: 2.5, outPerM: 10, source: "openai docs 2026-10-27" },
  "gpt-4o-mini": { inPerM: 0.15, outPerM: 0.6, source: "openai docs 2026-10-27" },
  "gpt-4.1": { inPerM: 2, outPerM: 8, source: "openai docs 2026-10-27" },
  "gpt-4.1-mini": { inPerM: 0.4, outPerM: 1.6, source: "openai docs 2026-10-27" },
  // Anthropic (platform.claude.com docs pricing, 2026-10-27)
  "claude-sonnet-4-5": { inPerM: 3, outPerM: 15, source: "anthropic docs 2026-10-27" },
  "claude-haiku-4-5": { inPerM: 1, outPerM: 5, source: "anthropic docs 2026-10-27" },
  "claude-opus-4-5": { inPerM: 5, outPerM: 25, source: "anthropic docs 2026-10-27" },
};

export function priceFor(model: string): ModelPrice | null {
  return MODEL_PRICES[model] ?? null;
}

/** Estimated cost in USD for one call; 0 when the model has no verified price. */
export function estimateCost(model: string, usage?: TokenUsage): number {
  if (!usage) return 0;
  const p = priceFor(model);
  if (!p) return 0;
  return (usage.in * p.inPerM + usage.out * p.outPerM) / 1_000_000;
}
