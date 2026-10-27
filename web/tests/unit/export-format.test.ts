import { describe, expect, it } from "vitest";
import {
  DESTINATION_LABELS,
  downloadAllMarkdown,
  needsShortening,
  renderBlogBody,
  shortenToLimit,
  showNotesToText,
  titlesToText,
  quotesToText,
  renderChapters,
} from "@/lib/export/format";
import type { Segment } from "@/lib/quotes/types";

const segments: Segment[] = [
  { id: "seg_000001", idx: 0, speaker: "Maya", startMs: 72_000, endMs: 100_000, text: "We budget our dollars, we calendar our hours, and then we let anyone spend our attention for free." },
  { id: "seg_000002", idx: 1, speaker: "Dev", startMs: 460_000, endMs: 500_000, text: "A to-do item is a promise you made to yourself." },
];

const ctx = { segments, showName: "The Focus Hour", episodeTitle: "Ep 42", freePlan: true };

const chapters = [
  { startMs: 0, title: "Why focus is a budget" },
  { startMs: 300_000, title: "Calendars beat to-do lists" },
];

describe("copy presets (M7)", () => {
  it("Apple Podcasts: plain text with chapters appended and the free footer", () => {
    const text = showNotesToText({ hook: "Focus is a budget.", bullets: ["Why attention compounds"], cta: "Follow the show." }, ctx, "apple", chapters);
    expect(text).toContain("In this episode");
    expect(text).toContain("00:00 Why focus is a budget");
    expect(text).toContain("05:00 Calendars beat to-do lists");
    expect(text.trim().endsWith("Show notes made with EpisodeKit")).toBe(true);
  });

  it("YouTube chapters use bare 0:00 timestamps", () => {
    expect(renderChapters(chapters, "youtube")).toBe("0:00 Why focus is a budget\n5:00 Calendars beat to-do lists");
  });

  it("Pro plan adds no footer", () => {
    const text = showNotesToText({ hook: "h", bullets: [], cta: "c" }, { ...ctx, freePlan: false }, "plain", []);
    expect(text).not.toContain("Show notes made with EpisodeKit");
  });

  it("U13: Apple/Spotify over 4000 chars need shortening; markdown never does", () => {
    const long = "x".repeat(4001);
    expect(needsShortening("apple", long)).toBe(true);
    expect(needsShortening("spotify", long)).toBe(true);
    expect(needsShortening("markdown", long)).toBe(false);
    const shortened = shortenToLimit(long, 4000);
    expect(shortened.length).toBeLessThanOrEqual(4000);
  });
});

describe("quotes render from transcript text by reference (§7.3)", () => {
  it("renders QuoteRef offsets against the original segment text", () => {
    const out = quotesToText(
      { items: [{ segmentId: "seg_000001", start: 0, end: 46 }] },
      ctx,
    );
    expect(out).toContain("We budget our dollars");
    expect(out).toContain("— from the episode");
  });

  it("blog {{quote:n}} placeholders render from refs", () => {
    const text = "A to-do item is a promise you made to yourself.";
    const body = renderBlogBody("She said {{quote:1}} and meant it.", [{ segmentId: "seg_000002", start: 0, end: text.length }], ctx);
    expect(body).toBe(`She said “${text}” and meant it.`);
  });
});

describe("titles + download all (M7)", () => {
  it("titles list with style tags", () => {
    expect(titlesToText({ items: [{ text: "Attention is a budget", style: "Curiosity" }] })).toBe("Attention is a budget (Curiosity)");
  });

  it("download all (.md) contains every ready section", () => {
    const md = downloadAllMarkdown(
      {
        show_notes: { hook: "h", bullets: ["b"], cta: "c" },
        summary: { oneLiner: "one", short: "short", long: "long" },
        titles: { items: [{ text: "t", style: "Curiosity", starred: false }] },
        quotes: { items: [{ segmentId: "seg_000001", start: 0, end: 46 }] },
      },
      ctx,
      chapters,
    );
    expect(md.startsWith("# Ep 42 — The Focus Hour")).toBe(true);
    for (const section of ["## Show notes", "## Chapters", "## Summary", "## Titles", "## Quotes"]) {
      expect(md).toContain(section);
    }
    expect(md).toContain("Show notes made with EpisodeKit");
  });
});
