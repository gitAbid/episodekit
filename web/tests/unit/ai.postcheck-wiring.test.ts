// §8.4 wiring primitives in lib/ai/postcheck.ts: URL allowance (with subpath
// rule) and banned-phrase replacement (U8 last resort).
import { describe, expect, it } from "vitest";
import {
  applyDeterministicPostChecks,
  collectStrings,
  replaceBannedPhrases,
  scanContent,
  stripForeignUrlsInContent,
} from "@/lib/ai/postcheck";
import { DEFAULT_VOICE_PROFILE } from "@/lib/ai/voice";

describe("stripForeignUrlsInContent", () => {
  it("keeps allowed URLs and their subpaths, strips foreign ones", () => {
    const content = {
      a: "Listen at https://show.example/ep-12 today.",
      b: "See https://evil.example.net/track.",
      c: "Base https://show.example works too.",
    };
    const out = stripForeignUrlsInContent(content, ["https://show.example"]);
    expect(out.a).toBe("Listen at https://show.example/ep-12 today.");
    expect(out.b).toBe("See.");
    expect(out.c).toBe("Base https://show.example works too.");
  });

  it("strips everything when the allow list is empty", () => {
    const out = stripForeignUrlsInContent({ t: "Go to https://x.example." }, []);
    expect(out.t).toBe("Go to.");
  });

  it("leaves text without URLs untouched (no whitespace surprises)", () => {
    const text = "Keep  this   exactly — including double spaces.\n\nAnd breaks.";
    expect(stripForeignUrlsInContent({ text }, ["https://show.example"]).text).toBe(text);
  });
});

describe("replaceBannedPhrases (U8 last resort)", () => {
  it("removes banned terms at word boundaries and cleans up whitespace", () => {
    const out = replaceBannedPhrases(
      { hook: "We delve into game-changing ideas to unlock focus.", bullets: ["stay grounded"] },
      ["delve", "game-changer", "unlock"],
    );
    expect(out.hook).toBe("We into game-changing ideas to focus.");
    expect(out.bullets).toEqual(["stay grounded"]);
  });

  it("multi-word banned terms match across whitespace variance", () => {
    const out = replaceBannedPhrases({ t: "time to dive  deep now" }, ["dive deep"]);
    expect(out.t).toBe("time to now");
  });
});

describe("scanContent + applyDeterministicPostChecks", () => {
  it("scans nested strings for neverSay and religion framing", () => {
    const v = scanContent({ a: ["We delve into the sermon."], b: "clean" }, DEFAULT_VOICE_PROFILE);
    expect(v.neverSay).toEqual(["delve"]);
    expect(v.religion).toContain("sermon");
  });

  it("applyDeterministicPostChecks strips URLs then banned phrases", () => {
    const out = applyDeterministicPostChecks(
      { t: "We unlock focus at https://evil.example now — delve in." },
      DEFAULT_VOICE_PROFILE,
      [],
    );
    expect(out.t).toBe("We focus at now — in.");
    expect(collectStrings(out).join(" ")).not.toMatch(/delve|unlock|evil\.example/i);
  });
});
