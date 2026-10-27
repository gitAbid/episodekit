// §7.5/M12 tool execution core — framework-free, deps injected.
//
// Selection policy (mirrors the §8.1 call policy, scoped to tools):
//   provider chain (registry: app_settings → env → defaults; [primary, fallback])
//     → per provider: complete → extractJson → zod → ONE repair → quote-verify
//       → postchecks (religion gate + neverSay) → success
//   → any failure: deterministic output from lib/engine with the honest note.
//
// Quote integrity (§0.5): the model's `anchor`/`quote` fields are claims only.
// Each claim must be an exact quote of the transcript (normalizeQuoteStyle +
// isExactQuote); every failing claim is replaced by the deterministic pick, so
// the rendered result can never contain model-authored "quotes".
import { normalizeWs } from "@/lib/engine";
import { isExactQuote, normalizeQuoteStyle } from "@/lib/quotes/normalize";
import { DEFAULT_VOICE_PROFILE, type VoiceProfile } from "@/lib/ai/voice";
import { extractJson, repairPrompt } from "@/lib/ai/json";
import { scanContent } from "@/lib/ai/postcheck";
import { effectiveAiSelection, type AppSettingsStore } from "@/lib/ai/settings";
import { buildProviderChain } from "@/lib/ai/registry";
import { estimateCost } from "@/lib/ai/prices";
import type { AttemptError, LlmProvider } from "@/lib/ai/types";
import type { UsageEvent, UsageLogger } from "@/lib/ai/usage";
import { analyzeTranscript, buildDiscussionKit, buildEmailSeries } from "@/lib/engine";
import type { ToolId } from "./defs";
import { buildToolPrompt } from "./prompts";
import {
  DiscussionAiSchema,
  EmailSeriesAiSchema,
  ShowNotesAiSchema,
  TitlesAiSchema,
  type DiscussionAi,
  type DiscussionResult,
  type EmailSeriesAi,
  type EmailSeriesResult,
  type ShowNotesAi,
  type ShowNotesResult,
  type TitlesAi,
  type TitlesResult,
} from "./schemas";
import { deterministicToolResult } from "./deterministic";

export const FREE_TOOL_MAX_WORDS = 15_000;
export const FREE_TOOL_MIN_WORDS = 80;

/** §6 fallback banner, verbatim — the honest note the tools show. */
export const FALLBACK_NOTE = "Basic version — our AI writer was unavailable. Regenerate when you're ready.";
export const CAP_NOTE = "Today's free AI budget is used up — this version is built without AI.";

export interface FreeToolDeps {
  /** provider chain override (tests); skips the registry */
  chain?: LlmProvider[];
  selection?: Awaited<ReturnType<typeof effectiveAiSelection>>["selection"];
  store?: AppSettingsStore | null;
  usage?: UsageLogger | null;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  /** disable AI entirely (cap already exceeded); straight to deterministic */
  aiDisabled?: boolean;
}

export interface FreeToolRun {
  tool: ToolId;
  mode: "ai" | "deterministic";
  /** honest note when mode = deterministic; null for AI output */
  note: string | null;
  result: ShowNotesResult | TitlesResult | EmailSeriesResult | DiscussionResult;
  provider: string | null;
  model: string | null;
  costUsd: number;
  attempts: AttemptError[];
}

export interface ToolInputCheck {
  ok: boolean;
  code?: "too_short" | "too_long" | "not_enough_sentences";
  wordCount: number;
}

export function checkToolInput(text: string): ToolInputCheck {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < FREE_TOOL_MIN_WORDS) return { ok: false, code: "too_short", wordCount };
  if (wordCount > FREE_TOOL_MAX_WORDS) return { ok: false, code: "too_long", wordCount };
  const sents = analyzeTranscript(text).sents;
  if (sents.length < 2) return { ok: false, code: "not_enough_sentences", wordCount };
  return { ok: true, wordCount };
}

// ---- verbatim verification ---------------------------------------------------

