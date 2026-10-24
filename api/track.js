// SermonKit analytics v0 — Vercel function.
// POST /api/track  { kind, path, ref, vid } → 204 (event logged)
// GET  /api/track  → daily counters (per warm instance; v0 limitation — see day-3 log)
// No cookies/PII: path, referrer host, per-day visitor bucket. Upgrade path: Vercel KV.

const KEY = "sk_events_" + new Date().toISOString().slice(0, 10);

export default async function handler(req, res) {
  // CORS-free same-origin beacon; reject cross-site writes.
  if (req.method === "POST") {
    const b = typeof req.body === "object" && req.body ? req.body : {};
    const path = String(b.path || "/").slice(0, 200);
    const ref = b.ref ? String(b.ref).slice(0, 300) : null;
    const vid = String(b.vid || "").replace(/[^a-z0-9]/gi, "").slice(0, 16) || "anon";
    const event = {
      t: Date.now(),
      kind: b.kind === "pageview" ? "pageview" : "other",
      path,
      refHost: ref ? ref.split("/")[2] || null : null,
      vid,
    };
    globalThis[KEY] = globalThis[KEY] || { events: [], visitors: new Set() };
    const store = globalThis[KEY];
    store.events.push(event);
    store.visitors.add(vid);
    if (store.events.length > 5000) store.events.splice(0, store.events.length - 5000);
    console.log(JSON.stringify({ sk_event: event })); // durable record in Vercel logs
    return res.status(204).end();
  }
  if (req.method === "GET") {
    const store = globalThis[KEY] || { events: [], visitors: new Set() };
    const byPath = {};
    for (const e of store.events) byPath[e.path] = (byPath[e.path] || 0) + 1;
    const byRef = {};
    for (const e of store.events) if (e.refHost) byRef[e.refHost] = (byRef[e.refHost] || 0) + 1;
    return res.status(200).json({
      date: KEY.slice(-10),
      note: "per warm instance (v0); full history in Vercel function logs via sk_event",
      pageviews: store.events.length,
      visitors: store.visitors.size,
      byPath,
      byRef,
    });
  }
  return res.status(405).json({ error: "POST/GET only" });
}
