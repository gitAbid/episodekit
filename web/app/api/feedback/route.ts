// §7.5 POST /api/feedback — M11. Authenticated (in-app feedback); stores the
// row, captures a PostHog event when the key exists, emails the owner via
// Resend only when RESEND_API_KEY is set (otherwise the seam is logged once).
import { getAuthUserId } from "@/lib/auth";
import { handleFeedback, notifyOwnerByResend } from "@/lib/feedback/service";
import { insertFeedback } from "@/db/queries";
import { captureServerEvent } from "@/lib/analytics/posthog";

export async function POST(request: Request) {
  const userId = await getAuthUserId();
  const body = await request.json().catch(() => null);
  const res = await handleFeedback(userId, body, {
    insert: insertFeedback,
    capture: async (event, props) => {
      await captureServerEvent(userId ?? "anonymous", event, props);
    },
    notify: async (row) => {
      await notifyOwnerByResend(row);
    },
  });
  return Response.json(res.body, { status: res.status });
}
