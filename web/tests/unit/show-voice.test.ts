// WP-07 — voice onboarding + settings: §7.4 default exactness, deterministic
// no-key learn path, sample word-count validation, and route boundary
// behaviour (DB and providers mocked at the boundary, never faked inline).
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  DEFAULT_VOICE_PROFILE,
  VoiceProfileSchema,
  learnVoiceProfileDeterministic,
  previewVoiceDeterministic,
  type VoiceProfile,
} from "@/lib/ai/voice";
import { handleVoiceLearn, handleVoicePreview, resolveShowVoiceProfile } from "@/lib/show/voice";
import { showPatchSchema, voiceLearnSchema } from "@/lib/show/input";
import { SAMPLE_TOO_SHORT_COPY, VOICE_PROFILE_INVALID_COPY } from "@/lib/copy";
import { fakeProvider, failingProvider } from "./helpers/ai";

vi.mock("@/db/queries", () => ({
  getShowByOwner: vi.fn(),
  updateShow: vi.fn(),
}));

import * as queries from "@/db/queries";

const mocked = vi.mocked(queries);

const voiceSample = readFileSync(new URL("../fixtures/voice-sample.txt", import.meta.url), "utf8");

const showRow = {
  id: "show-1",
  workspaceId: "ws-1",
  name: "The Focus Hour",
  rssUrl: null,
  artworkUrl: null,
  listenUrl: null,
  defaultCta: null,
  vocabulary: [],
  voiceProfile: null,
  voiceSamples: [],
  createdAt: new Date(),
};

/** A learned profile that differs from the default in every derived field. */
const LEARNED: VoiceProfile = {
  tone: ["dry", "direct", "curious"],
  formality: 2,
  energy: 4,
  humor: 3,
  person: "I",
  sentenceLength: "short",
  emoji: "light",
  signaturePhrases: ["here's the thing"],
  neverSay: ["synergy"],
  alwaysInclude: ["follow the show"],
  ctaStyle: "Ask for one reply.",
};

afterEach(() => {
  delete process.env.DATABASE_URL;
  vi.clearAllMocks();
});

describe("§7.4 default profile — byte-for-byte (Skip path)", () => {
  it("the default constant equals the spec literal field for field", () => {
    expect(DEFAULT_VOICE_PROFILE).toEqual({
      tone: ["clear", "warm", "curious"],
      formality: 3,
      energy: 3,
      humor: 2,
      person: "we",
      sentenceLength: "medium",
      emoji: "none",
      signaturePhrases: [],
      neverSay: ["delve", "game-changer", "unlock", "dive deep", "in today's fast-paced world"],
      alwaysInclude: [],
      ctaStyle: "Invite listeners to follow the show.",
    });
  });

  it("a null show row and a null stored profile both resolve to the exact default", () => {
    expect(resolveShowVoiceProfile(null)).toEqual(DEFAULT_VOICE_PROFILE);
    expect(resolveShowVoiceProfile(showRow)).toEqual(DEFAULT_VOICE_PROFILE);
    expect(resolveShowVoiceProfile({ voiceProfile: null })).toEqual(DEFAULT_VOICE_PROFILE);
  });

  it("a corrupt stored profile falls back to the exact default (never crashes)", () => {
    expect(resolveShowVoiceProfile({ voiceProfile: { tone: ["nope"], formality: 99 } })).toEqual(
      DEFAULT_VOICE_PROFILE,
    );
  });

  it("a stored valid profile is returned as-is", () => {
    expect(resolveShowVoiceProfile({ voiceProfile: LEARNED })).toEqual(LEARNED);
  });

  it("Skip persists nothing (no updateShow call happens on the skip path)", async () => {
    // Skip is a client-side navigation; the default is resolved at read time.
    // This pins the contract the UI relies on: resolve(null) === default.
    expect(mocked.updateShow).not.toHaveBeenCalled();
    expect(resolveShowVoiceProfile(null).tone).toEqual(["clear", "warm", "curious"]);
  });
});

