/**
 * Lemon Squeezy webhook signature verification — ported from legacy
 * api/ls-webhook.js, scheme confirmed against the official docs
 * (docs.lemonsqueezy.com/help/webhooks/signing-requests):
 *   X-Signature = hex HMAC-SHA256 of the raw request body, compared with
 *   crypto.timingSafeEqual.
 *
 * Legacy also verified against plausible re-serializations because the old
 * Vercel Pages runtime parsed application/json before the handler saw it.
 * App Router route handlers read the exact bytes via req.text(), so the raw
 * body is the primary candidate; the legacy candidates are kept as a
 * fallback so in-flight dashboard "Send test" payloads never bounce.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** Deterministic serialization for key-sorted objects (ported from api/ls-webhook.js). */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  const obj = v as Record<string, unknown>;
  return (
    "{" +
    Object.keys(obj)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k]))
      .join(",") +
    "}"
  );
}

function hmacHex(raw: string, secret: string): string {
  return createHmac("sha256", secret).update(raw, "utf8").digest("hex");
}

/** Test/fixture helper: the expected X-Signature for a raw body. */
export function lsSignature(rawBody: string, secret: string): string {
  return hmacHex(rawBody, secret);
}

function hexEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

/**
 * True when signatureHeader is a valid X-Signature for rawBody under secret.
 * Fails closed on any malformed input (empty secret, non-64-char header).
 */
export function verifyLsSignature(rawBody: string, signatureHeader: string, secret: string): boolean {
  if (!secret || !signatureHeader) return false;
  // X-Signature is a 64-char lowercase hex digest; anything else cannot match.
  if (!/^[0-9a-f]{64}$/.test(signatureHeader)) return false;

  const candidates = [rawBody];
  if (rawBody) {
    try {
      const parsed: unknown = JSON.parse(rawBody);
      if (parsed && typeof parsed === "object") {
        candidates.push(JSON.stringify(parsed), stableStringify(parsed));
      }
    } catch {
      // Non-JSON body: only the raw bytes can have been signed.
    }
  }
  return candidates.some((candidate) => hexEquals(hmacHex(candidate, secret), signatureHeader));
}
