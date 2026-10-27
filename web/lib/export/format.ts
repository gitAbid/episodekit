// M7 copy & export presets — Apple Podcasts / Spotify / YouTube / Markdown /
// Plain text + "Download all (.md)". Pure functions over artifact content
// (§7.2 shapes) + segments (quote/chapter rendering by reference). The free
// plan appends the footer line "Show notes made with EpisodeKit".
/** Minimal transcript line the pure export functions need. */
export interface SegmentLike {
  id: string;
  text: string;
}

export const FREE_FOOTER = "Show notes made with EpisodeKit";
export const APPLE_LIMIT = 4000;
export const SPOTIFY_LIMIT = 4000;

export type Destination = "apple" | "spotify" | "youtube" | "markdown" | "plain";

export const DESTINATION_LABELS: Record<Destination, string> = {
  apple: "Apple Podcasts",
  spotify: "Spotify",
  youtube: "YouTube",
  markdown: "Markdown",
  plain: "Plain text",
};

export interface ExportContext {
  segments: SegmentLike[];
  showName: string;
  episodeTitle: string | null;
  freePlan: boolean;
}

interface ChapterItem {
  startMs: number;
  title: string;
}

function mmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** YouTube chapters use bare `0:00` timestamps (M7). */
function youtubeTs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` : `${m}:${String(s % 60).padStart(2, "0")}`;
}

function segmentText(ref: { segmentId: string; start: number; end: number; endSegmentId?: string }, segments: SegmentLike[]): string {
  const ids = ref.endSegmentId ? [ref.segmentId, ref.endSegmentId] : [ref.segmentId];
  const parts: string[] = [];
  for (const id of ids) {
    const seg = segments.find((s) => s.id === id);
    if (seg) parts.push(seg.text.slice(ref.segmentId === id ? ref.start : 0, ref.segmentId === id ? ref.end : (ref.endSegmentId === id ? ref.end : undefined)));
  }
  return parts.join(" ").trim();
}

function quoteLine(ref: unknown, segments: SegmentLike[]): string {
  const text = segmentText(ref as { segmentId: string; start: number; end: number; endSegmentId?: string }, segments);
  return text ? `“${text}”` : "";
}

export function renderChapters(chapters: ChapterItem[], dest: Destination): string {
  if (chapters.length === 0) return "";
  const ts = dest === "youtube" ? youtubeTs : mmss;
  return chapters.map((c) => `${ts(c.startMs)} ${c.title}`).join("\n");
}

/** Show notes → destination text (M7: Apple/Spotify plain ≤4000 with chapters appended). */
export function showNotesToText(content: Record<string, unknown>, ctx: ExportContext, dest: Destination, chapters: ChapterItem[]): string {
  const lines: string[] = [];
  if (ctx.episodeTitle) lines.push(ctx.episodeTitle, "");
  const hook = typeof content.hook === "string" ? content.hook : "";
  if (hook) lines.push(hook, "");
  const bullets = Array.isArray(content.bullets) ? (content.bullets as string[]) : [];
  if (bullets.length) {
    lines.push("In this episode");
    lines.push(...bullets.map((b) => `• ${b}`));
    lines.push("");
  }
  if (typeof content.guestLine === "string" && content.guestLine) {
    lines.push(content.guestLine, "");
  }
  const chText = renderChapters(chapters, dest);
  if (chText) lines.push("Chapters", chText, "");
  const quotes = Array.isArray(content.quoteRefs) ? (content.quoteRefs as unknown[]) : [];
  for (const q of quotes) {
    const line = quoteLine(q, ctx.segments);
    if (line) lines.push(line, "— from the episode", "");
  }
  if (typeof content.cta === "string" && content.cta) lines.push(content.cta);
  let text = lines.join("\n").trim();
  if (ctx.freePlan) text += `\n\n${FREE_FOOTER}`;
  return text;
}

/** Blog body contains {{quote:1}} placeholders rendered from refs (§7.2). */
export function renderBlogBody(bodyMarkdown: string, quoteRefs: unknown[], ctx: ExportContext): string {
  return bodyMarkdown.replace(/\{\{quote:(\d+)\}\}/g, (_m, n) => {
    const ref = quoteRefs[Number(n) - 1];
    const line = ref ? quoteLine(ref, ctx.segments) : "";
    return line || "";
  });
}

export function blogToMarkdown(content: Record<string, unknown>, ctx: ExportContext): string {
  const body = renderBlogBody(typeof content.bodyMarkdown === "string" ? content.bodyMarkdown : "", Array.isArray(content.quoteRefs) ? (content.quoteRefs as unknown[]) : [], ctx);
  const fm = [
    "---",
    `title: "${String(content.seoTitle ?? ctx.episodeTitle ?? ctx.showName).replace(/"/g, '\\"')}"`,
    `description: "${String(content.metaDescription ?? "").replace(/"/g, '\\"')}"`,
    `slug: ${String(content.slug ?? "")}`,
    "---",
    "",
  ].join("\n");
  return fm + body;
}

