import { getAuthUserId } from "@/lib/auth";
import { AUTH_REQUIRED_COPY } from "@/lib/copy";
import { defaultBillingDeps, handleBillingCheckout } from "@/lib/billing/service";

/** POST /api/billing/checkout — LS checkout (or Founding payment link), §7.5. */
export async function POST(req: Request) {
  const userId = await getAuthUserId();
  if (!userId) {
    return Response.json({ error: AUTH_REQUIRED_COPY }, { status: 401 });
  }
  const body: unknown = await req.json().catch(() => null);
  const result = await handleBillingCheckout(userId, body, defaultBillingDeps());
  return Response.json(result.json, { status: result.status });
}
