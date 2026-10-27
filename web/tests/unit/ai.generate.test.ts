// §8.1 call policy end-to-end at the library boundary: provider chain with
// retries, JSON repair, §7.3 quote resolution, §8.4 post-check wiring (U8),
// deterministic fallback labelled as such (U10), usage_events logging.
import { describe, expect, it, vi } from "vitest";
import { generateArtifact } from "@/lib/ai/generate";
import { DEFAULT_VOICE_PROFILE } from "@/lib/ai/voice";
import { quoteText } from "@/lib/quotes";
import { failingProvider, fakeProvider, demoSegments, TOKENS } from "./helpers/ai";
import type { UsageEvent } from "@/lib/ai/usage";
import type { GenerateDeps } from "@/lib/ai/generate";
import type { LlmProvider } from "@/lib/ai/types";

const show = {
  name: "The Focus Show",
  defaultCta: "Follow the show wherever you listen.",
  allowedUrls: ["https://thefocus.show"],
};

const SHOW_NOTES = {
  hook: "Focus is a skill you can train.",
  bullets: [
    "Why attention feels scarce",
    "The two-minute reset ritual",
    "How to say no at work",
    "Deep work in ordinary weeks",
  ],
  quoteRefs: [{ segmentId: "seg_000000", exact: demoSegments[0].text.slice(0, 60) }],
  cta: "Follow the show wherever you listen.",
};

function depsWithChain(chain: LlmProvider[], extra: Partial<GenerateDeps> = {}): GenerateDeps {
  return { chain, workspaceId: "ws_1", episodeId: "ep_1", ...extra };
}

/** GenerateResult.content is unknown by contract; narrow at the call site. */
function contentOf(res: { content: unknown }): Record<string, unknown> {
  return res.content as Record<string, unknown>;
}

describe("happy path", () => {
  it("returns validated AI content with resolved quote offsets", async () => {
    const p = fakeProvider("groq", [JSON.stringify(SHOW_NOTES)], TOKENS);
    const res = await generateArtifact({
      kind: "show_notes",
      segments: demoSegments,
      show,
      voice: DEFAULT_VOICE_PROFILE,
      deps: depsWithChain([p]),
    });
    expect(res.status).toBe("ai");
    expect(res.provider).toBe("groq");
    expect(res.errorCode).toBeNull();
    const ref = (contentOf(res).quoteRefs as { segmentId: string; start: number; end: number }[])[0];
    expect(ref.segmentId).toBe("seg_000000");
    // resolution trims edge whitespace before storing offsets
    expect(demoSegments[0].text.slice(ref.start, ref.end)).toBe(
      demoSegments[0].text.slice(0, 60).trim(),
    );
  });

  it("uses the long model for artifact kinds at temperature 0.4 with json mode", async () => {
    const p = fakeProvider("groq", [JSON.stringify(SHOW_NOTES)]);
    await generateArtifact({
      kind: "show_notes",
      segments: demoSegments,
      show,
      voice: DEFAULT_VOICE_PROFILE,
      deps: depsWithChain([p]),
    });
    expect(p.calls[0].model).toBe("glm-4.6"); // default selection long model
    expect(p.calls[0].json).toBe(true);
    expect(p.calls[0].temperature).toBe(0.4);
  });
});