/** A claim qualifies only when it is an exact (style-normalized) transcript quote. */
export function verbatimOrNothing(claim: string, source: string): string | null {
  const normalized = normalizeQuoteStyle(claim).trim();
  if (!normalized || !isExactQuote(normalized, normalizeWs(source))) return null;
  return normalized;
}

// ---- per-tool AI post-processing ----------------------------------------------

function finishShowNotes(ai: ShowNotesAi, source: string): ShowNotesResult {
  const a = analyzeTranscript(source);
  return {
    title: ai.title,
    hook: ai.hook,
    bullets: ai.bullets,
    quote: a.keyQuotes[0] ?? null,
    cta: ai.cta ?? "Invite listeners to follow the show.",
  };
}

function finishTitles(ai: TitlesAi, source: string): TitlesResult {
  const a = analyzeTranscript(source);
  const themes = ai.themes.length ? ai.themes.slice(0, 8) : a.themes.slice(0, 5);
  return { themes, titles: ai.titles };
}

function finishEmailSeries(ai: EmailSeriesAi, source: string): EmailSeriesResult {
  const a = analyzeTranscript(source);
  const deterministic = buildEmailSeries(a);
  const days = ai.days.map((d, i) => {
    const det = deterministic[i % deterministic.length];
    return {
      day: i + 1,
      title: d.title,
      anchor: verbatimOrNothing(d.anchor, source) ?? det.anchor,
      reflection: d.reflection,
      action: d.action,
      closing: d.closing,
    };
  });
  return { days };
}

function finishDiscussion(ai: DiscussionAi, source: string): DiscussionResult {
  const a = analyzeTranscript(source);
  const det = buildDiscussionKit(a);
  const qs = ai.qs.map((q, i) => ({
    quote: verbatimOrNothing(q.quote, source) ?? det.qs[i % det.qs.length].quote,
    follow: q.follow,
  }));
  return { title: ai.title, opener: ai.opener, open: ai.open, qs, apply: ai.apply, closing: ai.closing };
}

// ---- main ---------------------------------------------------------------------

const SCHEMAS = {
  ShowNotesAi: ShowNotesAiSchema,
  TitlesAi: TitlesAiSchema,
  EmailSeriesAi: EmailSeriesAiSchema,
  DiscussionAi: DiscussionAiSchema,
} as const;

function finish(tool: ToolId, parsed: unknown, source: string) {
  switch (tool) {
    case "show-notes":
      return finishShowNotes(ShowNotesAiSchema.parse(parsed), source);
    case "episode-titles":
      return finishTitles(TitlesAiSchema.parse(parsed), source);
    case "email-series":
      return finishEmailSeries(EmailSeriesAiSchema.parse(parsed), source);
    case "discussion-guide":
      return finishDiscussion(DiscussionAiSchema.parse(parsed), source);
  }
}

