// §7.2 artifact content shapes (Zod, web/lib/artifacts/schemas.ts).
import { describe, expect, it } from "vitest";
import {
  ARTIFACT_KINDS,
  BlogSchema,
  ChaptersSchema,
  NewsletterSchema,
  QuotesSchema,
  ShowNotesSchema,
  SocialSchema,
  SummarySchema,
  TitlesSchema,
  artifactContentSchema,
  type QuoteRef,
} from "@/lib/artifacts/schemas";

const ref: QuoteRef = { segmentId: "seg_000001", start: 0, end: 120 };
const ref2: QuoteRef = { segmentId: "seg_000002", start: 10, end: 200, endSegmentId: "seg_000003" };
const style = "Curiosity" as const;
const title = { text: "A title", style, starred: false };
const titles8 = Array.from({ length: 8 }, () => ({ ...title }));

describe("QuoteRef", () => {
  it("accepts char offsets and optional endSegmentId", () => {
    expect(ShowNotesSchema.shape.quoteRefs.element.safeParse(ref).success).toBe(true);
    expect(ShowNotesSchema.shape.quoteRefs.element.safeParse(ref2).success).toBe(true);
  });

  it("rejects missing offsets or unknown fields shape", () => {
    expect(
      ShowNotesSchema.shape.quoteRefs.element.safeParse({ segmentId: "seg_000001" }).success,
        ).toBe(false);
    expect(
      ShowNotesSchema.shape.quoteRefs.element.safeParse({ ...ref, start: 1.5 }).success,
    ).toBe(false);
  });
});

describe("show_notes", () => {
  const valid = {
    hook: "A hook.",
    bullets: ["one", "two", "three", "four"],
    guestLine: "With Maya.",
    quoteRefs: [ref],
    cta: "Follow the show.",
  };
  it("accepts 4–7 bullets and 0–1 quoteRefs", () => {
    expect(ShowNotesSchema.safeParse(valid).success).toBe(true);
    expect(ShowNotesSchema.safeParse({ ...valid, guestLine: undefined, quoteRefs: [] }).success).toBe(
      true,
    );
  });
  it("rejects 3 or 8 bullets and 2 quoteRefs", () => {
    expect(ShowNotesSchema.safeParse({ ...valid, bullets: ["a", "b", "c"] }).success).toBe(false);
    expect(
      ShowNotesSchema.safeParse({ ...valid, bullets: Array.from({ length: 8 }, () => "x") }).success,
    ).toBe(false);
    expect(ShowNotesSchema.safeParse({ ...valid, quoteRefs: [ref, ref2] }).success).toBe(false);
  });
});

describe("chapters", () => {
  const chapter = { startMs: 0, title: "Intro" };
  const items = Array.from({ length: 5 }, (_, i) => ({ ...chapter, startMs: i * 180_000 }));
  it("accepts 5–12 items with titles ≤50", () => {
    expect(ChaptersSchema.safeParse({ items }).success).toBe(true);
    expect(ChaptersSchema.safeParse({ items: Array.from({ length: 12 }, () => chapter) }).success).toBe(
      true,
    );
  });
  it("rejects 4 or 13 items, long titles, bad startMs", () => {
    expect(ChaptersSchema.safeParse({ items: items.slice(0, 4) }).success).toBe(false);
    expect(
      ChaptersSchema.safeParse({ items: Array.from({ length: 13 }, () => chapter) }).success,
    ).toBe(false);
    expect(ChaptersSchema.safeParse({ items: [{ startMs: 0, title: "x".repeat(51) }] }).success).toBe(
      false,
    );
    expect(ChaptersSchema.safeParse({ items: [{ startMs: -1, title: "ok" }] }).success).toBe(false);
  });
});

describe("summary", () => {
  it("enforces oneLiner ≤140", () => {
    const valid = { oneLiner: "x".repeat(140), short: "short.", long: "long." };
    expect(SummarySchema.safeParse(valid).success).toBe(true);
    expect(SummarySchema.safeParse({ ...valid, oneLiner: "x".repeat(141) }).success).toBe(false);
  });
});

describe("titles", () => {
  it("requires exactly 8 items with style and starred", () => {
    expect(TitlesSchema.safeParse({ items: titles8 }).success).toBe(true);
    expect(TitlesSchema.safeParse({ items: titles8.slice(0, 7) }).success).toBe(false);
    expect(TitlesSchema.safeParse({ items: [...titles8, title] }).success).toBe(false);
    expect(
      TitlesSchema.safeParse({ items: [{ ...title, style: "Weird" }] , }).success,
    ).toBe(false);
    expect(TitlesSchema.safeParse({ items: [{ ...title, starred: "yes" }] }).success).toBe(false);
  });
  it("enforces title text ≤80", () => {
    expect(
      TitlesSchema.safeParse({ items: [{ ...title, text: "x".repeat(80) }] }).success,
    ).toBe(false); // only 1 item anyway
    const long = { ...title, text: "x".repeat(81) };
    expect(
      TitlesSchema.safeParse({ items: Array.from({ length: 8 }, () => long) }).success,
    ).toBe(false);
    expect(
      TitlesSchema.safeParse({
        items: Array.from({ length: 8 }, () => ({ ...title, text: "x".repeat(80) })),
      }).success,
    ).toBe(true);
  });
});

