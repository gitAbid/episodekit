// §8.1 last resort — the deterministic builder (lib/engine, TS port of
// engine/lib.js) mapped onto §7.2 artifact kinds. Everything here is derived
// from the transcript or from user-provided metadata: nothing is invented.
// Content produced this way is stored with artifact status "fallback" (U10:
// "basic package labelled with the fallback banner") and is NOT held to the AI
// content minima (e.g. exactly 8 titles) — honesty beats schema padding.
import {
  analyzeTranscript,
  buildArticle,
  buildSocialPack,
  buildSummary,
  buildTitles,
  normalizeWs,
  rankedSentences,
} from "@/lib/engine";
import { candidateQuoteRefs } from "@/lib/quotes/candidates";
import { trimAtSentenceBoundary } from "@/lib/artifacts/postcheck";
import type { ArtifactKind, TitleStyle } from "@/lib/artifacts/schemas";
import type { Segment } from "@/lib/quotes/types";
import type { EpisodeMeta, ShowContext } from "@/lib/prompts";

export interface FallbackContext {
  segments: Segment[];
  show: ShowContext;
  meta?: EpisodeMeta;
}

const DEFAULT_CTA = "Invite listeners to follow the show.";

function transcriptText(segments: Segment[]): string {
  return normalizeWs(segments.map((s) => s.text).join(" "));
}

/** Classify an extractive title into one of the 6 §7.2 styles. */
function classifyTitle(text: string): TitleStyle {
  if (/^(what|why|how)\b/i.test(text)) return "Question";
  if (/\d/.test(text)) return "Number";
  return "Curiosity";
}

/** First maxWords of the text (fallback content is extractive, not re-written). */
function clipToWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  return words.length <= maxWords ? text : words.slice(0, maxWords).join(" ");
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "episode"
  );
}

export function buildDeterministicArtifact(kind: ArtifactKind, ctx: FallbackContext): Record<string, unknown> {
  const text = transcriptText(ctx.segments);
  const a = analyzeTranscript(text);
  a.ranked = a.ranked ?? rankedSentences(a.sents, a.themes);
  const cta = ctx.show.defaultCta || DEFAULT_CTA;

  switch (kind) {
    case "titles": {
      const items = buildTitles(a).map((t) => ({
        text: t.slice(0, 80),
        style: classifyTitle(t),
        starred: false,
      }));
      return { items };
    }
    case "summary": {
      const summary = buildSummary(a);
      const oneLiner = trimAtSentenceBoundary(summary.text, 140) || a.keyQuotes[0]?.slice(0, 140) || "";
      return { oneLiner, short: clipToWords(summary.text, 80), long: summary.text };
    }
    case "show_notes": {
      const hook = a.keyQuotes.slice(0, 2).join(" ");
      const bullets = a.keyQuotes.slice(2, 8);
      const guestLine = ctx.meta?.guests?.length ? `Featuring ${ctx.meta.guests.join(" and ")}.` : undefined;
      return {
        hook,
        bullets: bullets.length >= 4 ? bullets : a.keyQuotes.slice(0, 4),
        ...(guestLine ? { guestLine } : {}),
        quoteRefs: [],
        cta,
      };
    }
    case "chapters": {
      const timed = ctx.segments.some((s) => s.startMs !== null);
      if (!timed) return { items: [] };
      const n = ctx.segments.length;
      const target = Math.max(1, Math.min(8, Math.round(n / 6)));
      const items: Array<{ startMs: number; title: string }> = [];
      const used = new Set<string>();
      for (let m = 0; m < target; m++) {
        const chunk = ctx.segments.slice(Math.floor((m * n) / target), Math.floor(((m + 1) * n) / target));
        if (!chunk.length || chunk[0].startMs === null) continue;
        const localThemes = analyzeTranscript(chunk.map((s) => s.text).join(" ")).themes;
        let title = localThemes[0] || a.themes[m] || "Episode section";
        if (used.has(title) && localThemes[1]) title = localThemes[1];
        used.add(title);
        items.push({
          startMs: m === 0 ? 0 : (chunk[0].startMs as number),
          title: (title.charAt(0).toUpperCase() + title.slice(1)).slice(0, 50),
        });
      }
      return { items };
    }
    case "blog": {
      const article = buildArticle(text, a);
      const summary = buildSummary(a);
      return {
        seoTitle: trimAtSentenceBoundary(article.title, 60),
        metaDescription: trimAtSentenceBoundary(summary.text, 155),
        slug: slugify(article.title),
        bodyMarkdown: article.sections
          .map((sec) => `## ${sec.heading}\n\n${sec.paragraphs.join("\n\n")}`)
          .join("\n\n"),
        quoteRefs: [],
      };
    }
    case "newsletter": {
      const summary = buildSummary(a);
      const titles = buildTitles(a);
      return {
        subjects: [titles[0] || "New episode", titles[1] || "This week", titles[2] || "Latest show"].map((t) =>
          t.slice(0, 80),
        ),
        chosen: 0,
        previewText: trimAtSentenceBoundary(summary.text, 90),
        bodyMarkdown: `${summary.text}\n\n${cta}`,
        quoteRefs: [],
        ctaText: trimAtSentenceBoundary(cta, 30),
      };
    }
    case "social": {
      const social = buildSocialPack(a);
      const caption = trimAtSentenceBoundary(social.captions[0]?.text ?? a.keyQuotes[0] ?? "", 2200);
      const hashtags = a.themes
        .filter((t) => t.length >= 4)
        .slice(0, 8)
        .map((t) => `#${t.replace(/[^a-z0-9]/gi, "")}`)
        .filter((h) => h.length > 1);
      return {
        linkedin: trimAtSentenceBoundary(caption, 1300),
        thread: social.xPosts.map((p) => p.text).slice(0, 6),
        instagram: { caption, hashtags },
      };
    }
    case "quotes": {
      return { items: candidateQuoteRefs(ctx.segments, { count: 5 }) };
    }
  }
}
