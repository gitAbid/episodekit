// Deterministic fallback builder: engine output mapped to §7.2 artifact kinds,
// honestly derived from the transcript only.
import { describe, expect, it } from "vitest";
import { buildDeterministicArtifact } from "@/lib/ai/fallback";
import { quoteText } from "@/lib/quotes";
import { demoSegments, makeSegments } from "./helpers/ai";
import { normalizeWs } from "@/lib/engine";
import type { ArtifactKind } from "@/lib/artifacts/schemas";

const show = { name: "The Focus Show", defaultCta: "Follow the show.", allowedUrls: [] };
const fullText = demoSegments.map((s) => s.text).join(" ");

type Obj = Record<string, unknown>;
function build(kind: ArtifactKind, ctx?: { meta?: { guests: string[] } }): Obj {
  return buildDeterministicArtifact(kind, {
    segments: demoSegments,
    show,
    ...(ctx?.meta ? { meta: ctx.meta } : {}),
  }) as Obj;
}

describe("buildDeterministicArtifact", () => {
  it("titles are ≤80 chars with valid styles", () => {
    const items = build("titles").items as Array<{ text: string; style: string; starred: boolean }>;
    expect(items.length).toBeGreaterThanOrEqual(4);
    for (const t of items) {
      expect(t.text.length).toBeLessThanOrEqual(80);
      expect(["Curiosity", "Benefit", "Guest", "Number", "Question", "Quote"]).toContain(t.style);
      expect(t.starred).toBe(false);
    }
  });

  it("summary respects the one-liner limit and is extractive", () => {
    const c = build("summary") as { oneLiner: string; short: string; long: string };
    expect(c.oneLiner.length).toBeLessThanOrEqual(140);
    expect(normalizeWs(c.long)).toBeTruthy();
    for (const field of [c.short, c.long]) {
      // every fallback summary sentence exists in the transcript
      for (const s of field.split(/(?<=[.!?])\s+/)) {
        const cleaned = s.replace(/^[“"']+|[“"']+$/g, "");
        if (cleaned.length > 20) expect(fullText).toContain(cleaned);
      }
    }
  });

  it("show notes bullets are transcript sentences and CTA comes from settings", () => {
    const c = build("show_notes") as { bullets: string[]; cta: string; quoteRefs: unknown[] };
    expect(c.bullets.length).toBeGreaterThanOrEqual(4);
    for (const b of c.bullets) expect(fullText).toContain(b);
    expect(c.cta).toBe(show.defaultCta);
    expect(c.quoteRefs).toEqual([]);
  });

  it("guest line only appears when guests are provided", () => {
    const noGuests = build("show_notes") as { guestLine?: string };
    expect(noGuests.guestLine).toBeUndefined();
    const withGuests = build("show_notes", { meta: { guests: ["Maya", "Dev"] } }) as {
      guestLine?: string;
    };
    expect(withGuests.guestLine).toContain("Maya");
    expect(withGuests.guestLine).toContain("Dev");
  });

  it("chapters use real timestamps, first at 0, and are honest", () => {
    const items = build("chapters").items as Array<{ startMs: number; title: string }>;
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0].startMs).toBe(0);
    for (const item of items) {
      expect(item.title.length).toBeLessThanOrEqual(50);
      expect(item.startMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("blog keeps SEO limits and references no invented quotes", () => {
    const c = build("blog") as {
      seoTitle: string;
      metaDescription: string;
      slug: string;
      bodyMarkdown: string;
      quoteRefs: unknown[];
    };
    expect(c.seoTitle.length).toBeLessThanOrEqual(60);
    expect(c.metaDescription.length).toBeLessThanOrEqual(155);
    expect(c.slug).toMatch(/^[a-z0-9-]+$/);
    expect(c.bodyMarkdown).toContain("## ");
    expect(c.quoteRefs).toEqual([]);
  });

  it("newsletter and social shapes are complete", () => {
    const n = build("newsletter") as {
      subjects: string[];
      chosen: number;
      previewText: string;
      ctaText: string;
    };
    expect(n.subjects).toHaveLength(3);
    expect(n.chosen).toBe(0);
    expect(n.previewText.length).toBeLessThanOrEqual(90);
    expect(n.ctaText.length).toBeLessThanOrEqual(30);

    const s = build("social") as {
      linkedin: string;
      thread: string[];
      instagram: { caption: string; hashtags: string[] };
    };
    expect(s.linkedin.length).toBeLessThanOrEqual(1300);
    for (const t of s.thread) expect(t.length).toBeLessThanOrEqual(280);
    expect(s.instagram.caption.length).toBeLessThanOrEqual(2200);
    expect(s.instagram.hashtags.length).toBeGreaterThanOrEqual(5);
    for (const h of s.instagram.hashtags) expect(h).toMatch(/^#[a-z0-9]+$/i);
  });

  it("quotes are verbatim segment text within limits", () => {
    const items = build("quotes").items as Array<{ segmentId: string; start: number; end: number }>;
    expect(items.length).toBeGreaterThan(0);
    for (const ref of items) {
      const text = quoteText(ref, demoSegments);
      const seg = demoSegments.find((s) => s.id === ref.segmentId)!;
      expect(seg.text).toContain(text);
      expect(text.length).toBeGreaterThanOrEqual(40);
      expect(text.length).toBeLessThanOrEqual(240);
    }
  });

  it("a tiny transcript still produces safe fallback content (no crash)", () => {
    const tiny = makeSegments("This is one short episode sentence about focus.");
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
      const c = buildDeterministicArtifact(kind, { segments: tiny, show });
      expect(c).toBeTruthy();
    }
  });
});
