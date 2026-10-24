// SermonKit suite generator — Vercel serverless function (Node).
// POST { mode: "discussion-guide", text }
// Uses GLM chat completions when GLM_API_KEY is set; returns 503 otherwise so the
// client falls back to its offline generator. Never exposes the key.
const TIMEOUT_MS = 25000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }
  const payload = typeof req.body === "object" && req.body ? req.body : {};
  const text = String(payload.text || "").trim();
  if (text.length < 200) {
    return res.status(400).json({ error: "text too short" });
  }

  const key = process.env.GLM_API_KEY;
  if (!key) {
    return res.status(503).json({ error: "ai_not_configured" });
  }

  const system =
    "You write small-group discussion guides for church congregations from sermon transcripts. " +
    "Ground every question in actual quotes or specific moments from the sermon. Warm, plain, " +
    "non-preachy language. Never invent quotes that are not in the transcript.";
  const user =
    "From the sermon transcript below, produce JSON only (no markdown) with keys: " +
    "title (string), icebreaker (string), open (array of 3 strings), " +
    "qs (array of 6 objects {quote: exact sentence from the sermon, follow: one follow-up question}), " +
    "prayer (string). Transcript:\n\n" + text.slice(0, 60000);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.GLM_MODEL || "glm-4-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
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
  } catch (err) {
    return res.status(502).json({ error: "generation_failed" });
  } finally {
    clearTimeout(timer);
  }
}
