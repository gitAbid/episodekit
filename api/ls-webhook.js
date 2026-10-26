// Lemon Squeezy webhook — POST /api/ls-webhook
// Verifies the HMAC-SHA256 signature (X-Signature) against LS_WEBHOOK_SECRET,
// then issues a stateless license key on order_created. The key is logged
// durably (sk_license) — when LS is live, also attach it via their license-key
// emails or custom receipt content. Rejects everything until the secret is set.

import { issueLicense } from "./license-keys.js";

async function hmacHex(raw, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(raw));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Deterministic serialization for objects that arrive key-sorted.
// Exported for tests.
export function stableStringify(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + stableStringify(v[k])).join(",") + "}";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }
  const secret = process.env.LS_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(503).json({ error: "not_configured" });
  }
  // Vercel parses application/json before we see it, so the exact bytes LS
  // signed may differ from JSON.stringify(body). Verify against the plausible
  // serializations; log (never silently fail) if none match.
  const candidates = [];
  if (typeof req.body === "string") candidates.push(req.body);
  else if (req.body && typeof req.body === "object") {
    candidates.push(JSON.stringify(req.body), stableStringify(req.body));
  }
  const signature = req.headers["x-signature"] || "";
  let ok = false;
  if (signature.length === 64) {
    for (const c of candidates) {
      if ((await hmacHex(c, secret)) === signature) { ok = true; break; }
    }
  }
  if (!ok) {
    console.log(JSON.stringify({ sk_license: { t: Date.now(), event: "signature_mismatch", preview: candidates[0]?.slice(0, 200) || null } }));
    return res.status(401).json({ error: "bad_signature" });
  }

  const event = typeof req.body === "object" && req.body ? req.body : JSON.parse(candidates[0] || "{}");
  const kind = event?.meta?.event_name;
  const email = event?.data?.attributes?.user_email || "unknown";
  const variant = String(event?.data?.attributes?.first_order_item?.variant_id || "");
  const planByVariant = JSON.parse(process.env.LS_VARIANTS || "{}");
  const plan = planByVariant[variant] || "pro";

  if (kind === "order_created") {
    const license = await issueLicense(plan);
    console.log(JSON.stringify({ sk_license: { t: Date.now(), event: kind, email, plan, license } }));
    return res.status(200).json({ ok: true, plan, license });
  }
  console.log(JSON.stringify({ sk_license: { t: Date.now(), event: kind, email, plan: null } }));
  return res.status(200).json({ ok: true, ignored: kind });
}
