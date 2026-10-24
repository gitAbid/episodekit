// EpisodeKit contact — Vercel function.
// POST /api/contact { email, message } → 204 (durable sk_contact log entry)
// GET  /api/contact → count only. No emails exposed; messages live in the
// Vercel function log until a mailbox exists.

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

export default async function handler(req, res) {
  if (req.method === "POST") {
    const b = typeof req.body === "object" && req.body ? req.body : {};
    const email = String(b.email || "").trim().toLowerCase().slice(0, 254);
    const message = String(b.message || "").trim().slice(0, 4000);
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "invalid_email" });
    if (message.length < 10) return res.status(400).json({ error: "message_too_short" });
    console.log(JSON.stringify({ sk_contact: { t: Date.now(), email, message } }));
    return res.status(204).end();
  }
  if (req.method === "GET") {
    return res.status(200).json({ note: "durable record in Vercel function logs via sk_contact" });
  }
  return res.status(405).json({ error: "POST/GET only" });
}
