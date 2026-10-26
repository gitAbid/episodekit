// EpisodeKit GLM-enhanced generation — chat completions with strict validation.
// HONESTY RULE: any "quote" an AI returns must be an exact substring of the
// source transcript. If an artifact fails validation, that artifact silently
// falls back to the deterministic build. The API key never leaves the server.

import { generateSuiteDeterministic, normalizeWs, stripSpeakerLabels, words } from "./lib.js";

// LLMs habitually return typographic variants of otherwise-verbatim text
// (curly quotes, em-dashes, ellipses). Normalize those before comparison so a
// genuinely verbatim quote is not rejected for punctuation styling — while a
// paraphrase still fails the substring check.
function normalizeQuoteStyle(s) {
  return String(s)
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/\u2014/g, "--")
    .replace(/\u2013/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    // LLMs mark truncation with ellipses; the visible text is still verbatim,
    // so strip edge ellipses and let the prefix match.
    .replace(/(^(\.\.\.|…)+\s*)|(\s*(\.\.\.|…)+$)/g, "");
}

const TIMEOUT_MS = 45000;

export function hasGlm() {
  return Boolean(process.env.GLM_API_KEY);
}

// GLM keys come in two flavors: bigmodel.cn (mainland) and z.ai (international).
// The endpoints are not interchangeable, and neither is reachable-diagnosable
// from inside a Vercel function, so try both — per-endpoint default models
// included — and remember nothing between requests.
const ENDPOINTS = [
  { url: "https://open.bigmodel.cn/api/paas/v4/chat/completions", model: "glm-4-flash" },
  { url: "https://api.z.ai/api/paas/v4/chat/completions", model: "glm-4-flash" },
  { url: "https://api.z.ai/api/paas/v4/chat/completions", model: "glm-4.5-flash" },
];

export async function chat(messages, { temperature = 0.7, json = true } = {}) {
  if (!process.env.GLM_API_KEY) throw new Error("no_key");
  const errors = [];
  for (const ep of ENDPOINTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(ep.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GLM_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.GLM_MODEL || ep.model,
          messages,
          temperature,
          ...(json ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        errors.push(`${new URL(ep.url).host}:${res.status}:${detail.slice(0, 120)}`);
        // 401/403 → key rejected by this endpoint; try the next flavor.
        continue;
      }
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) { errors.push(`${new URL(ep.url).host}:empty`); continue; }
      return json ? JSON.parse(content) : content;
    } catch (err) {
      errors.push(`${new URL(ep.url).host}:${err.name === "AbortError" ? "timeout" : err.message}`);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("all_endpoints_failed [" + errors.join(" | ") + "]");
}

const SYS =
  "You produce podcast content packages from episode transcripts: show-note " +
  "articles, community discussion kits, email series, and social copy. " +
  "ABSOLUTE RULE: any field named quote/anchor/pullQuote must be copied VERBATIM " +
  "from the transcript — same words, same punctuation. If you paraphrase, the " +
  "output is discarded. Warm, plain, energetic language. JSON only, no markdown.";

function isExactQuote(q, source) {
  if (typeof q !== "string" || q.length <= 20) return false;
  const norm = (t) => normalizeQuoteStyle(normalizeWs(t)).toLowerCase();
  return norm(source).includes(norm(q));
}

// Validate AI artifacts against the deterministic baseline. Returns the validated
// artifact or null (caller falls back). Exported for tests.
export function validateSuite(ai, source, base) {
  if (!ai || typeof ai !== "object") return null;
  const out = { ...base, engine: "glm" };

  if (Array.isArray(ai.titles) && ai.titles.length >= 4 && ai.titles.every((t) => typeof t === "string" && t.length > 3 && t.length < 80)) {
    out.titles = ai.titles.slice(0, 6);
  }
  if (typeof ai.summary?.text === "string") {
    const wc = words(ai.summary.text).length;
    if (wc >= 80 && wc <= 250) out.summary = { text: ai.summary.text, wordCount: wc };
  }
  if (Array.isArray(ai.series) && ai.series.length >= 5 &&
      ai.series.every((d) => isExactQuote(d?.anchor, source))) {
    out.series = ai.series.slice(0, 5).map((d, i) => ({
      day: i + 1,
      title: String(d.title || `Day ${i + 1}`).slice(0, 80),
      anchor: d.anchor,
      reflection: String(d.reflection || d.anchor).slice(0, 1200),
      action: String(d.action || "").slice(0, 400),
      closing: String(d.closing || "Reply and tell us what you think.").slice(0, 400),
    }));
  }
  if (Array.isArray(ai.social?.pullQuotes) && ai.social.pullQuotes.length >= 2 &&
      ai.social.pullQuotes.every((q) => isExactQuote(q, source))) {
    out.social = { ...base.social, pullQuotes: ai.social.pullQuotes.slice(0, 3) };
  }
  if (ai.discussion && Array.isArray(ai.discussion.qs) && ai.discussion.qs.length >= 4 &&
      ai.discussion.qs.every((q) => isExactQuote(q?.quote, source))) {
    out.discussion = {
      title: String(ai.discussion.title || base.discussion.title).slice(0, 120),
      opener: String(ai.discussion.opener || base.discussion.opener),
      open: Array.isArray(ai.discussion.open) && ai.discussion.open.length >= 2
        ? ai.discussion.open.map(String).slice(0, 4) : base.discussion.open,
      qs: ai.discussion.qs.slice(0, 6).map((q) => ({ quote: q.quote, follow: String(q.follow || "What stands out to you, and why?") })),
      apply: base.discussion.apply,
      closing: String(ai.discussion.closing || base.discussion.closing),
    };
  }
  // Article headings from AI are hard to verify — keep deterministic article
  // (it is fully extractive by construction).
  return out;
}

export async function generateSuiteGlm(rawText) {
  const text = normalizeWs(stripSpeakerLabels(rawText)); // quotes validate against normalized, label-free text
  const base = generateSuiteDeterministic(text);
  if (!hasGlm()) return base;
  try {
    const ai = await chat([
      { role: "system", content: SYS },
      {
        role: "user",
        content:
          "From the podcast episode transcript below, return JSON with keys: " +
          "titles (6 strings), summary ({text: 120-180 words}), " +
          "series (5 objects {title, anchor: EXACT quote, reflection, action, closing}), " +
          "social ({pullQuotes: 3 EXACT quotes}), " +
          "discussion ({title, opener, open: 3 strings, qs: 6 objects {quote: EXACT quote, follow}, closing}). " +
          "Transcript:\n\n" + text.slice(0, 60000),
      },
    ]);
    const validated = validateSuite(ai, text, base);
    return validated || base;
  } catch {
    return base; // any AI failure → deterministic suite, never a user-facing error
  }
}
