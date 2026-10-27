import { handleClerkWebhook } from "@/lib/clerk-webhook/service";

/** Public route: signature-verified inside handleClerkWebhook. */
export async function POST(req: Request) {
  return handleClerkWebhook(req);
}
