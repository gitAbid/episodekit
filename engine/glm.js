// SermonKit GLM-enhanced generation — chat completions with strict validation.
// HONESTY RULE: any "quote" an AI returns must be an exact substring of the
// source sermon. If an artifact fails validation, that artifact silently falls
// back to the deterministic build. The API key never leaves the server.

import { generateSuiteDeterministic, normalizeWs, words } from "./lib.js";

const ENDPOINT = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const TIMEOUT_MS = 45000;

export function hasGlm() {
  return Boolean(process.env.GLM_API_KEY);
}

async function chat(messages, { temperature = 0.7, json = true } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.GLM_MODEL || "glm-4-flash",
        messages,
        temperature,
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error("upstream_" + res.status);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("empty_completion");
    return json ? JSON.parse(content) : content;
  } finally {
    clearTimeout(timer);
  }
}

const SYS =
  "You produce church communication artifacts from sermon transcripts. " +
  "ABSOLUTE RULE: any field named quote/anchor/pullQuote must be copied VERBATIM " +
  "from the transcript — same words, same punctuation. If you paraphrase, the " +
  "output is discarded. Warm, plain language. JSON only, no markdown.";

function isExactQuote(q, source) {
  return typeof q === "string" && q.length > 20 && normalizeWs(source).includes(normalizeWs(q));
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
  if (Array.isArray(ai.devotionals) && ai.devotionals.length >= 5 &&
      ai.devotionals.every((d) => isExactQuote(d?.anchor, source))) {
    out.devotionals = ai.devotionals.slice(0, 5).map((d, i) => ({
      day: i + 1,
      title: String(d.title || `Day ${i + 1}`).slice(0, 80),
      anchor: d.anchor,
      reflection: String(d.reflection || d.anchor).slice(0, 1200),
      action: String(d.action || "").slice(0, 400),
      prayer: String(d.prayer || "Amen.").slice(0, 400),
    }));
  }
  if (Array.isArray(ai.social?.pullQuotes) && ai.social.pullQuotes.length >= 2 &&
      ai.social.pullQuotes.every((q) => isExactQuote(q, source))) {
    out.social = { ...base.social, pullQuotes: ai.social.pullQuotes.slice(0, 3) };
  }
  if (ai.discussionGuide && Array.isArray(ai.discussionGuide.qs) && ai.discussionGuide.qs.length >= 4 &&
      ai.discussionGuide.qs.every((q) => isExactQuote(q?.quote, source))) {
    out.discussionGuide = {
      title: String(ai.discussionGuide.title || base.discussionGuide.title).slice(0, 120),
      icebreaker: String(ai.discussionGuide.icebreaker || base.discussionGuide.icebreaker),
      open: Array.isArray(ai.discussionGuide.open) && ai.discussionGuide.open.length >= 2
        ? ai.discussionGuide.open.map(String).slice(0, 4) : base.discussionGuide.open,
      qs: ai.discussionGuide.qs.slice(0, 6).map((q) => ({ quote: q.quote, follow: String(q.follow || "What stands out to you, and why?") })),
      living: base.discussionGuide.living,
      prayer: String(ai.discussionGuide.prayer || base.discussionGuide.prayer),
    };
  }
  // Manuscript headings from AI are hard to verify — keep deterministic manuscript
  // (it is fully extractive by construction).
  return out;
}

export async function generateSuiteGlm(rawText) {
  const text = normalizeWs(rawText); // quotes validate against normalized text
  const base = generateSuiteDeterministic(text);
  if (!hasGlm()) return base;
  try {
    const ai = await chat([
      { role: "system", content: SYS },
      {
        role: "user",
        content:
          "From the sermon transcript below, return JSON with keys: " +
          "titles (6 strings), summary ({text: 120-180 words}), " +
          "devotionals (5 objects {title, anchor: EXACT quote, reflection, action, prayer}), " +
          "social ({pullQuotes: 3 EXACT quotes}), " +
          "discussionGuide ({title, icebreaker, open: 3 strings, qs: 6 objects {quote: EXACT quote, follow}, prayer}). " +
          "Transcript:\n\n" + text.slice(0, 60000),
      },
    ]);
    const validated = validateSuite(ai, text, base);
    return validated || base;
  } catch {
    return base; // any AI failure → deterministic suite, never a user-facing error
  }
}
