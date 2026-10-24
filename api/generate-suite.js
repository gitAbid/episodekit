// SermonKit suite generator — Vercel serverless function (Node, ESM).
// POST { mode: "discussion-guide" | "full" | "titles" | "devotionals", text }
// - "full": complete content suite via the engine. Uses GLM when GLM_API_KEY is
//   set (validated: quotes must be verbatim), otherwise the deterministic engine.
//   Either way the response is a valid suite — never a user-facing error.
// - "titles" / "devotionals": deterministic engine slices for the free tools —
//   always work, no key needed.
// - "discussion-guide": AI-enhanced guide only; 503 when unconfigured so the
//   client falls back to its own offline generator.

import { generateSuiteGlm, hasGlm } from "../engine/glm.js";
import { analyzeSermon, buildTitles, buildDevotionals } from "../engine/lib.js";

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

  if (mode === "full") {
    const suite = await generateSuiteGlm(text);
    return res.status(200).json({ suite });
  }

  if (mode === "titles" || mode === "devotionals") {
    const a = analyzeSermon(text);
    if (mode === "titles") {
      return res.status(200).json({ titles: buildTitles(a), themes: a.themes.slice(0, 5) });
    }
    return res.status(200).json({ devotionals: buildDevotionals(a) });
  }

  if (mode !== "discussion-guide") {
    return res.status(400).json({ error: "unknown mode" });
  }
  if (!hasGlm()) {
    return res.status(503).json({ error: "ai_not_configured" });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GLM_API_KEY}` },
      body: JSON.stringify({
        model: process.env.GLM_MODEL || "glm-4-flash",
        messages: [
          {
            role: "system",
            content:
              "You write small-group discussion guides for church congregations from sermon transcripts. " +
              "Ground every question in actual quotes or specific moments from the sermon. Warm, plain, " +
              "non-preachy language. Never invent quotes that are not in the transcript.",
          },
          {
            role: "user",
            content:
              "From the sermon transcript below, produce JSON only (no markdown) with keys: " +
              "title (string), icebreaker (string), open (array of 3 strings), " +
              "qs (array of 6 objects {quote: exact sentence from the sermon, follow: one follow-up question}), " +
              "prayer (string). Transcript:\n\n" + text.slice(0, 60000),
          },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    if (!r.ok) {
      return res.status(502).json({ error: "upstream_" + r.status });
    }
    const data = await r.json();
    const raw = data.choices?.[0]?.message?.content || "";
    const guide = JSON.parse(raw);
    return res.status(200).json({ guide });
  } catch {
    return res.status(502).json({ error: "generation_failed" });
  } finally {
    clearTimeout(timer);
  }
}
