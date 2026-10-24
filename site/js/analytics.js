// SermonKit first-party analytics beacon v0.
// Sends a pageview via navigator.sendBeacon to /api/track. No cookies, no PII —
// path + referrer + a per-day random visitor id only. Counts are queryable in
// Vercel function logs and via GET /api/track (daily totals).
(function () {
  try {
    var id = localStorage.getItem("sk_vid");
    if (!id) {
      id = Math.random().toString(36).slice(2, 10);
      localStorage.setItem("sk_vid", id);
    }
    var payload = JSON.stringify({
      kind: "pageview",
      path: location.pathname,
      ref: document.referrer || null,
      vid: id,
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
    } else {
      fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true });
    }
  } catch (e) { /* analytics must never break the page */ }
})();