describe("blog", () => {
  const valid = {
    seoTitle: "Seo",
    metaDescription: "meta",
    slug: "my-episode",
    bodyMarkdown: "Body with {{quote:1}} placeholder.",
    quoteRefs: [ref, ref2],
  };
  it("accepts exactly 2 quoteRefs", () => {
    expect(BlogSchema.safeParse(valid).success).toBe(true);
    expect(BlogSchema.safeParse({ ...valid, quoteRefs: [ref] }).success).toBe(false);
  });
  it("enforces seoTitle ≤60 and metaDescription ≤155", () => {
    expect(BlogSchema.safeParse({ ...valid, seoTitle: "x".repeat(61) }).success).toBe(false);
    expect(
      BlogSchema.safeParse({ ...valid, metaDescription: "x".repeat(156) }).success,
    ).toBe(false);
  });
});

describe("newsletter", () => {
  const valid = {
    subjects: ["a", "b", "c"],
    chosen: 1,
    previewText: "preview",
    bodyMarkdown: "body",
    quoteRefs: [ref],
    ctaText: "Follow now",
  };
  it("accepts 3 subjects, chosen index, 1 quoteRef", () => {
    expect(NewsletterSchema.safeParse(valid).success).toBe(true);
    expect(NewsletterSchema.safeParse({ ...valid, subjects: ["a", "b"] }).success).toBe(false);
    expect(NewsletterSchema.safeParse({ ...valid, chosen: 3 }).success).toBe(false);
    expect(NewsletterSchema.safeParse({ ...valid, quoteRefs: [] }).success).toBe(false);
  });
  it("enforces previewText ≤90 and ctaText ≤30", () => {
    expect(NewsletterSchema.safeParse({ ...valid, previewText: "x".repeat(91) }).success).toBe(false);
    expect(NewsletterSchema.safeParse({ ...valid, ctaText: "x".repeat(31) }).success).toBe(false);
  });
});

describe("social", () => {
  const valid = {
    linkedin: "post",
    thread: Array.from({ length: 4 }, () => "x".repeat(280)),
    instagram: { caption: "cap", hashtags: ["#a", "#b", "#c", "#d", "#e"] },
  };
  it("accepts thread 4–6 of ≤280, 5–10 hashtags, linkedin ≤1300", () => {
    expect(SocialSchema.safeParse(valid).success).toBe(true);
    expect(
      SocialSchema.safeParse({
        ...valid,
        thread: Array.from({ length: 6 }, () => "x"),
        instagram: { caption: "c", hashtags: Array.from({ length: 10 }, () => "#h") },
      }).success,
    ).toBe(true);
  });
  it("rejects violations", () => {
    expect(SocialSchema.safeParse({ ...valid, linkedin: "x".repeat(1301) }).success).toBe(false);
    expect(
      SocialSchema.safeParse({ ...valid, thread: Array.from({ length: 3 }, () => "x") }).success,
    ).toBe(false);
    expect(
      SocialSchema.safeParse({
        ...valid,
        thread: Array.from({ length: 7 }, () => "x"),
      }).success,
    ).toBe(false);
    expect(
      SocialSchema.safeParse({ ...valid, thread: ["x".repeat(281), "x", "x", "x"] }).success,
    ).toBe(false);
    expect(
      SocialSchema.safeParse({
        ...valid,
        instagram: { caption: "x".repeat(2201), hashtags: Array.from({ length: 5 }, () => "#h") },
      }).success,
    ).toBe(false);
    expect(
      SocialSchema.safeParse({
        ...valid,
        instagram: { caption: "ok", hashtags: Array.from({ length: 4 }, () => "#h") },
      }).success,
    ).toBe(false);
  });
});

describe("quotes artifact", () => {
  it("requires exactly 5 QuoteRefs", () => {
    expect(QuotesSchema.safeParse({ items: Array.from({ length: 5 }, () => ref) }).success).toBe(
      true,
    );
    expect(QuotesSchema.safeParse({ items: Array.from({ length: 4 }, () => ref) }).success).toBe(
      false,
    );
  });
});

describe("artifactContentSchema registry", () => {
  it("covers every artifact kind from §7.1", () => {
    expect([...ARTIFACT_KINDS].sort()).toEqual(
      ["blog", "chapters", "newsletter", "quotes", "show_notes", "social", "summary", "titles"],
    );
    for (const kind of ARTIFACT_KINDS) {
      expect(artifactContentSchema(kind)).toBeDefined();
    }
  });
});
