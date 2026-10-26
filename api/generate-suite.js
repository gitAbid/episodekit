// EpisodeKit suite generator — Vercel serverless function (Node, ESM).
// POST { mode: "discussion-guide" | "full" | "titles" | "series", text }
// - "full": complete content package via the engine. Uses GLM when GLM_API_KEY
//   is set (validated: quotes must be verbatim), otherwise the deterministic
//   engine. Either way the response is a valid suite — never a user-facing error.
// - "titles" / "series": deterministic engine slices for the free tools —
//   always work, no key needed.
// - "discussion-guide": AI-enhanced kit only; 503 when unconfigured so the
//   client falls back to its own offline generator.

import { generateSuiteGlm, hasGlm, chat } from "../engine/glm.js";
import { analyzeTranscript, sentences, normalizeWs, stripSpeakerLabels, buildTitles, buildEmailSeries, buildArticle } from "../engine/lib.js";

// The deterministic engine's sentence splitter and theme extractor are
// Latin-script; non-Latin transcripts (CJK/Cyrillic/Arabic…) would yield empty
// artifacts. Fail honestly instead of rendering a broken page.
function supportedInput(text) {
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  const letters = (text.match(/\p{L}/gu) || []).length;
  return letters === 0 ? false : latin / letters >= 0.6;
}

// Similarly guard degenerate shapes: too few distinct full sentences
// (no punctuation, all-short utterances, repetition) → empty artifacts.
function enoughSentences(text) {
  const seen = new Set();
  for (const s of sentences(normalizeWs(stripSpeakerLabels(text)))) {
    seen.add(s);
    if (seen.size >= 4) return true;
  }
  return false;
}

const TIMEOUT_MS = 45000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }
  const payload = typeof req.body === "object" && req.body ? req.body : {};
  const text = String(payload.text || "").trim();
  const mode = payload.mode || "discussion-guide";
  if (text.length < 200) {
    return res.status(400).json({ error: "text too short" });
  }
  if (text.length > 60000) {
    return res.status(413).json({ error: "text too long" });
  }
  if (!supportedInput(text)) {
    return res.status(400).json({ error: "english_transcripts_only_for_now" });
  }
  if (!enoughSentences(text)) {
    return res.status(400).json({ error: "not_enough_sentences" });
  }
  // Server-side usage event — activation is measurable from Vercel logs alone.
  console.log(JSON.stringify({ sk_usage: { t: Date.now(), mode, words: text.split(/\s+/).length } }));

  if (mode === "full") {
    const suite = await generateSuiteGlm(text);
    return res.status(200).json({ suite });
  }

  if (mode === "article") {
    const a = analyzeTranscript(text);
    return res.status(200).json({ article: buildArticle(text, a), themes: a.themes.slice(0, 5) });
  }

  if (mode === "titles" || mode === "series") {
    const a = analyzeTranscript(text);
    if (mode === "titles") {
      return res.status(200).json({ titles: buildTitles(a), themes: a.themes.slice(0, 5) });
    }
    return res.status(200).json({ series: buildEmailSeries(a) });
  }

  if (mode !== "discussion-guide") {
    return res.status(400).json({ error: "unknown mode" });
  }
  if (!hasGlm()) {
    return res.status(503).json({ error: "ai_not_configured" });
  }

  try {
    const guide = await chat(
      [
        {
          role: "system",
          content:
            "You write community discussion kits from podcast episode transcripts. " +
            "Ground every question in actual quotes or specific moments from the episode. Warm, plain, " +
            "energetic language. Never invent quotes that are not in the transcript.",
        },
        {
          role: "user",
          content:
            "From the episode transcript below, produce JSON only (no markdown) with keys: " +
            "title (string), opener (string), open (array of 3 strings), " +
            "qs (array of 6 objects {quote: exact sentence from the episode, follow: one follow-up question}), " +
            "apply (array of exactly 2 action-prompt strings), " +
            "closing (string). Transcript:\n\n" + text.slice(0, 60000),
        },
      ],
      { temperature: 0.7 },
    );
    return res.status(200).json({ guide });
  } catch (err) {
    return res.status(502).json({ error: "generation_failed", detail: String(err?.message || err).slice(0, 300) });
  }
}
