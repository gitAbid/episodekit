// §8.2 prompts: shared system prompt (verbatim skeleton), per-artifact user
// prompts, transcript budget rule, weak-model hardening, PROMPT_VERSION.
import { describe, expect, it } from "vitest";
import {
  PROMPT_VERSION,
  TRANSCRIPT_TOKEN_BUDGET,
  buildSystemPrompt,
  budgetTranscriptLines,
  buildArtifactPrompt,
  estimateTokens,
} from "@/lib/prompts";
import { buildAnalyzePrompt } from "@/lib/prompts/analyze";
import { buildVoiceLearnPrompt } from "@/lib/prompts/voice-learn";
import { buildShortenPrompt } from "@/lib/prompts/shorten";
import { DEFAULT_VOICE_PROFILE } from "@/lib/ai/voice";
import { demoSegments } from "./helpers/ai";
import type { VoiceProfile } from "@/lib/ai/voice";

const show = { name: "The Focus Show", defaultCta: "Follow the show.", allowedUrls: [] };
const longSample = Array.from({ length: 500 }, (_, i) => `word${i}`).join(" ");

const ctx = {
  show,
  voice: DEFAULT_VOICE_PROFILE,
  voiceSamples: [longSample, longSample, longSample],
  meta: { title: "Attention", number: 12, guests: ["Maya"] },
  segments: demoSegments,
};

describe("PROMPT_VERSION + shared system prompt", () => {
  it("exposes a prompt version constant", () => {
    expect(typeof PROMPT_VERSION).toBe("string");
    expect(PROMPT_VERSION.length).toBeGreaterThan(0);
  });

  it("fills the §8.2 verbatim skeleton with show and voice", () => {
    const voice: VoiceProfile = {
      ...DEFAULT_VOICE_PROFILE,
      tone: ["clear", "warm", "curious"],
      signaturePhrases: ["tiny experiments"],
      neverSay: ["delve", "game-changer"],
      alwaysInclude: [],
    };
    const s = buildSystemPrompt(show, voice);
    expect(s).toContain('for the show "The Focus Show"');
    expect(s).toContain("tone clear, warm, curious");
    expect(s).toContain("formality 3/5");
    expect(s).toContain("energy 3/5");
    expect(s).toContain("humor 2/5");
    expect(s).toContain('write as "we"');
    expect(s).toContain("medium\nsentences");
    expect(s).toContain("emoji: none");
    expect(s).toContain("You may use these phrases sparingly: tiny experiments.");
    expect(s).toContain("Never use: delve, game-changer.");
    expect(s).toContain("Include where natural: none.");
    expect(s).toContain("Never invent names, numbers, links or claims.");
    expect(s).toContain('return {"segmentId": "...", "exact": "..."}');
    expect(s).toContain("Return only JSON matching the schema below.");
  });
});

describe("per-artifact user prompts", () => {
  it("show_notes carries counts, metadata, ≤2 bounded samples and numbered transcript", () => {
    const p = buildArtifactPrompt("show_notes", ctx);
    expect(p.user).toContain("4-7");
    expect(p.user).toContain("Episode title: Attention");
    expect(p.user).toContain("Episode number: 12");
    expect(p.user).toContain("Guests: Maya");
    expect(p.user).toContain("Follow the show.");
    // 3 samples of 500 words each → only 2 samples, each ≤400 words survive
    expect(p.user.match(/style reference only/gi)?.length).toBe(2);
    expect(p.user).not.toContain("word460");
    expect(p.user).toContain("[seg_000000|Maya|00:00]");
    expect(p.tier).toBe("long");
    expect(p.temperature).toBe(0.4);
    expect(p.truncated).toBe(false);
  });

  it("each artifact prompt returns its §7.2 schema for validation", () => {
    for (const kind of [
      "show_notes",
      "chapters",
      "summary",
      "titles",
      "blog",
      "newsletter",
      "social",
      "quotes",
    ] as const) {
      const p = buildArtifactPrompt(kind, ctx);
      expect(p.schema).toBeTruthy();
      expect(p.system).toContain("Return only JSON matching the schema below.");
    }
  });

  it("regenerate instruction is appended when given", () => {
    const p = buildArtifactPrompt("titles", { ...ctx, instruction: "punchier" });
    expect(p.user).toContain("punchier");
  });

  it("analyze uses the fast model tier at temperature 0.2 (weak-model hardening)", () => {
    const p = buildAnalyzePrompt(ctx);
    expect(p.tier).toBe("fast");
    expect(p.temperature).toBe(0.2);
    expect(p.user).toContain("candidateQuotes");
  });

  it("quotes artifact asks for exact character-for-character copies", () => {
    const p = buildArtifactPrompt("quotes", ctx);
    expect(p.user).toContain("character-for-character");
    expect(p.user).toContain("5");
  });
});

