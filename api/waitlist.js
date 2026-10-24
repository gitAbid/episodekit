// SermonKit waitlist v0 — Vercel function.
// POST /api/waitlist  { email } → 204 (stored + logged durably as sk_waitlist)
// GET  /api/waitlist  → count + entries (per warm instance; durable record is the
// Vercel function log — export via logs, same honest v0 pattern as api/track).
// Validation: RFC-ish email check; dedupe per instance; no PII beyond email.

const KEY = "sk_waitlist_" + new Date().toISOString().slice(0, 10);
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

export default async function handler(req, res) {
  if (req.method === "POST") {
    const b = typeof req.body === "object" && req.body ? req.body : {};
    const email = String(b.email || "").trim().toLowerCase().slice(0, 254);
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: "invalid_email" });
    }
    globalThis[KEY] = globalThis[KEY] || { entries: [], seen: new Set() };
    const store = globalThis[KEY];
    const isNew = !store.seen.has(email);
    if (isNew) {
      store.seen.add(email);
      store.entries.push({ t: Date.now(), email });
      console.log(JSON.stringify({ sk_waitlist: { t: Date.now(), email } }));
      return res.status(204).end();
    }
    return res.status(200).json({ ok: true, already: true });
  }
  if (req.method === "GET") {
    const store = globalThis[KEY] || { entries: [] };
    return res.status(200).json({
      date: KEY.slice(-10),
      note: "per warm instance (v0); durable record in Vercel function logs via sk_waitlist",
      count: store.entries.length,
      entries: store.entries,
    });
  }
  return res.status(405).json({ error: "POST/GET only" });
}