describe("JSON handling: response_format + Zod + one repair call", () => {
  it("repairs unparseable output with one follow-up call that asks for valid JSON", async () => {
    const p = fakeProvider("groq", ["not json at all", JSON.stringify(SHOW_NOTES)]);
    const res = await generateArtifact({
      kind: "show_notes",
      segments: demoSegments,
      show,
      voice: DEFAULT_VOICE_PROFILE,
      deps: depsWithChain([p]),
    });
    expect(res.status).toBe("ai");
    expect(p.calls).toHaveLength(2);
    expect(p.calls[1].user).toContain("valid JSON");
    expect(p.calls[1].user).toContain(p.calls[0].user); // original prompt preserved
  });

  it("moves to the fallback provider when the repair also fails validation", async () => {
    const bad = fakeProvider("glm-coding", ["garbage", "{\"bullets\": []}"]);
    const good = fakeProvider("groq", [JSON.stringify(SHOW_NOTES)]);
    const res = await generateArtifact({
      kind: "show_notes",
      segments: demoSegments,
      show,
      voice: DEFAULT_VOICE_PROFILE,
      deps: depsWithChain([bad, good]),
    });
    expect(res.status).toBe("ai");
    expect(res.provider).toBe("groq");
    expect(bad.calls).toHaveLength(2); // initial + repair, then gave up
  });
});

describe("U10: every provider fails → deterministic package labelled fallback", () => {
  it("falls back to the deterministic builder with status fallback", async () => {
    const chain = [
      failingProvider("glm-coding", "1113 no coding-plan resource"),
      failingProvider("groq", "rate limited"),
    ];
    const res = await generateArtifact({
      kind: "show_notes",
      segments: demoSegments,
      show,
      voice: DEFAULT_VOICE_PROFILE,
      deps: depsWithChain(chain),
    });
    expect(res.status).toBe("fallback");
    expect(res.provider).toBeNull();
    expect(res.model).toBeNull();
    expect(res.errorCode).toBe("all_providers_failed");
    // content is derived from the transcript, not invented
    const c = contentOf(res);
    for (const b of c.bullets as string[]) {
      expect(demoSegments.map((s) => s.text).join(" ")).toContain(b);
    }
    expect(c.cta).toBe(show.defaultCta);
  });

  it("fallback quotes artifact resolves verbatim refs from candidates", async () => {
    const res = await generateArtifact({
      kind: "quotes",
      segments: demoSegments,
      show,
      voice: DEFAULT_VOICE_PROFILE,
      deps: depsWithChain([failingProvider("glm-coding")]),
    });
    expect(res.status).toBe("fallback");
    const items = contentOf(res).items as { segmentId: string; start: number; end: number }[];
    expect(Array.isArray(items)).toBe(true);
    for (const ref of items) {
      const seg = demoSegments.find((s) => s.id === ref.segmentId);
      expect(seg).toBeTruthy();
      expect(seg!.text).toContain(quoteText(ref, demoSegments));
    }
  });

  it("chapters without timestamps never fabricate times", async () => {
    const noTime = demoSegments.map((s) => ({ ...s, startMs: null, endMs: null }));
    const res = await generateArtifact({
      kind: "chapters",
      segments: noTime,
      show,
      voice: DEFAULT_VOICE_PROFILE,
      deps: depsWithChain([failingProvider("glm-coding")]),
    });
    expect(res.status).toBe("fallback");
    expect(contentOf(res).items).toEqual([]);
    expect(res.errorCode).toBe("no_timestamps");
  });
});