export async function runFreeTool(
  tool: ToolId,
  text: string,
  deps: FreeToolDeps = {},
): Promise<FreeToolRun> {
  const env = deps.env ?? process.env;
  const attempts: AttemptError[] = [];
  const usageLog = deps.usage ?? null;

  const finishDeterministic = (errorCode: string): FreeToolRun => ({
    tool,
    mode: "deterministic",
    note: FALLBACK_NOTE,
    result: deterministicToolResult(tool, text),
    provider: null,
    model: null,
    costUsd: 0,
    attempts: [...attempts, { provider: "-", code: errorCode, detail: "fell back to deterministic engine" }].slice(-4),
  });

  if (deps.aiDisabled) return finishDeterministic("ai_disabled");

  // ---- resolve chain (§8.1 order; skip when a chain override is injected) ----
  let chain: LlmProvider[];
  let model: string;
  if (deps.chain?.length) {
    chain = deps.chain;
    model = deps.selection?.fastModel ?? "fast";
  } else {
    const selection = deps.selection ?? (await effectiveAiSelection(deps.store ?? null, { env })).selection;
    chain = buildProviderChain(selection, {
      env,
      fetchImpl: deps.fetchImpl,
      sleep: deps.sleep,
      timeoutMs: deps.timeoutMs ?? 30_000,
      tier: "fast",
    });
    model = selection.fastModel;
  }

  const prompt = buildToolPrompt(tool, normalizeWs(text));
  const schema = SCHEMAS[prompt.schemaName];
  const voice: VoiceProfile = DEFAULT_VOICE_PROFILE;

  for (const provider of chain) {
    let parsed: unknown = null;
    let cost = 0;

    const call = async (user: string): Promise<string | null> => {
      try {
        const res = await provider.complete({
          system: prompt.system,
          user,
          model,
          json: true,
          temperature: prompt.temperature,
          maxTokens: 4_000,
        });
        if (res.usage) {
          cost += estimateCost(model, res.usage);
          const event: UsageEvent = {
            workspaceId: null,
            episodeId: null,
            kind: "free_tool",
            provider: provider.id,
            model,
            units: res.usage.in + res.usage.out,
            costUsd: estimateCost(model, res.usage),
          };
          try {
            await usageLog?.(event);
          } catch (err) {
            console.error("usage logger failed:", err);
          }
        }
        return res.text;
      } catch (err) {
        attempts.push({ provider: provider.id, code: codeOf(err), detail: String(err).slice(0, 200) });
        return null;
      }
    };

    const raw = await call(prompt.user);
    if (raw == null) continue;
    parsed = extractJson(raw);

    let validation = schema.safeParse(parsed);
    if (!validation.success) {
      // ONE repair call (§8.1), same provider
      const problem = parsed ? "it did not match the required schema" : "it was not valid JSON";
      const repaired = await call(
        repairPrompt(prompt.user, JSON.stringify(schemaHint(tool)), problem),
      );
      if (repaired != null) {
        parsed = extractJson(repaired);
        validation = schema.safeParse(parsed);
      }
    }
    if (!validation.success) {
      attempts.push({ provider: provider.id, code: "invalid_json", detail: "tool schema mismatch" });
      continue;
    }

    // post-checks (§8.4): religion gate on generated framing, neverSay scan.
    // A violation is not repairable here (no second regenerate on tools) —
    // the provider is done and the deterministic path takes over.
    const violations = scanContent(parsed, voice);
    if (violations.religion.length || violations.neverSay.length) {
      attempts.push({
        provider: provider.id,
        code: violations.religion.length ? "religion_gate" : "never_say",
        detail: [...violations.religion, ...violations.neverSay].join(",").slice(0, 200),
      });
      continue;
    }

    try {
      const result = finish(tool, parsed, text);
      return {
        tool,
        mode: "ai",
        note: null,
        result,
        provider: provider.id,
        model,
        costUsd: cost,
        attempts,
      };
    } catch {
      attempts.push({ provider: provider.id, code: "invalid_json", detail: "post-processing failed" });
      continue;
    }
  }

  return finishDeterministic(attempts.length ? "all_providers_failed" : "no_provider");
}

function schemaHint(tool: ToolId): Record<string, unknown> {
  switch (tool) {
    case "show-notes":
      return { title: "string", hook: "string", bullets: ["string x4-7"], cta: "string?" };
    case "episode-titles":
      return { themes: ["string x3-8"], titles: [{ text: "string", style: "Curiosity|Benefit|Guest|Number|Question|Quote" }] };
    case "email-series":
      return { days: [{ title: "string", anchor: "exact transcript sentence", reflection: "string", action: "string", closing: "string" }] };
    case "discussion-guide":
      return { title: "string", opener: "string", open: ["string x2-4"], qs: [{ quote: "exact transcript sentence", follow: "string" }], apply: ["string", "string"], closing: "string" };
  }
}

function codeOf(err: unknown): string {
  const e = err as { code?: string; name?: string };
  return e?.code || e?.name || "provider_failed";
}