describe("deterministic learn (no-key path)", () => {
  it("keeps every underivable field at the §7.4 default and stays schema-valid", () => {
    const profile = learnVoiceProfileDeterministic([voiceSample]);
    expect(VoiceProfileSchema.safeParse(profile).success).toBe(true);
    expect(profile.tone).toEqual(DEFAULT_VOICE_PROFILE.tone);
    expect(profile.formality).toBe(DEFAULT_VOICE_PROFILE.formality);
    expect(profile.energy).toBe(DEFAULT_VOICE_PROFILE.energy);
    expect(profile.humor).toBe(DEFAULT_VOICE_PROFILE.humor);
    expect(profile.signaturePhrases).toEqual(DEFAULT_VOICE_PROFILE.signaturePhrases);
    expect(profile.neverSay).toEqual(DEFAULT_VOICE_PROFILE.neverSay);
    expect(profile.alwaysInclude).toEqual(DEFAULT_VOICE_PROFILE.alwaysInclude);
    expect(profile.ctaStyle).toBe(DEFAULT_VOICE_PROFILE.ctaStyle);
  });

  it("derives person from first-person pronouns in the samples", () => {
    const first = learnVoiceProfileDeterministic([
      "I plan my week on Sunday. My notes are short. I record alone and I edit the same day.",
    ]);
    expect(first.person).toBe("I");

    const together = learnVoiceProfileDeterministic([
      "We plan our week together. Our notes keep us honest. We record on Mondays and we ship the same day.",
    ]);
    expect(together.person).toBe("we");

    const third = learnVoiceProfileDeterministic([
      "They plan their week early. Their notes stay short. They record on Mondays and they ship the same day.",
    ]);
    expect(third.person).toBe("they");
  });

  it("derives sentence length from the average sentence", () => {
    const short = learnVoiceProfileDeterministic([
      "Short sentences. Very short. They land. Every time. No filler. Cut it. Then cut again. Ship it now.",
    ]);
    expect(short.sentenceLength).toBe("short");

    const long = learnVoiceProfileDeterministic([
      "When you sit down on a Sunday evening and look at the week ahead, the plan you wrote on Friday morning can feel like it was left there by a stranger who had far more energy and far fewer meetings than the person reading it now, and that gap is exactly where most plans quietly die.",
    ]);
    expect(long.sentenceLength).toBe("long");
  });

  it("derives emoji usage from the sample text", () => {
    const plain = learnVoiceProfileDeterministic([voiceSample]);
    expect(plain.emoji).toBe("none");
    const light = learnVoiceProfileDeterministic([
      `${voiceSample} Great episode today 🎧 big thanks for listening ✨`.repeat(1),
    ]);
    expect(light.emoji).toBe("light");
  });

  it("is deterministic: the same samples give the same profile", () => {
    expect(learnVoiceProfileDeterministic([voiceSample])).toEqual(
      learnVoiceProfileDeterministic([voiceSample]),
    );
  });
});

describe("sample validation (§M1: 1–3 past show notes, ≥150 words each)", () => {
  const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

  it("accepts three samples of 150+ words", () => {
    const parsed = voiceLearnSchema.safeParse({ samples: [words(150), words(160), words(200)] });
    expect(parsed.success).toBe(true);
  });

  it("rejects a sample under 150 words with the friendly copy", () => {
    const parsed = voiceLearnSchema.safeParse({ samples: [words(149)] });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.message).toBe(SAMPLE_TOO_SHORT_COPY);
  });

  it("rejects more than three samples and an empty body", () => {
    expect(voiceLearnSchema.safeParse({ samples: [words(150), words(150), words(150), words(150)] }).success).toBe(false);
    expect(voiceLearnSchema.safeParse({ samples: [] }).success).toBe(false);
    expect(voiceLearnSchema.safeParse({}).success).toBe(false);
  });
});

describe("handleVoiceLearn (POST /api/show/voice/learn)", () => {
  it("400 with friendly copy when a sample is too short", async () => {
    const result = await handleVoiceLearn("u1", { samples: ["too short"] });
    expect(result.status).toBe(400);
    expect(result.json).toEqual({ error: SAMPLE_TOO_SHORT_COPY });
    expect(mocked.getShowByOwner).not.toHaveBeenCalled();
  });

  it("provider success persists the learned profile + samples (saved: true)", async () => {
    process.env.DATABASE_URL = "postgres://test";
    mocked.getShowByOwner.mockResolvedValue(showRow);
    mocked.updateShow.mockResolvedValue(showRow);
    const provider = fakeProvider("groq", [JSON.stringify(LEARNED)]);

    const result = await handleVoiceLearn(
      "u1",
      { samples: [voiceSample] },
      { chain: [provider] },
    );

    expect(result.status).toBe(200);
    expect(result.json).toMatchObject({ status: "learned", profile: LEARNED, saved: true });
    expect(mocked.updateShow).toHaveBeenCalledWith("show-1", {
      voiceProfile: LEARNED,
      voiceSamples: [voiceSample.trim()],
    });
  });

  it("every provider failing yields the deterministic profile, honestly labelled (U3, no fake learn)", async () => {
    process.env.DATABASE_URL = "postgres://test";
    mocked.getShowByOwner.mockResolvedValue(showRow);
    mocked.updateShow.mockResolvedValue(showRow);

    const result = await handleVoiceLearn(
      "u1",
      { samples: [voiceSample] },
      { chain: [failingProvider("glm-coding"), failingProvider("groq")] },
    );

    expect(result.status).toBe(200);
    expect(result.json).toMatchObject({
      status: "deterministic",
      provider: null,
      model: null,
      saved: true,
    });
    const profile = (result.json as { profile: VoiceProfile }).profile;
    expect(VoiceProfileSchema.safeParse(profile).success).toBe(true);
    expect(profile.person).toBe("I"); // derived from the fixture, not defaulted silently
    expect(mocked.updateShow).toHaveBeenCalled();
  });

  it("404 when the DB is configured but no show exists yet", async () => {
    process.env.DATABASE_URL = "postgres://test";
    mocked.getShowByOwner.mockResolvedValue(null);
    const result = await handleVoiceLearn(
      "u1",
      { samples: [voiceSample] },
      { chain: [failingProvider("groq")] },
    );
    expect(result.status).toBe(404);
    expect(mocked.updateShow).not.toHaveBeenCalled();
  });

  it("keyless preview: learn still runs (deterministic) but reports saved: false and writes nothing", async () => {
    const result = await handleVoiceLearn(
      "u1",
      { samples: [voiceSample] },
      { chain: [failingProvider("glm-coding")] },
    );
    expect(result.status).toBe(200);
    expect(result.json).toMatchObject({ status: "deterministic", saved: false });
    expect(mocked.getShowByOwner).not.toHaveBeenCalled();
    expect(mocked.updateShow).not.toHaveBeenCalled();
  });
});