describe("U8: banned words (voice neverSay) never survive into an artifact", () => {
  const banned = (text: string) => JSON.stringify({ ...SHOW_NOTES, hook: text });

  it("regenerates once with feedback when the draft uses a banned word", async () => {
    const p = fakeProvider("groq", [
      banned(`Let us delve into focus.`),
      JSON.stringify(SHOW_NOTES),
    ]);
    const res = await generateArtifact({
      kind: "show_notes",
      segments: demoSegments,
      show,
      voice: DEFAULT_VOICE_PROFILE, // neverSay: delve, game-changer, ...
      deps: depsWithChain([p]),
    });
    expect(p.calls).toHaveLength(2);
    expect(p.calls[1].user).toContain("delve");
    expect(p.calls[1].user.toLowerCase()).toContain("banned");
    expect(res.status).toBe("ai");
    expect(res.regenerated).toBe(true);
  });

  it("replaces the phrase deterministically when the retry still violates", async () => {
    const p = fakeProvider("groq", [
      banned(`We delve into attention.`),
      banned(`We delve into attention some more.`),
    ]);
    const res = await generateArtifact({
      kind: "show_notes",
      segments: demoSegments,
      show,
      voice: DEFAULT_VOICE_PROFILE,
      deps: depsWithChain([p]),
    });
    expect(res.status).toBe("ai");
    expect(res.regenerated).toBe(true);
    expect(JSON.stringify(res.content)).not.toMatch(/delve/i);
    expect(contentOf(res).hook).toBe("We into attention some more.");
  });

  it("a violation that cannot be phrase-replaced pushes the artifact to the next provider", async () => {
    const bad = fakeProvider("glm-coding", [
      JSON.stringify({ ...SHOW_NOTES, bullets: ["sermon notes for sunday", "focus", "energy", "habits"] }),
      JSON.stringify({ ...SHOW_NOTES, bullets: ["still a sermon reference", "focus", "energy", "habits"] }),
    ]);
    const good = fakeProvider("groq", [JSON.stringify(SHOW_NOTES)]);
    const res = await generateArtifact({
      kind: "show_notes",
      segments: demoSegments,
      show,
      voice: DEFAULT_VOICE_PROFILE,
      deps: depsWithChain([bad, good]),
    });
    expect(res.provider).toBe("groq");
    expect(JSON.stringify(res.content)).not.toMatch(/sermon/i);
  });
});

describe("§8.4 foreign URL strip", () => {
  it("removes links not in show settings, keeps allowed ones", async () => {
    const withLinks = JSON.stringify({
      ...SHOW_NOTES,
      bullets: [
        "Read the study at https://made-up.example/paper",
        "Full notes at https://thefocus.show/ep-12",
        "Focus basics",
        "Saying no",
      ],
    });
    const p = fakeProvider("groq", [withLinks]);
    const res = await generateArtifact({
      kind: "show_notes",
      segments: demoSegments,
      show,
      voice: DEFAULT_VOICE_PROFILE,
      deps: depsWithChain([p]),
    });
    const joined = (contentOf(res).bullets as string[]).join(" ");
    expect(joined).not.toContain("made-up.example");
    expect(joined).toContain("https://thefocus.show/ep-12");
  });
});

describe("usage_events logging (§7.1)", () => {
  it("logs one event per successful call with est. cost from the price table", async () => {
    const events: UsageEvent[] = [];
    const usage = vi.fn(async (e: UsageEvent) => { events.push(e); });
    const p = fakeProvider("groq", [
      "broken json",
      JSON.stringify(SHOW_NOTES),
    ], TOKENS);
    await generateArtifact({
      kind: "show_notes",
      segments: demoSegments,
      show,
      voice: DEFAULT_VOICE_PROFILE,
      deps: depsWithChain([p], {
        usage,
        selection: {
          provider: "groq",
          longModel: "openai/gpt-oss-120b",
          fastModel: "openai/gpt-oss-20b",
          fallbackProvider: "groq",
        },
      }),
    });
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      workspaceId: "ws_1",
      episodeId: "ep_1",
      kind: "llm",
      provider: "groq",
      model: "openai/gpt-oss-120b",
    });
    expect(events[0].units).toBe(TOKENS.in + TOKENS.out);
    // verified Groq list price: $0.15/M in, $0.60/M out
    expect(events[0].costUsd).toBeCloseTo((100 * 0.15 + 50 * 0.6) / 1_000_000, 12);
    expect(events[1].costUsd).toBeGreaterThan(0);
  });

  it("a failing usage logger never fails generation", async () => {
    const usage = vi.fn(async () => { throw new Error("db down"); });
    const p = fakeProvider("groq", [JSON.stringify(SHOW_NOTES)]);
    const res = await generateArtifact({
      kind: "show_notes",
      segments: demoSegments,
      show,
      voice: DEFAULT_VOICE_PROFILE,
      deps: depsWithChain([p], { usage }),
    });
    expect(res.status).toBe("ai");
  });
});
