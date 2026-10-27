// §8.1 call policy, one artifact at a time (weak-model hardening: one artifact
// per call):
//
//   primary provider (60 s timeout, 1 retry on 429/5xx with 2 s backoff)
//     → fallback provider
//       → deterministic builder (lib/engine) with status "fallback"
//
// JSON handling: response_format json_object where supported (adapter), Zod
// validation (§7.2 schemas), ONE repair call, then the next provider.
// Quote claims are resolved to verbatim offsets via lib/quotes (§7.3) BEFORE
// validation — model quote text is never stored or displayed.
// Post-checks (§8.4, U8): neverSay scan → one regenerate with feedback →
// phrase replacement; religion-neutral gate on generated framing → regenerate
// with feedback → next provider (never phrase-replace, never applied to
// transcript quotes); foreign URLs stripped deterministically throughout.
import { ARTIFACT_KINDS, ArtifactContentSchema, artifactContentSchema, type ArtifactKind } from "@/lib/artifacts/schemas";
import { candidateQuoteRefs } from "@/lib/quotes/candidates";
import { resolveQuotes, type QuoteRef, type Segment } from "@/lib/quotes";
import {
  buildArtifactPrompt,
  PROMPT_VERSION,
  type EpisodeMeta,
  type PromptContext,
  type ShowContext,
} from "@/lib/prompts";
import type { VoiceProfile } from "./voice";
import { extractJson, repairPrompt } from "./json";
import {
  applyDeterministicPostChecks,
  scanContent,
  stripForeignUrlsInContent,
  type ContentViolations,
} from "./postcheck";
import { buildDeterministicArtifact } from "./fallback";
import { buildProviderChain, modelFor } from "./registry";
import { estimateCost } from "./prices";
import { effectiveAiSelection, type AiSelection, type AppSettingsStore } from "./settings";
import type { AttemptError, LlmProvider } from "./types";
import type { UsageEvent, UsageLogger } from "./usage";

export interface GenerateDeps {
  /** full provider chain override (tests, admin test path) */
  chain?: LlmProvider[];
  /** explicit selection (skips the store) */
  selection?: AiSelection;
  /** app_settings store — the first place the selection is read from */
  store?: AppSettingsStore | null;
  /** usage_events logger (§7.1); WP-02 wires the DB-backed logger */
  usage?: UsageLogger | null;
  workspaceId?: string | null;
  episodeId?: string | null;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
}

export interface GenerateInput {
  kind: ArtifactKind;
  segments: Segment[];
  show: ShowContext;
  voice: VoiceProfile;
  voiceSamples?: string[];
  meta?: EpisodeMeta;
  /** regenerate instruction (≤200 chars) */
  instruction?: string;
  /** analysis.candidate_quotes — computed from segments when absent */
  analysisCandidates?: QuoteRef[];
  deps?: GenerateDeps;
}

export interface GenerateResult {
  kind: ArtifactKind;
  content: unknown;
  status: "ai" | "fallback";
  provider: string | null;
  model: string | null;
  errorCode: string | null;
  truncated: boolean;
  regenerated: boolean;
  usage: { in: number; out: number } | null;
  costUsd: number;
  promptVersion: string;
  attempts: AttemptError[];
}

const QUOTE_KIND_COUNTS: Partial<Record<ArtifactKind, { field: "items" | "quoteRefs"; count: number }>> = {
  quotes: { field: "items", count: 5 },
  show_notes: { field: "quoteRefs", count: 1 },
  blog: { field: "quoteRefs", count: 2 },
  newsletter: { field: "quoteRefs", count: 1 },
};

/** §7.3 steps 2–3: turn model quote claims into verbatim offsets, in place. */
function resolveModelQuotes(
  content: Record<string, unknown>,
  kind: ArtifactKind,
  segments: Segment[],
  candidates: QuoteRef[],
): void {
  const spec = QUOTE_KIND_COUNTS[kind];
  if (!spec) return;
  content[spec.field] = resolveQuotes(content[spec.field], segments, {
    count: spec.count,
    candidates,
  }).quotes;
}

function hasViolations(v: ContentViolations): boolean {
  return v.neverSay.length > 0 || v.religion.length > 0;
}

function violationFeedback(v: ContentViolations): string {
  const parts: string[] = [];
  if (v.neverSay.length) parts.push(`banned words/phrases: ${v.neverSay.join(", ")}`);
  if (v.religion.length) parts.push(`religion-specific framing terms: ${v.religion.join(", ")}`);
  return (
    `Your previous draft used ${parts.join(" and ")}. Those terms must not appear in any form. ` +
    `Rewrite and return the full corrected JSON — same schema, none of those words.`
  );
}

