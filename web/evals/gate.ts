// WP-10 eval gate (04-work-packages.md): runs the FULL generation pipeline
// over every transcript in evals/transcripts/ and checks the deterministic
// gates. The LLM-judge gate needs a live second provider (different from the
// generator) — with no valid AI keys configured it is reported as BLOCKED,
// never faked. Import from vitest (tests/eval/gate.test.ts) or via `pnpm eval`.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseTranscript } from "@/lib/transcripts";
import { generateArtifact } from "@/lib/ai/generate";
import { ARTIFACT_KINDS, artifactContentSchema, type ArtifactKind } from "@/lib/artifacts/schemas";
import { religionViolations } from "@/lib/artifacts/postcheck";
import { DEFAULT_VOICE_PROFILE } from "@/lib/ai/voice";
import type { Segment } from "@/lib/quotes/types";

export interface EpisodeFixture {
  name: string;
  segments: Segment[];
  hasTimestamps: boolean;
}

export function loadFixtures(dir: string): EpisodeFixture[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".txt") && f !== "README.md")
    .map((f) => {
      const text = readFileSync(join(dir, f), "utf8");
      const parsed = parseTranscript(text);
      return {
        name: f.replace(/\.txt$/, ""),
        segments: parsed.segments.map((s, idx) => ({ id: `seg_${String(idx).padStart(6, "0")}`, idx, speaker: s.speaker ?? null, startMs: s.startMs ?? null, endMs: s.endMs ?? null, text: s.text })),
        hasTimestamps: parsed.hasTimestamps,
      };
    });
}

export interface GateResult {
  fixture: string;
  kind: ArtifactKind;
  ok: boolean;
  status: "ai" | "fallback";
  durationMs: number;
  costUsd: number;
  schemaValid: boolean;
  quoteIntegrity: boolean;
  bannedWords: string[];
}

/**
 * Limit compliance for deterministic fallback packages: caps only (§7.2
 * maxima). Fallback content is deliberately not padded to AI minima
 * (DECISIONS.md WP-03/WP-04: honesty beats schema padding), so the gate holds
 * it to the limits that matter for publishing, not the AI counts.
 */
const CAPS: Record<string, (c: Record<string, unknown>) => boolean> = {
  show_notes: (c) => String(c.hook ?? "").length <= 600 && (Array.isArray(c.bullets) ? c.bullets.length <= 7 : true),
  chapters: (c) => (Array.isArray(c.items) ? c.items.every((i) => String((i as { title: string }).title).length <= 50) : true),
  summary: (c) => String(c.oneLiner ?? "").length <= 140,
  titles: (c) => (Array.isArray(c.items) ? c.items.every((i) => String((i as { text: string }).text).length <= 80) : true),
  blog: (c) => String(c.seoTitle ?? "").length <= 60 && String(c.metaDescription ?? "").length <= 155,
  newsletter: (c) => String(c.previewText ?? "").length <= 90 && String(c.ctaText ?? "").length <= 30,
  social: (c) =>
    String(c.linkedin ?? "").length <= 1300 &&
    (Array.isArray(c.thread) ? c.thread.every((p) => String(p).length <= 280) : true) &&
    String((c.instagram as { caption?: string } | undefined)?.caption ?? "").length <= 2200,
  quotes: () => true,
};

export interface GateSummary {
  fixtures: number;
  episodes: GateResult[];
  schemaCompliance: number; // 0..1, gate ≥ 0.98
  quoteIntegrity: number; // 0..1, gate = 1.0
  bannedWordLeaks: number; // gate = 0
  p90DurationMs: number; // gate ≤ 5 min
  maxCostPerEpisode: number; // gate ≤ $0.50
  judge: { status: "blocked" | "ok"; reason?: string };
}

const QUOTE_KINDS: Partial<Record<ArtifactKind, string>> = {
  quotes: "items",
  show_notes: "quoteRefs",
  blog: "quoteRefs",
  newsletter: "quoteRefs",
};

function quoteIntegrityOf(kind: ArtifactKind, content: unknown, segments: Segment[], requireQuotes: boolean): boolean {
  const field = QUOTE_KINDS[kind];
  if (!field) return true;
  const refs = (content as Record<string, unknown>)?.[field];
  // Fallback packages may ship without embedded quotes (no padding, WP-03/04);
  // only the dedicated quotes artifact must always carry at least one. Every
  // ref that IS present must be a verbatim 40–240-char transcript slice.
  if (!Array.isArray(refs) || refs.length === 0) return !requireQuotes;
  const source = segments.map((s) => s.text).join("\n");
  return refs.every((ref) => {
    const r = ref as { segmentId: string; start: number; end: number; endSegmentId?: string };
    const seg = segments.find((s) => s.id === r.segmentId);
    if (!seg) return false;
    const text = seg.text.slice(r.start, r.end);
    return text.length >= 40 && text.length <= 240 && source.includes(text);
  });
}