describe("transcript budget (§8.2: >~60k tokens → first 40% + last 20% + top-ranked)", () => {
  it("estimateTokens uses the chars/4 approximation", () => {
    expect(estimateTokens("abcdefgh")).toBe(2);
  });

  it("keeps everything and reports not-truncated under the budget", () => {
    const lines = ["a", "b", "c"];
    const r = budgetTranscriptLines(lines, { maxTokens: 1000 });
    expect(r.truncated).toBe(false);
    expect(r.lines).toEqual(lines);
  });

  it("truncates: first 40% + last 20% kept, extreme overflow trims the head end", () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line-${i} filler filler filler filler`);
    const r = budgetTranscriptLines(lines, { maxTokens: 30 });
    expect(r.truncated).toBe(true);
    expect(r.lines).toContain("line-0 filler filler filler filler"); // episode start survives
    expect(r.lines).toContain("line-19 filler filler filler filler");
    const head = lines.slice(0, 8);
    const tail = lines.slice(16);
    for (const l of r.lines) {
      expect(head.includes(l) || tail.includes(l)).toBe(true);
    }
  });

  it("fills leftover budget with top-ranked middle lines, in episode order", () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line-${i} filler filler filler filler`);
    const ranked = lines.map((_, i) => ({ s: lines[i], i, score: 20 - i }));
    // 12 head+tail lines ≈ 105 tokens; 135 leaves room for ~3 ranked middle lines
    const r = budgetTranscriptLines(lines, { maxTokens: 135, ranked });
    expect(r.truncated).toBe(true);
    const head = lines.slice(0, 8);
    const tail = lines.slice(16);
    const middle = r.lines.filter((l) => !head.includes(l) && !tail.includes(l));
    expect(middle).toEqual([
      "line-8 filler filler filler filler", // highest-ranked middle line first in rank...
      "line-9 filler filler filler filler",
      "line-10 filler filler filler filler",
    ]); // ...but stored in episode order, which coincides here
  });

  it("big transcripts flip the truncated flag on the artifact prompt", () => {
    const many: typeof demoSegments = [];
    for (let i = 0; i < 4000; i++) {
      many.push({
        id: `seg_${String(i).padStart(6, "0")}`,
        idx: i,
        speaker: null,
        startMs: i * 1000,
        endMs: (i + 1) * 1000,
        text: `Segment ${i} talks about focus habits attention energy work and ordinary weeks with padding ${"x".repeat(60)}`,
      });
    }
    const p = buildArtifactPrompt("summary", { ...ctx, segments: many });
    expect(p.truncated).toBe(true);
    expect(estimateTokens(p.user.split("TRANSCRIPT:")[1] ?? "")).toBeLessThanOrEqual(TRANSCRIPT_TOKEN_BUDGET + 100);
  });
});

describe("auxiliary prompts", () => {
  it("voice-learn asks for the §7.4 profile shape", () => {
    const p = buildVoiceLearnPrompt(["A past show note sample text."]);
    expect(p.user).toContain("formality");
    expect(p.user).toContain("neverSay");
    expect(p.user).toContain("ctaStyle");
    expect(p.tier).toBe("fast");
    expect(p.temperature).toBe(0.2);
  });

  it("shorten carries the target limit and stays plain text", () => {
    const p = buildShortenPrompt({
      show,
      voice: DEFAULT_VOICE_PROFILE,
      text: "Long text",
      maxChars: 4000,
    });
    expect(p.user).toContain("4000");
    expect(p.json).toBe(false);
    expect(p.tier).toBe("fast");
  });
});