export async function generateArtifact(input: GenerateInput): Promise<GenerateResult> {
  const { kind, segments, show, voice } = input;
  const deps = input.deps ?? {};
  const env = deps.env ?? process.env;

  // ---- selection + chain (§8.1 order: app_settings.ai → env → defaults) ----
  let chain: LlmProvider[];
  let model: string;
  if (deps.chain?.length) {
    chain = deps.chain;
    model = modelFor(
      deps.selection ?? (await effectiveAiSelection(null, { env })).selection,
      "long",
    );
  } else {
    const selection = deps.selection ?? (await effectiveAiSelection(deps.store ?? null, { env })).selection;
    chain = buildProviderChain(selection, {
      env,
      fetchImpl: deps.fetchImpl,
      sleep: deps.sleep,
      timeoutMs: deps.timeoutMs,
    });
    model = modelFor(selection, "long");
  }

  // ---- chapters need timestamps (M4: chapters only when timestamps exist) --
  if (kind === "chapters" && !segments.some((s) => s.startMs !== null)) {
    return fallbackResult(input, [], "no_timestamps", false);
  }

  // ---- prompt (§8.2) --------------------------------------------------------
  const promptCtx: PromptContext = {
    show,
    voice,
    voiceSamples: input.voiceSamples,
    meta: input.meta,
    segments,
    instruction: input.instruction,
  };
  const prompt = buildArtifactPrompt(kind, promptCtx);
  const schema = artifactContentSchema(kind);
  const candidates = input.analysisCandidates ?? candidateQuoteRefs(segments);
  const attempts: AttemptError[] = [];

  let totalUsage: { in: number; out: number } | null = null;
  let totalCost = 0;
  const usageLog = deps.usage ?? null;

  const recordUsage = async (
    provider: LlmProvider,
    usedModel: string,
    u: { in: number; out: number } | undefined,
  ): Promise<void> => {
    if (!u) return;
    totalUsage = { in: (totalUsage?.in ?? 0) + u.in, out: (totalUsage?.out ?? 0) + u.out };
    const cost = estimateCost(usedModel, u);
    totalCost += cost;
    if (!usageLog) return;
    const event: UsageEvent = {
      workspaceId: deps.workspaceId ?? null,
      episodeId: deps.episodeId ?? null,
      kind: "llm",
      provider: provider.id,
      model: usedModel,
      units: u.in + u.out,
      costUsd: cost,
    };
    try {
      await usageLog(event); // logger failures must never fail generation
    } catch (err) {
      console.error("usage logger failed:", err);
    }
  };

  const baseResult = (provider: LlmProvider, content: unknown, regenerated: boolean): GenerateResult => ({
    kind,
    content,
    status: "ai",
    provider: provider.id,
    model: model || provider.id,
    errorCode: null,
    truncated: prompt.truncated,
    regenerated,
    usage: totalUsage,
    costUsd: totalCost,
    promptVersion: PROMPT_VERSION,
    attempts,
  });

  const buildRequest = (user: string) => ({
    system: prompt.system,
    user,
    model: model,
    json: true,
    temperature: prompt.temperature,
  });

  for (const provider of chain) {
    // 1st attempt — the adapters apply timeout + 1 retry on 429/5xx internally.
    let text: string;
    try {
      const res = await provider.complete(buildRequest(prompt.user));
      await recordUsage(provider, model, res.usage);
      text = res.text;
    } catch (err) {
      attempts.push({ provider: provider.id, code: codeOf(err), detail: String(err).slice(0, 300) });
      continue;
    }

    // parse + resolve quotes + validate (Zod §7.2)
    let parsed = asObject(extractJson(text));
    if (parsed) resolveModelQuotes(parsed, kind, segments, candidates);
    let validation = schema.safeParse(parsed);

    // ONE repair call (§8.1), same provider
    if (!validation.success) {
      const problem = parsed ? "it did not match the required schema" : "it was not valid JSON";
      try {
        const repair = await provider.complete(
          buildRequest(repairPrompt(prompt.user, JSON.stringify(schemaHint(kind)), problem)),
        );
        await recordUsage(provider, model, repair.usage);
        const reparsed = asObject(extractJson(repair.text));
        if (reparsed) {
          resolveModelQuotes(reparsed, kind, segments, candidates);
          const v2 = schema.safeParse(reparsed);
          if (v2.success) {
            parsed = reparsed;
            validation = v2;
          }
        }
      } catch (err) {
        attempts.push({ provider: provider.id, code: codeOf(err), detail: String(err).slice(0, 300) });
        continue;
      }
    }

    if (!validation.success) {
      attempts.push({ provider: provider.id, code: "invalid_json", detail: zodDetail(validation.error) });
      continue;
    }

    // ---- post-checks (§8.4) -------------------------------------------------
    let content = parsed as Record<string, unknown>;
    let violations = scanContent(content, voice);
    let regenerated = false;

    if (hasViolations(violations)) {
      // one regenerate with feedback
      try {
        const res = await provider.complete(buildRequest(prompt.user + `\n\n${violationFeedback(violations)}`));
        await recordUsage(provider, model, res.usage);
        const retry = asObject(extractJson(res.text));
        if (!retry) {
          attempts.push({ provider: provider.id, code: "invalid_json", detail: "postcheck regen unparseable" });
          continue;
        }
        resolveModelQuotes(retry, kind, segments, candidates);
        content = retry;
        regenerated = true;
      } catch (err) {
        attempts.push({ provider: provider.id, code: codeOf(err), detail: String(err).slice(0, 300) });
        continue;
      }

      violations = scanContent(content, voice);
      // religion framing that still violates is NOT phrase-replaceable — the
      // gate applies to generated framing only (§8.4); this provider is done.
      if (violations.religion.length) {
        attempts.push({ provider: provider.id, code: "religion_gate", detail: violations.religion.join(",") });
        continue;
      }
      // neverSay leftovers are replaced deterministically (U8 last resort)
      if (violations.neverSay.length) {
        content = applyDeterministicPostChecks(content, voice, show.allowedUrls ?? []);
      }
    }

    const cleaned = stripForeignUrlsInContent(content, show.allowedUrls ?? []);
    const final = schema.safeParse(cleaned);
    if (!final.success) {
      attempts.push({ provider: provider.id, code: "postcheck_invalid", detail: zodDetail(final.error) });
      continue;
    }
    return baseResult(provider, final.data, regenerated);
  }

  return fallbackResult(input, attempts, "all_providers_failed", prompt.truncated);
}