function bannedWordsIn(content: unknown): string[] {
  return religionViolations(JSON.stringify(content));
}

function percentile(nums: number[], p: number): number {
  const sorted = [...nums].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
}

export async function runGate(fixtures: EpisodeFixture[], opts?: { timeoutMs?: number }): Promise<GateSummary> {
  const episodes: GateResult[] = [];
  const perEpisode: Map<string, GateResult[]> = new Map();

  for (const fx of fixtures) {
    const results: GateResult[] = [];
    const started = Date.now();
    for (const kind of ARTIFACT_KINDS) {
      if (kind === "chapters" && !fx.segments.some((s) => s.startMs !== null)) {
        continue; // chapters only when timestamps exist (M4)
      }
      const t0 = Date.now();
      const res = await generateArtifact({
        kind,
        segments: fx.segments,
        show: { name: `Eval Show — ${fx.name}` },
        voice: DEFAULT_VOICE_PROFILE,
        deps: { timeoutMs: opts?.timeoutMs },
      });
      const durationMs = Date.now() - t0;
      const schemaValid =
        res.status === "ai"
          ? artifactContentSchema(kind).safeParse(res.content).success
          : (CAPS[kind] ?? (() => true))(res.content as Record<string, unknown>);
      results.push({
        fixture: fx.name,
        kind,
        ok: schemaValid,
        status: res.status,
        durationMs,
        costUsd: res.costUsd,
        schemaValid,
        quoteIntegrity: quoteIntegrityOf(kind, res.content, fx.segments, kind === "quotes"),
        bannedWords: bannedWordsIn(res.content),
      });
    }
    void started;
    perEpisode.set(fx.name, results);
    episodes.push(...results);
  }

  const schemaOk = episodes.filter((e) => e.schemaValid).length;
  const quoteKinds = episodes.filter((e) => QUOTE_KINDS[e.kind]);
  const quoteOk = quoteKinds.filter((e) => e.quoteIntegrity).length;

  const episodeDurations = [...perEpisode.values()].map((rs) => rs.reduce((sum, r) => sum + r.durationMs, 0));
  const episodeCosts = [...perEpisode.values()].map((rs) => rs.reduce((sum, r) => sum + r.costUsd, 0));

  const anyAi = episodes.some((e) => e.status === "ai");
  return {
    fixtures: fixtures.length,
    episodes,
    schemaCompliance: episodes.length ? schemaOk / episodes.length : 0,
    quoteIntegrity: quoteKinds.length ? quoteOk / quoteKinds.length : 1,
    bannedWordLeaks: episodes.reduce((n, e) => n + e.bannedWords.length, 0),
    p90DurationMs: percentile(episodeDurations, 90),
    maxCostPerEpisode: Math.max(0, ...episodeCosts),
    // The judge must run on a different provider than the generator (spec).
    // With no valid keys every generation is deterministic-fallback, so a
    // faithfulness score would be a fabrication — blocked, not faked.
    judge: anyAi
      ? { status: "blocked", reason: "judge provider keys not configured" }
      : { status: "blocked", reason: "no valid AI keys — all episodes generated via deterministic fallback; owner must add GLM/Groq keys and re-run (FOR-ABID.md §2)" },
  };
}

export function gatesPass(summary: GateSummary): { pass: boolean; failures: string[] } {
  const failures: string[] = [];
  if (summary.quoteIntegrity < 1) failures.push(`quote integrity ${(summary.quoteIntegrity * 100).toFixed(1)}% < 100%`);
  if (summary.bannedWordLeaks > 0) failures.push(`banned-word leaks: ${summary.bannedWordLeaks}`);
  if (summary.schemaCompliance < 0.98) failures.push(`limit compliance ${(summary.schemaCompliance * 100).toFixed(1)}% < 98%`);
  if (summary.p90DurationMs > 5 * 60_000) failures.push(`p90 ${Math.round(summary.p90DurationMs / 1000)}s > 300s`);
  if (summary.maxCostPerEpisode > 0.5) failures.push(`cost $${summary.maxCostPerEpisode.toFixed(2)} > $0.50`);
  return { pass: failures.length === 0, failures };
}
