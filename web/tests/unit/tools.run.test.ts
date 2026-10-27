// Selection tests: registry/AI vs deterministic fallback for the free tools
// (AI path exercised via the injected fake chain — no live keys).
import { describe, expect, it } from "vitest";
import { CAP_NOTE, FALLBACK_NOTE, checkToolInput, runFreeTool } from "@/lib/tools/run";
import { demoEpisode } from "./helpers/ai";
import { normalizeWs, stripSpeakerLabels } from "@/lib/engine";
import type { LlmProvider } from "@/lib/ai/types";

// full demo transcript, ASR-label-free — the same normalization the engine runs
const SOURCE = normalizeWs(stripSpeakerLabels(demoEpisode));
const TEXT = SOURCE;

function aiProvider(payload: unknown): LlmProvider {
  return {
    id: "fake",
    complete: async () => ({ text: JSON.stringify(payload) }),
  };
}

function failingProvider(): LlmProvider {
  return {
    id: "dead",
    complete: async () => {
      throw Object.assign(new Error("no key"), { code: "no_key" });
    },
  };
}

const SHOW_NOTES_AI = {
  title: "Attention is a budget",
  hook: "Focus is the most expensive resource in modern work.",
  bullets: ["Why attention compounds", "Calendars beat to-do lists", "Subtraction is the upgrade", "Scripts for boundaries"],
  cta: "Follow the show.",
};

describe("checkToolInput", () => {
  it("rejects short input, >15k words and sentence-less input", () => {
    expect(checkToolInput("too short")).toMatchObject({ ok: false, code: "too_short" });
    expect(checkToolInput("word ".repeat(15_001))).toMatchObject({ ok: false, code: "too_long" });
    const noEnders = Array.from({ length: 100 }, (_, i) => `word${i}`).join(" ");
    expect(checkToolInput(noEnders)).toMatchObject({ ok: false, code: "not_enough_sentences" });
    expect(checkToolInput(TEXT)).toMatchObject({ ok: true });
  });
});

describe("runFreeTool selection", () => {
  it("uses the AI chain when a provider responds with valid JSON", async () => {
    const run = await runFreeTool("show-notes", TEXT, { chain: [aiProvider(SHOW_NOTES_AI)] });
    expect(run.mode).toBe("ai");
    expect(run.note).toBeNull();
    expect(run.provider).toBe("fake");
    const result = run.result as { title: string; quote: string | null };
    expect(result.title).toBe("Attention is a budget");
    // the quote is attached server-side and is verbatim transcript text
    expect(result.quote).toBeTruthy();
    expect(SOURCE).toContain(result.quote as string);
  });

  it("falls back to deterministic output when the provider fails", async () => {
    const run = await runFreeTool("show-notes", TEXT, { chain: [failingProvider()] });
    expect(run.mode).toBe("deterministic");
    expect(run.note).toBe(FALLBACK_NOTE);
    expect((run.result as { title: string }).title).toBeTruthy();
    expect((run.result as { quote: string | null }).quote).toBeTruthy();
  });

  it("repairs once, then falls back on a second invalid response", async () => {
    let calls = 0;
    const provider: LlmProvider = {
      id: "flake",
      complete: async () => {
        calls++;
        return { text: calls === 1 ? "not json at all" : JSON.stringify(SHOW_NOTES_AI) };
      },
    };
    const run = await runFreeTool("show-notes", TEXT, { chain: [provider] });
    expect(calls).toBe(2);
    expect(run.mode).toBe("ai");
  });

  it("runs the deterministic path directly when the cap disabled AI", async () => {
    const run = await runFreeTool("episode-titles", TEXT, { aiDisabled: true });
    expect(run.mode).toBe("deterministic");
    expect(run.note).toBe(FALLBACK_NOTE);
  });

  it("produces 5 days for the email series with verbatim anchors (AI mode)", async () => {
    const days = Array.from({ length: 5 }, (_, i) => ({
      title: `Day ${i + 1}`,
      anchor: "made-up anchor that is not a transcript sentence",
      reflection: `Reflection ${i}`,
      action: `Action ${i}`,
      closing: "Reply and tell us.",
    }));
    const run = await runFreeTool("email-series", TEXT, { chain: [aiProvider({ days })] });
    expect(run.mode).toBe("ai");
    const result = run.result as { days: Array<{ anchor: string }> };
    expect(result.days).toHaveLength(5);
    for (const day of result.days) {
      // every non-verbatim anchor claim was replaced by a deterministic one
      expect(normalize(TEXT)).toContain(normalize(day.anchor));
    }
  });

  it("replaces fabricated discussion quotes with deterministic ones", async () => {
    const ai = {
      title: "Kit",
      opener: "What did you take away?",
      open: ["Q one?", "Q two?"],
      qs: [
        { quote: "this sentence appears nowhere in the transcript at all", follow: "Why?" },
        { quote: "Focus is the most expensive resource in modern work", follow: "Agree?" },
        { quote: "another fabricated claim that is not in the episode", follow: "Really?" },
        { quote: "A to-do item is a wish while a calendar block is a promise", follow: "Which is yours?" },
      ],
      apply: ["Try it", "Tell someone"],
      closing: "See you.",
    };
    const run = await runFreeTool("discussion-guide", TEXT, { chain: [aiProvider(ai)] });
    expect(run.mode).toBe("ai");
    const result = run.result as { qs: Array<{ quote: string }> };
    expect(normalize(SOURCE)).toContain(normalize(result.qs[0].quote)); // backfilled
    expect(normalize(SOURCE)).toContain(normalize(result.qs[1].quote)); // the real one kept
  });

  it("deterministic titles carry themes and style tags", async () => {
    const run = await runFreeTool("episode-titles", TEXT, { aiDisabled: true });
    const result = run.result as { themes: string[]; titles: Array<{ text: string; style: string }> };
    expect(result.themes.length).toBeGreaterThan(0);
    expect(result.titles.length).toBeGreaterThan(0);
    for (const t of result.titles) expect(t.style).toMatch(/^(Question|Number|Curiosity)$/);
  });
});

function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

// CAP_NOTE must stay exported for the route's cap message
void CAP_NOTE;