// ---- helpers ----------------------------------------------------------------

function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function zodDetail(error: { issues: Array<{ path: PropertyKey[]; message: string }> }): string {
  return error.issues
    .slice(0, 3)
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ");
}

function codeOf(err: unknown): string {
  const e = err as { code?: string; name?: string };
  return e?.code || e?.name || "provider_failed";
}

/** Compact inline shape for the repair prompt (flat, weak-model friendly). */
function schemaHint(kind: ArtifactKind): Record<string, unknown> {
  const shapes: Record<ArtifactKind, Record<string, unknown>> = {
    show_notes: { hook: "string", bullets: ["string x4-7"], guestLine: "string?", quoteRefs: [{ segmentId: "string", exact: "string" }], cta: "string" },
    chapters: { items: [{ startMs: 0, title: "string ≤50" }] },
    summary: { oneLiner: "string ≤140", short: "string", long: "string" },
    titles: { items: [{ text: "string ≤80", style: "Curiosity|Benefit|Guest|Number|Question|Quote", starred: false }] },
    blog: { seoTitle: "string ≤60", metaDescription: "string ≤155", slug: "string", bodyMarkdown: "string", quoteRefs: [{ segmentId: "string", exact: "string" }] },
    newsletter: { subjects: ["s1", "s2", "s3"], chosen: 0, previewText: "string ≤90", bodyMarkdown: "string", quoteRefs: [{ segmentId: "string", exact: "string" }], ctaText: "string ≤30" },
    social: { linkedin: "string ≤1300", thread: ["≤280 x4-6"], instagram: { caption: "string ≤2200", hashtags: ["#tag x5-10"] } },
    quotes: { items: [{ segmentId: "string", exact: "string" }] },
  };
  return shapes[kind];
}

function fallbackResult(
  input: GenerateInput,
  attempts: AttemptError[],
  errorCode: string,
  truncated: boolean,
): GenerateResult {
  return {
    kind: input.kind,
    content: buildDeterministicArtifact(input.kind, {
      segments: input.segments,
      show: input.show,
      meta: input.meta,
    }),
    status: "fallback",
    provider: null,
    model: null,
    errorCode,
    truncated,
    regenerated: false,
    usage: null,
    costUsd: 0,
    promptVersion: PROMPT_VERSION,
    attempts,
  };
}

// re-exported so WP-06 has one import site for the §7.2 schema map
export { ARTIFACT_KINDS, ArtifactContentSchema };
