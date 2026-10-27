// §7.4 voice profile: shape, defaults, learn + preview functions.
import { describe, expect, it } from "vitest";
import { DEFAULT_VOICE_PROFILE, VoiceProfileSchema, learnVoiceProfile, previewVoice, type VoiceProfile } from "@/lib/ai/voice";
import { fakeProvider, failingProvider } from "./helpers/ai";

const PROFILE: VoiceProfile = {
  tone: ["dry", "direct", "curious"],
  formality: 2,
  energy: 4,
  humor: 3,
  person: "I",
  sentenceLength: "short",
  emoji: "light",
  signaturePhrases: ["here's the thing"],
  neverSay: ["synergy"],
  alwaysInclude: [],
  ctaStyle: "Ask for one reply.",
};

describe("§7.4 defaults and schema", () => {
  it("default profile matches the spec", () => {
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
    expect(VoiceProfileSchema.safeParse(DEFAULT_VOICE_PROFILE).success).toBe(true);
  });

  it("rejects out-of-range sliders and overlong lists", () => {
    expect(VoiceProfileSchema.safeParse({ ...PROFILE, formality: 9 }).success).toBe(false);
    expect(VoiceProfileSchema.safeParse({ ...PROFILE, tone: ["a", "b"] }).success).toBe(false);
    expect(VoiceProfileSchema.safeParse({ ...PROFILE, neverSay: Array(31).fill("x") }).success).toBe(false);
  });
});

describe("learnVoiceProfile", () => {
  it("parses a valid model response into the profile", async () => {
    const p = fakeProvider("groq", [JSON.stringify(PROFILE)]);
    const res = await learnVoiceProfile({ samples: ["Past show notes text."], deps: { chain: [p] } });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.profile).toEqual(PROFILE);
    expect(p.calls[0].json).toBe(true);
  });

  it("repairs once, then falls back to the default profile on failure", async () => {
    const repairable = fakeProvider("groq", ["nope", JSON.stringify(PROFILE)]);
    const r1 = await learnVoiceProfile({ samples: ["s"], deps: { chain: [repairable] } });
    expect(r1.ok).toBe(true);
    expect(repairable.calls).toHaveLength(2);

    const broken = fakeProvider("groq", ["garbage", "still garbage"]);
    const r2 = await learnVoiceProfile({ samples: ["s"], deps: { chain: [broken] } });
    expect(r2.ok).toBe(false);
    if (!r2.ok) {
      expect(r2.profile).toEqual(DEFAULT_VOICE_PROFILE);
      expect(r2.errorCode).toBeTruthy();
    }
  });

  it("a provider outage returns the default profile, not a crash", async () => {
    const res = await learnVoiceProfile({ samples: ["s"], deps: { chain: [failingProvider("glm-coding")] } });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.profile).toEqual(DEFAULT_VOICE_PROFILE);
  });
});

describe("previewVoice", () => {
  it("returns plain model text (not JSON)", async () => {
    const p = fakeProvider("groq", ["Here is the thing: focus is a habit."]);
    const res = await previewVoice({ voice: PROFILE, deps: { chain: [p] } });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.text).toContain("focus is a habit");
    expect(p.calls[0].json).toBe(false);
  });
});
