// §8.2 prompts. Shared system prompt (verbatim skeleton from the spec with
// show/voice substitutions), the per-artifact user-prompt assembly, and the
// transcript budget rule.
//
// Weak-model hardening (GLM/Groq): low temperature (0.4 long, 0.2 analyze),
// flat schemas, one artifact per call, JSON shape examples inline.
import type { z } from "zod";
import type { ArtifactKind } from "@/lib/artifacts/schemas";
import { rankedSentences, sentences, themes, normalizeWs } from "@/lib/engine";
import { formatTranscriptLines } from "@/lib/quotes/format";
import type { Segment } from "@/lib/quotes/types";
import type { VoiceProfile } from "@/lib/ai/voice";
import { buildShowNotesPrompt } from "./show-notes";
import { buildChaptersPrompt } from "./chapters";
import { buildSummaryPrompt } from "./summary";
import { buildTitlesPrompt } from "./titles";
import { buildBlogPrompt } from "./blog";
import { buildNewsletterPrompt } from "./newsletter";
import { buildSocialPrompt } from "./social";
import { buildQuotesPrompt } from "./quotes";

/** Bump when prompt text or rules change; recorded on generation results. */
export const PROMPT_VERSION = "2026-10-27.1";

export const TEMPERATURE_LONG = 0.4;
export const TEMPERATURE_ANALYZE = 0.2;

// ---- transcript budget (§8.2) -----------------------------------------------

/** ~60k tokens, estimated at 4 chars/token. */
export const TRANSCRIPT_TOKEN_BUDGET = 60_000;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface BudgetedTranscript {
  lines: string[];
  truncated: boolean;
}

/**
 * Budget rule (§8.2): if the transcript exceeds ~60k tokens, keep the first
 * 40% of lines + the last 20% + top-ranked middle segments (engine
 * `rankedSentences`) until the budget is filled. Always records `truncated`.
 */
export function budgetTranscriptLines(
  lines: string[],
  opts?: { maxTokens?: number; ranked?: Array<{ s: string; i: number }> },
): BudgetedTranscript {
  const maxTokens = opts?.maxTokens ?? TRANSCRIPT_TOKEN_BUDGET;
  const full = lines.join("\n");
  if (estimateTokens(full) <= maxTokens) return { lines, truncated: false };

  const headCount = Math.floor(lines.length * 0.4);
  const tailCount = Math.floor(lines.length * 0.2);
  const head = lines.slice(0, headCount);
  const tail = lines.slice(lines.length - tailCount);
  const middle = lines.slice(headCount, lines.length - tailCount);

  const headPart = [...head];
  // extreme edge first: head+tail alone exceed the budget — shrink the head
  // from its END (the episode opening always survives)
  while (headPart.length > 1 && estimateTokens([...headPart, ...tail].join("\n")) > maxTokens) {
    headPart.pop();
  }
  const kept = [...headPart, ...tail];
  let budget = maxTokens - estimateTokens(kept.join("\n"));

  if (budget > 0 && middle.length) {
    const middleSet = new Set(middle);
    const ranked = opts?.ranked
      ? opts.ranked.filter((r) => middleSet.has(r.s))
      : rankLines(middle).map((r) => ({ s: r.s, i: r.i }));
    const picked: string[] = [];
    for (const r of ranked) {
      const cost = estimateTokens(r.s + "\n");
      if (cost > budget) continue;
      picked.push(r.s);
      budget -= cost;
    }
    // keep episode order: middle lines in original sequence
    const pickedSet = new Set(picked);
    kept.splice(headPart.length, 0, ...middle.filter((l) => pickedSet.has(l)));
  }

  return { lines: kept, truncated: true };
}

function rankLines(lines: string[]): Array<{ s: string; i: number; score: number }> {
  const text = normalizeWs(lines.join(" "));
  const th = themes(text, 10).filter((t) => t.length >= 5);
  return rankedSentences(sentences(text), th);
}

// ---- context ----------------------------------------------------------------

export interface ShowContext {
  name: string;
  defaultCta?: string | null;
  /** URLs the show may reference; foreign links are stripped post-generation */
  allowedUrls?: string[];
  vocabulary?: string[];
}

export interface EpisodeMeta {
  title?: string | null;
  number?: number | null;
  guests?: string[];
}

export interface PromptContext {
  show: ShowContext;
  voice: VoiceProfile;
  /** 1–3 past show notes; ≤2 samples, ≤400 words each make it into the prompt */
  voiceSamples?: string[];
  meta?: EpisodeMeta;
  segments: Segment[];
  /** regenerate instruction (≤200 chars) */
  instruction?: string;
}

// ---- shared system prompt (§8.2, verbatim skeleton) -------------------------

function fmtList(list: readonly string[]): string {
  return list.length ? list.join(", ") : "none";
}

