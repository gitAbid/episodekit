// §8.4 post-checks as pure library functions: limits trim, neverSay
// word-boundary scan, foreign-URL strip, religion-neutral gate.
// The religion gate applies to GENERATED framing only — never to transcript
// quotes (a transcript mentioning "church" is content, not framing).
import { describe, expect, it } from "vitest";
import {
  isReligionNeutral,
  neverSayViolations,
  religionViolations,
  stripForeignUrls,
  trimAtSentenceBoundary,
  wordCount,
} from "@/lib/artifacts/postcheck";
import { generateSuiteDeterministic, normalizeWs } from "@/lib/engine";
import { readFileSync } from "node:fs";

describe("religion-neutral gate (term list from engine/test.js)", () => {
  it.each(["sermon", "church", "devotional", "prayer", "jesus", "pastor"])(
    "flags %s",
    (term) => {
      expect(religionViolations(`This ${term} matters.`)).toContain(term);
      expect(isReligionNeutral(`This ${term} matters.`)).toBe(false);
    },
  );

  it("flags god with a word boundary, like the legacy regex", () => {
    expect(religionViolations("oh my god")).toContain("god");
    expect(religionViolations("God willing")).toContain("god");
    expect(religionViolations("godly discipline")).toEqual([]); // no boundary after 'god'
    expect(religionViolations("goddess")).toEqual([]);
  });

  it("is case-insensitive", () => {
    expect(religionViolations("The CHURCH of tight deadlines")).toContain("church");
  });

  it("passes neutral generated copy", () => {
    expect(isReligionNeutral("Focus is the most expensive resource. Spend it like money.")).toBe(
      true,
    );
  });

  it("the deterministic engine's generated framing passes the gate", () => {
    const episode = readFileSync(
      new URL("../fixtures/demo-episode.txt", import.meta.url),
      "utf8",
    );
    const suite = generateSuiteDeterministic(normalizeWs(episode.split("\n---")[0]));
    expect(isReligionNeutral(JSON.stringify(suite))).toBe(true);
  });

  it("exports the exact legacy term list", () => {
    const flat = "sermon church devotional prayer jesus god pastor".split(" ");
    for (const term of flat) expect(religionViolations(term)).toContain(term);
  });
});

describe("neverSay word-boundary scan", () => {
  const neverSay = ["delve", "game-changer", "unlock", "dive deep", "in today's fast-paced world"];

  it("flags exact terms", () => {
    expect(neverSayViolations("We delve into focus.", neverSay)).toEqual(["delve"]);
    expect(neverSayViolations("A real game-changer, folks.", neverSay)).toEqual(["game-changer"]);
    expect(neverSayViolations("Unlock your potential.", neverSay)).toEqual(["unlock"]);
  });

  it("matches multi-word terms across whitespace variance", () => {
    expect(neverSayViolations("time to dive  deep now", neverSay)).toEqual(["dive deep"]);
    expect(neverSayViolations("In today's fast-paced world, focus wins.", neverSay)).toEqual([
      "in today's fast-paced world",
    ]);
  });

  it("respects word boundaries", () => {
    expect(neverSayViolations("delving into the archives", neverSay)).toEqual([]);
    expect(neverSayViolations("game-changers abound", neverSay)).toEqual([]);
    expect(neverSayViolations("the lock was sturdy", neverSay)).toEqual([]);
  });

  it("returns all violations and stays case-insensitive", () => {
    expect(neverSayViolations("UNLOCK and delve", neverSay).sort()).toEqual(["delve", "unlock"]);
    expect(neverSayViolations("clean copy", neverSay)).toEqual([]);
  });
});

describe("strip URLs not in show settings", () => {
  it("removes foreign URLs, keeps allowed ones", () => {
    const out = stripForeignUrls(
      "Listen at https://example.com/ep1 or https://evil.example.net/track.",
      ["https://example.com/ep1"],
    );
    expect(out).toContain("https://example.com/ep1");
    expect(out).not.toContain("evil.example.net");
  });

  it("keeps trailing sentence punctuation intact", () => {
    const out = stripForeignUrls("Go to https://evil.example.net. Then subscribe.", []);
    expect(out).toBe("Go to. Then subscribe.");
  });

  it("passes text without URLs through unchanged", () => {
    expect(stripForeignUrls("No links here.", [])).toBe("No links here.");
  });
});

describe("limits trim (sentence boundary)", () => {
  it("cuts at the last sentence end within the cap", () => {
    const text = `${"a".repeat(60)}. ${"b".repeat(60)}. ${"c".repeat(60)}.`;
    expect(trimAtSentenceBoundary(text, 130)).toBe(`${"a".repeat(60)}. ${"b".repeat(60)}.`);
  });

  it("falls back to a word boundary when no sentence end fits", () => {
    const text = "word ".repeat(40).trim();
    const out = trimAtSentenceBoundary(text, 20);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(text.startsWith(out)).toBe(true);
  });

  it("leaves text within the cap untouched", () => {
    expect(trimAtSentenceBoundary("Short. Sweet.", 100)).toBe("Short. Sweet.");
  });

  it("counts words the way limits are specified (whitespace tokens)", () => {
    expect(wordCount("one two  three\nfour")).toBe(4);
    expect(wordCount("  ")).toBe(0);
  });
});
