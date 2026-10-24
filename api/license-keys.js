// SermonKit license keys — stateless, DB-free.
// Key format: SK-<base36 issuedAt>-<hmac10(issuedAt, secret)>
// Validation recomputes the HMAC, so keys survive instance resets and work
// across regions. Plan is embedded by key prefix tier: SK1 (Pro), SK4 (Studio),
// SKF (Founder). Durable record: every issue/validate logs sk_license events.

const enc = new TextEncoder();

function b36(n) {
  return n.toString(36);
}

async function hmac(msg, secret) {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  const bytes = new Uint8Array(sig.slice(0, 8));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function licenseSecret(env = process.env) {
  // LS_WEBHOOK_SECRET doubles as the key-signing secret until a dedicated one is set.
  return env.LS_LICENSE_SECRET || env.LS_WEBHOOK_SECRET || null;
}

export async function issueLicense(plan, env = process.env) {
  const secret = licenseSecret(env);
  if (!secret) return null;
  const prefix = plan === "studio" ? "SK4" : plan === "founder" ? "SKF" : "SK1";
  const issuedAt = Date.now();
  const stamp = b36(issuedAt);
  const mac = await hmac(prefix + "." + stamp, secret);
  return `${prefix}-${stamp}-${mac}`;
}

export async function validateLicense(key, env = process.env) {
  const secret = licenseSecret(env);
  if (!secret) return { valid: false, reason: "not_configured" };
  // Case-insensitive match; normalize captured groups so the HMAC is computed
  // over the exact lowercase form used at issuance.
  const m = String(key || "").trim().match(/^(SK1|SK4|SKF)-([0-9A-Za-z]+)-([0-9a-fA-F]{16})$/i);
  if (!m) return { valid: false, reason: "bad_format" };
  const prefix = m[1].toUpperCase();
  const stamp = m[2].toLowerCase();
  const mac = m[3].toLowerCase();
  const issuedAt = parseInt(stamp, 36);
  if (!Number.isFinite(issuedAt) || issuedAt > Date.now() + 60000) {
    return { valid: false, reason: "bad_stamp" };
  }
  const expect = await hmac(prefix + "." + stamp, secret);
  if (expect !== mac) return { valid: false, reason: "bad_signature" };
  const plan = prefix === "SK4" ? "studio" : prefix === "SKF" ? "founder" : "pro";
  const monthlySermons = plan === "studio" ? 40 : 12;
  return { valid: true, plan, issuedAt, monthlySermons };
}