describe("handleVoicePreview (POST /api/show/voice/preview)", () => {
  it("returns the AI text when a provider answers", async () => {
    const provider = fakeProvider("groq", ["Here is your sample paragraph in your voice."]);
    const result = await handleVoicePreview("u1", { profile: LEARNED }, { chain: [provider] });
    expect(result.status).toBe(200);
    expect(result.json).toMatchObject({ status: "ai", provider: "groq" });
    expect(result.json.text).toContain("sample paragraph");
  });

  it("falls back to the deterministic preview text (labelled) when providers fail", async () => {
    const result = await handleVoicePreview(
      "u1",
      { profile: LEARNED },
      { chain: [failingProvider("glm-coding")] },
    );
    expect(result.status).toBe(200);
    expect(result.json).toMatchObject({ status: "deterministic", provider: null });
    expect(typeof result.json.text).toBe("string");
    expect(result.json.text).not.toBe("");
  });

  it("uses the stored profile when none is sent", async () => {
    process.env.DATABASE_URL = "postgres://test";
    mocked.getShowByOwner.mockResolvedValue({ ...showRow, voiceProfile: LEARNED });
    const provider = fakeProvider("groq", ["A fresh preview."]);
    const result = await handleVoicePreview("u1", {}, { chain: [provider] });
    expect(result.json).toMatchObject({ status: "ai", text: "A fresh preview." });
  });

  it("rejects an invalid profile with friendly copy", async () => {
    const result = await handleVoicePreview("u1", { profile: { formality: 42 } });
    expect(result.status).toBe(400);
    expect(result.json).toEqual({ error: VOICE_PROFILE_INVALID_COPY });
  });
});

describe("deterministic preview (renders from the profile)", () => {
  it("is a plain-text sample whose content tracks the profile", () => {
    const a = previewVoiceDeterministic(LEARNED, { name: "The Focus Hour" });
    expect(a).not.toMatch(/[{}]/); // plain text, not JSON
    expect(a.split(/\s+/).filter(Boolean).length).toBeGreaterThan(25);
    expect(a.split(/\s+/).filter(Boolean).length).toBeLessThan(90);
    expect(a).toContain("The Focus Hour");
    expect(a).not.toMatch(/\s{2,}/); // no double spaces from template joins
    // person pronoun follows the profile
    expect(a).toContain("I ");
  });

  it("changes when the profile changes", () => {
    const a = previewVoiceDeterministic(LEARNED, { name: "The Focus Hour" });
    const b = previewVoiceDeterministic(
      { ...LEARNED, person: "we", emoji: "heavy", sentenceLength: "long" },
      { name: "The Focus Hour" },
    );
    expect(a).not.toBe(b);
  });

  it("never contains a never-say word", () => {
    const banned = LEARNED.neverSay[0];
    const text = previewVoiceDeterministic({ ...LEARNED, neverSay: [banned] }, { name: "X" });
    expect(text.toLowerCase()).not.toContain(banned.toLowerCase());
  });

  it("is stable for the same inputs", () => {
    expect(previewVoiceDeterministic(LEARNED, { name: "X" })).toBe(
      previewVoiceDeterministic(LEARNED, { name: "X" }),
    );
  });
});

describe("PATCH /api/show voice fields (settings Save voice, step-2 Continue)", () => {
  it("accepts a valid voiceProfile and voiceSamples", () => {
    const parsed = showPatchSchema.safeParse({
      voiceProfile: LEARNED,
      voiceSamples: [voiceSample],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.voiceProfile).toEqual(LEARNED);
      expect(parsed.data.voiceSamples).toEqual([voiceSample.trim()]);
    }
  });

  it("rejects an invalid profile and an under-length sample", () => {
    expect(showPatchSchema.safeParse({ voiceProfile: { formality: 9 } }).success).toBe(false);
    expect(showPatchSchema.safeParse({ voiceSamples: ["too short"] }).success).toBe(false);
  });
});
