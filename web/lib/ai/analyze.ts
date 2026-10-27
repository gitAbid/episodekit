// §7.5 POST /api/episodes/:id/analyze — topics, candidate quotes, chapters
// (fast model). Mirrors generateArtifact's call policy (§8.1: chain → one
// repair → deterministic fallback); candidate quotes are ALWAYS resolved to
// verbatim QuoteRef offsets (§7.3) — model text is never stored as a quote.
import { z } from "zod";
import { AnalyzeResultSchema, buildAnalyzePrompt } from "@/lib/prompts/analyze";
import type { PromptContext } from "@/lib/prompts";
import { DEFAULT_VOICE_PROFILE } from "@/lib/ai/voice";
import { analyzeTranscript } from "@/lib/engine";
import { candidateQuoteRefs } from "@/lib/quotes/candidates";
import { resolveQuotes } from "@/lib/quotes/resolve";
import type { QuoteRef, Segment } from "@/lib/quotes/types";
import { buildProviderChain, modelFor } from "@/lib/ai/registry";
import { effectiveAiSelection } from "@/lib/ai/settings";
import { extractJson, repairPrompt } from "@/lib/ai/json";
import type { AppSettingsStore } from "@/lib/ai/settings";
import type { LlmProvider } from "@/lib/ai/types";

export interface AnalyzeDeps {
  chain?: LlmProvider[];
  store?: AppSettingsStore | null;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
}

export interface AnalyzeInput {
  segments: Segment[];
  hasTimestamps: boolean;
  show: { name: string };
  deps?: AnalyzeDeps;
}

export interface AnalyzeOutput {
  topics: string[];
  candidateQuotes: QuoteRef[];
  chapters: { startMs: number; title: string }[] | null;
  status: "ai" | "fallback";
  provider: string | null;
  model: string | null;
}

/** Deterministic chapters from segment timestamps (§7.2: 5–12, ≥2 min apart, first at 0). */
function deterministicChapters(segments: Segment[]): { startMs: number; title: string }[] | null {
  const timed = segments.filter((s) => typeof s.startMs === "number");
  if (timed.length === 0) return null;
  const last = timed[timed.length - 1];
  const endMs = typeof last.endMs === "number" ? last.endMs : (last.startMs ?? 0);
  if (endMs < 6 * 60_000) return null; // too short to split honestly into 5
  const step = Math.max(endMs / 8, 2 * 60_000);
  const out: { startMs: number; title: string }[] = [];
  for (let t = 0; t <= endMs - 2 * 60_000 && out.length < 12; t === 0 ? (t = step) : (t += step)) {
    const seg = timed.find((s) => (s.startMs ?? 0) <= t && (s.endMs ?? 0) > t) ?? timed[0];
    if (!seg) continue;
    const title = seg.text.split(/\s+/).slice(0, 7).join(" ").slice(0, 50).trim();
    if (title) out.push({ startMs: t, title });
  }
  return out.length >= 5 ? out : null;
}

export function deterministicAnalyze(segments: Segment[]): AnalyzeOutput {
  const a = analyzeTranscript(segments.map((s) => s.text).join(" "));
  return {
    topics: a.themes.slice(0, 10).map((t) => t.slice(0, 40)),
    candidateQuotes: candidateQuoteRefs(segments, { count: 12 }),
    chapters: deterministicChapters(segments),
    status: "fallback",
    provider: null,
    model: null,
  };
}

function asObject(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export async function runAnalyze(input: AnalyzeInput): Promise<AnalyzeOutput> {
  const { segments, hasTimestamps, show } = input;
  const deps = input.deps ?? {};
  const env = deps.env ?? process.env;
  const fb = deterministicAnalyze(segments);
  if (segments.length === 0) return fb;

  const ctx: PromptContext = {
    show: { name: show.name },
    voice: DEFAULT_VOICE_PROFILE,
    segments,
  };
  const prompt = buildAnalyzePrompt(ctx);

  let chain: LlmProvider[];
  let model: string;
  if (deps.chain?.length) {
    chain = deps.chain;
    model = modelFor((await effectiveAiSelection(null, { env })).selection, "fast");
  } else {
    const selection = (await effectiveAiSelection(deps.store ?? null, { env })).selection;
    chain = buildProviderChain(selection, {
      env,
      fetchImpl: deps.fetchImpl,
      sleep: deps.sleep,
      timeoutMs: deps.timeoutMs,
    });
    model = modelFor(selection, "fast");
  }

  const schemaHint = JSON.stringify(
    z.toJSONSchema ? z.toJSONSchema(AnalyzeResultSchema) : AnalyzeResultSchema,
  );

  for (const provider of chain) {
    try {
      let parsed = asObject(extractJson((await provider.complete({ system: prompt.system, user: prompt.user, model, json: true, temperature: 0.2 })).text));
      let validation = AnalyzeResultSchema.safeParse(parsed);
      if (!validation.success) {
        const problem = parsed ? "it did not match the required schema" : "it was not valid JSON";
        const repair = await provider.complete({
          system: prompt.system,
          user: repairPrompt(prompt.user, schemaHint, problem),
          model,
          json: true,
          temperature: 0.2,
        });
        const reparsed = asObject(extractJson(repair.text));
        if (reparsed) {
          const v2 = AnalyzeResultSchema.safeParse(reparsed);
          if (v2.success) {
            parsed = reparsed;
            validation = v2;
          }
        }
      }
      if (!validation.success) continue;
      const value = validation.data;

      const resolved = resolveQuotes(
        value.candidateQuotes.map((c: { segmentId: string; exact: string }) => ({ segmentId: c.segmentId, exact: c.exact })),
        segments,
        { count: 12, candidates: fb.candidateQuotes },
      ).quotes;

      const chapters =
        hasTimestamps && value.chapters && value.chapters.length >= 5
          ? value.chapters.slice(0, 12).map((c) => ({ startMs: c.startMs, title: c.title.slice(0, 50) }))
          : hasTimestamps
            ? fb.chapters
            : null;

      return {
        topics: value.topics,
        candidateQuotes: resolved.length > 0 ? resolved : fb.candidateQuotes,
        chapters,
        status: "ai",
        provider: provider.id,
        model,
      };
    } catch {
      continue; // next provider in the chain (§8.1)
    }
  }
  return fb;
}
