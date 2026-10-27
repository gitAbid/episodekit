import { handleLsWebhook } from "@/lib/billing/webhook";

/** POST /api/webhooks/lemonsqueezy (public) — HMAC-verified, idempotent, §7.5. */
export async function POST(req: Request) {
  return handleLsWebhook(req);
}
