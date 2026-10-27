import { getAuthUserId } from "@/lib/auth";
import { AUTH_REQUIRED_COPY } from "@/lib/copy";
import { defaultBillingDeps, handleBillingCancel } from "@/lib/billing/service";

/** POST /api/billing/cancel — one-click cancel, keeps Pro until period end (§7.5, U15). */
export async function POST() {
  const userId = await getAuthUserId();
  if (!userId) {
    return Response.json({ error: AUTH_REQUIRED_COPY }, { status: 401 });
  }
  const result = await handleBillingCancel(userId, defaultBillingDeps());
  return Response.json(result.json, { status: result.status });
}