export function buildSystemPrompt(show: ShowContext, voice: VoiceProfile): string {
  return [
    `You write podcast content for the show "${show.name}". Match the show's voice: tone ${voice.tone.join(", ")};`,
    `formality ${voice.formality}/5; energy ${voice.energy}/5; humor ${voice.humor}/5; write as "${voice.person}"; ${voice.sentenceLength}`,
    `sentences; emoji: ${voice.emoji}. You may use these phrases sparingly: ${fmtList(voice.signaturePhrases)}.`,
    `Never use: ${fmtList(voice.neverSay)}. Include where natural: ${fmtList(voice.alwaysInclude)}.`,
    `Use only facts from the transcript. Never invent names, numbers, links or claims.`,
    `To quote, return {"segmentId": "...", "exact": "..."} with text copied character-for-character`,
    `from that segment. Anything not copied exactly is discarded.`,
    `Return only JSON matching the schema below.`,
  ].join("\n");
}

// ---- user prompt assembly (§8.2) --------------------------------------------

const MAX_SAMPLES = 2;
const MAX_SAMPLE_WORDS = 400;

function clipWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  return words.length <= maxWords ? text : words.slice(0, maxWords).join(" ");
}

export interface AssembledPrompt {
  user: string;
  truncated: boolean;
}

export function assembleUserPrompt(parts: {
  rules: string;
  schemaExample: string;
  ctx: PromptContext;
  maxTokens?: number;
}): AssembledPrompt {
  const { rules, schemaExample, ctx } = parts;
  const blocks: string[] = [rules.trim(), `JSON schema:\n${schemaExample.trim()}`];

  const meta: string[] = [];
  if (ctx.meta?.title) meta.push(`Episode title: ${ctx.meta.title}`);
  if (ctx.meta?.number != null) meta.push(`Episode number: ${ctx.meta.number}`);
  if (ctx.meta?.guests?.length) meta.push(`Guests: ${ctx.meta.guests.join(", ")}`);
  if (ctx.show.defaultCta) meta.push(`Show CTA: ${ctx.show.defaultCta}`);
  if (ctx.show.vocabulary?.length) meta.push(`Vocabulary (spell exactly): ${ctx.show.vocabulary.join(", ")}`);
  if (meta.length) blocks.push(meta.join("\n"));

  const samples = (ctx.voiceSamples ?? []).slice(0, MAX_SAMPLES).map((s) => clipWords(s.trim(), MAX_SAMPLE_WORDS));
  if (samples.length) {
    blocks.push(
      samples
        .map((s, i) => `Style reference ${i + 1} — style reference only (do not copy content):\n${s}`)
        .join("\n\n"),
    );
  }

  if (ctx.instruction) {
    blocks.push(`Additional instruction from the user (follow it): ${ctx.instruction.trim()}`);
  }

  let truncated = false;
  if (ctx.segments.length) {
    const numbered = formatTranscriptLines(ctx.segments);
    const budget = budgetTranscriptLines(numbered.split("\n"), { maxTokens: parts.maxTokens });
    blocks.push(`TRANSCRIPT:\n${budget.lines.join("\n")}`);
    truncated = budget.truncated;
  }

  return { user: blocks.join("\n\n"), truncated };
}

// ---- per-artifact dispatch --------------------------------------------------

export interface ArtifactPrompt {
  system: string;
  user: string;
  /** zod schema the parsed JSON must satisfy */
  schema: z.ZodTypeAny;
  temperature: number;
  tier: "long" | "fast";
  truncated: boolean;
}

interface BuiltPrompt {
  user: string;
  /** zod schema the parsed JSON must satisfy (§7.2 shape for this kind) */
  schema: z.ZodTypeAny;
  temperature: number;
  tier: "long" | "fast";
  truncated?: boolean;
}
type PromptBuilder = (ctx: PromptContext) => BuiltPrompt;

function builderFor(kind: ArtifactKind): PromptBuilder {
  const map: Record<ArtifactKind, PromptBuilder> = {
    show_notes: buildShowNotesPrompt,
    chapters: buildChaptersPrompt,
    summary: buildSummaryPrompt,
    titles: buildTitlesPrompt,
    blog: buildBlogPrompt,
    newsletter: buildNewsletterPrompt,
    social: buildSocialPrompt,
    quotes: buildQuotesPrompt,
  };
  return map[kind];
}

export function buildArtifactPrompt(kind: ArtifactKind, ctx: PromptContext): ArtifactPrompt {
  const built = builderFor(kind)(ctx);
  return {
    system: buildSystemPrompt(ctx.show, ctx.voice),
    user: built.user,
    schema: built.schema,
    temperature: built.temperature,
    tier: built.tier,
    truncated: built.truncated ?? false,
  };
}
