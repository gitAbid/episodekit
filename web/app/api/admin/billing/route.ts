import { getAuthUserId } from "@/lib/auth";
import { AUTH_REQUIRED_COPY } from "@/lib/copy";
import { defaultBillingDeps, handleAdminSetPlan } from "@/lib/billing/service";

/**
 * POST /api/admin/billing — the owner's manual plan flag (§0.2): flag a
 * workspace Founding Pro after a payment-link purchase, or downgrade it.
 * Owner authorization lives in handleAdminSetPlan (OWNER_EMAILS).
 */
export async function POST(req: Request) {
  const userId = await getAuthUserId();
  if (!userId) {
    return Response.json({ error: AUTH_REQUIRED_COPY }, { status: 401 });
  }
  const body: unknown = await req.json().catch(() => null);
  const result = await handleAdminSetPlan(userId, body, defaultBillingDeps());
  return Response.json(result.json, { status: result.status });
}