export function summaryToText(content: Record<string, unknown>): string {
  return [content.oneLiner, content.short, content.long].filter((s) => typeof s === "string" && s).join("\n\n");
}

export function titlesToText(content: Record<string, unknown>): string {
  const items = Array.isArray(content.items) ? (content.items as { text: string; style?: string }[]) : [];
  return items.map((t) => (t.style ? `${t.text} (${t.style})` : t.text)).join("\n");
}

export function newsletterToText(content: Record<string, unknown>, ctx: ExportContext): string {
  const lines: string[] = [];
  const subjects = Array.isArray(content.subjects) ? (content.subjects as string[]) : [];
  if (subjects.length) lines.push(subjects.map((s) => `- ${s}`).join("\n"), "");
  if (typeof content.previewText === "string" && content.previewText) lines.push(content.previewText, "");
  const body = renderBlogBody(
    typeof content.bodyMarkdown === "string" ? content.bodyMarkdown : "",
    Array.isArray(content.quoteRefs) ? (content.quoteRefs as unknown[]) : [],
    ctx,
  );
  if (body) lines.push(body, "");
  if (typeof content.ctaText === "string" && content.ctaText) lines.push(content.ctaText);
  return lines.join("\n").trim();
}

export function socialToText(content: Record<string, unknown>): string {
  const lines: string[] = [];
  if (typeof content.linkedin === "string" && content.linkedin) lines.push("LinkedIn", content.linkedin, "");
  const thread = Array.isArray(content.thread) ? (content.thread as string[]) : [];
  if (thread.length) {
    lines.push("Thread");
    lines.push(thread.map((p, i) => `${i + 1}/ ${p}`).join("\n\n"), "");
  }
  const ig = (content.instagram ?? {}) as { caption?: string; hashtags?: string[] };
  if (ig.caption) lines.push("Instagram", ig.caption, (ig.hashtags ?? []).map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" "));
  return lines.join("\n").trim();
}

export function quotesToText(content: Record<string, unknown>, ctx: ExportContext): string {
  const items = Array.isArray(content.items) ? (content.items as unknown[]) : [];
  return items
    .map((q) => quoteLine(q, ctx.segments))
    .filter(Boolean)
    .map((t) => `${t}\n— from the episode`)
    .join("\n\n");
}

export function destinationLimit(dest: Destination): number | null {
  if (dest === "apple") return APPLE_LIMIT;
  if (dest === "spotify") return SPOTIFY_LIMIT;
  return null;
}

/** U13: over limit → the UI shows a warning + "Shorten to fit" (AI). */
export function needsShortening(dest: Destination, text: string): boolean {
  const limit = destinationLimit(dest);
  return limit !== null && text.length > limit;
}

/** Deterministic last-resort shorten (only used when the AI shorten call is unavailable). */
export function shortenToLimit(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastBreak = Math.max(cut.lastIndexOf("\n"), cut.lastIndexOf(". "));
  return (lastBreak > limit * 0.6 ? cut.slice(0, lastBreak + 1) : cut).trim();
}

/** "Download all (.md)" — one Markdown file with every artifact (M7). */
export function downloadAllMarkdown(artifacts: Partial<Record<string, Record<string, unknown>>>, ctx: ExportContext, chapters: ChapterItem[]): string {
  const out: string[] = [`# ${ctx.episodeTitle ?? "Episode"} — ${ctx.showName}`, ""];
  const sections: [string, string][] = [
    ["Show notes", artifacts.show_notes ? showNotesToText(artifacts.show_notes, ctx, "markdown", chapters) : ""],
    ["Chapters", renderChapters(chapters, "markdown")],
    ["Summary", artifacts.summary ? summaryToText(artifacts.summary) : ""],
    ["Titles", artifacts.titles ? titlesToText(artifacts.titles) : ""],
    ["Blog post", artifacts.blog ? blogToMarkdown(artifacts.blog, ctx) : ""],
    ["Newsletter", artifacts.newsletter ? newsletterToText(artifacts.newsletter, ctx) : ""],
    ["Social posts", artifacts.social ? socialToText(artifacts.social) : ""],
    ["Quotes", artifacts.quotes ? quotesToText(artifacts.quotes, ctx) : ""],
  ];
  for (const [title, body] of sections) {
    if (!body) continue;
    out.push(`## ${title}`, "", body, "");
  }
  if (ctx.freePlan) out.push(FREE_FOOTER);
  return out.join("\n").trim() + "\n";
}
