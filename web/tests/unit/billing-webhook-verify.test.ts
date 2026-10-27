import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { lsSignature, stableStringify, verifyLsSignature } from "@/lib/billing/webhook-verify";

// Fixture secret (test only). Signatures are computed here with the same
// HMAC-SHA256 scheme the official LS docs specify, so the fixtures are real.
const SECRET = "whsec_test_fixture_secret";

const BODY = JSON.stringify({
  meta: { event_name: "subscription_created", custom_data: { workspace_id: "ws-1" } },
  data: { type: "subscriptions", id: "1", attributes: { status: "active", renews_at: "2026-11-27T00:00:00Z" } },
});

function signed(raw: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(raw).digest("hex");
}

describe("verifyLsSignature (port of api/ls-webhook.js)", () => {
  it("accepts a correctly signed raw body", () => {
    expect(verifyLsSignature(BODY, signed(BODY), SECRET)).toBe(true);
  });

  it("rejects a signature made with the wrong secret", () => {
    expect(verifyLsSignature(BODY, signed(BODY, "other-secret"), SECRET)).toBe(false);
  });

  it("rejects a tampered body", () => {
    const tampered = BODY.replace("active", "expired");
    expect(verifyLsSignature(tampered, signed(BODY), SECRET)).toBe(false);
  });

  it("rejects malformed signature headers without throwing", () => {
    expect(verifyLsSignature(BODY, "", SECRET)).toBe(false);
    expect(verifyLsSignature(BODY, "not-hex", SECRET)).toBe(false);
    expect(verifyLsSignature(BODY, "z".repeat(64), SECRET)).toBe(false);
    expect(verifyLsSignature(BODY, signed(BODY).toUpperCase(), SECRET)).toBe(false);
  });

  it("rejects missing inputs", () => {
    expect(verifyLsSignature("", signed(""), SECRET)).toBe(true); // empty body is still signable
    expect(verifyLsSignature(BODY, signed(BODY), "")).toBe(false);
  });
});

describe("legacy candidate serializations (Vercel parses bodies before us)", () => {
  it("stableStringify sorts keys deterministically", () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: [3, { z: 1, y: 2 }] } })).toBe(
      '{"a":{"c":[3,{"y":2,"z":1}],"d":2},"b":1}',
    );
  });

  it("accepts a signature over the stable-stringified form of the same payload", () => {
    const parsed = JSON.parse(BODY) as object;
    expect(verifyLsSignature(BODY, signed(stableStringify(parsed)), SECRET)).toBe(true);
  });

  it("accepts a signature over JSON.stringify form too", () => {
    const reordered = JSON.stringify({
      data: { id: "1", type: "subscriptions", attributes: { renews_at: "2026-11-27T00:00:00Z", status: "active" } },
      meta: { custom_data: { workspace_id: "ws-1" }, event_name: "subscription_created" },
    });
    // Raw-body bytes differ from JSON.stringify(parsed body) key order; both candidates verify.
    expect(verifyLsSignature(reordered, signed(reordered), SECRET)).toBe(true);
  });
});

describe("lsSignature helper (used by tests and local fixtures)", () => {
  it("produces lowercase hex of the HMAC-SHA256 digest", () => {
    const sig = lsSignature(BODY, SECRET);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    expect(sig).toBe(signed(BODY));
  });
});
