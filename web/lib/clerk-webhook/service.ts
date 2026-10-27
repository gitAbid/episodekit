import { Webhook } from "svix";
import * as queries from "@/db/queries";

export type ClerkWebhookDeps = {
  signingSecret?: string;
  upsertUser?: typeof queries.upsertUser;
  ensureWorkspace?: typeof queries.getOrCreateWorkspaceByOwner;
  deleteUser?: typeof queries.deleteClerkUser;
  isEventProcessed?: typeof queries.isWebhookEventProcessed;
  markEventProcessed?: typeof queries.markWebhookEventProcessed;
};

type ClerkUserData = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email_addresses?: { id: string; email_address: string }[];
  primary_email_address_id?: string | null;
};

type ClerkWebhookEvent = { type: string; data: unknown };

function primaryEmail(d: ClerkUserData): string | null {
  const list = d.email_addresses ?? [];
  const primary = list.find((e) => e.id === d.primary_email_address_id);
  return primary?.email_address ?? list[0]?.email_address ?? null;
}

function fullName(d: ClerkUserData): string | null {
  const name = [d.first_name, d.last_name]
    .filter((p): p is string => Boolean(p))
    .join(" ")
    .trim();
  return name.length > 0 ? name : null;
}

/**
 * POST /api/webhooks/clerk (public, 03-architecture.md §7.5):
 * Svix-verified user upsert/delete. Every delivered event id is recorded in
 * webhook_events so redeliveries are no-ops. user.deleted removes the user
 * row; owned data goes with it via FK cascade (workspaces, shows, episodes).
 */
export async function handleClerkWebhook(
  req: Request,
  deps: ClerkWebhookDeps = {},
): Promise<Response> {
  const secret = deps.signingSecret ?? process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    return Response.json({ error: "Webhook not configured." }, { status: 503 });
  }

  const payload = await req.text();
  const wh = new Webhook(secret);
  try {
    wh.verify(payload, {
      "svix-id": req.headers.get("svix-id") ?? "",
      "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
      "svix-signature": req.headers.get("svix-signature") ?? "",
    });
  } catch {
    return Response.json({ error: "Invalid webhook signature." }, { status: 400 });
  }
  let event: ClerkWebhookEvent;
  try {
    event = JSON.parse(payload) as ClerkWebhookEvent;
  } catch {
    return Response.json({ error: "Invalid webhook body." }, { status: 400 });
  }

  const eventId = req.headers.get("svix-id");
  const isProcessed = deps.isEventProcessed ?? queries.isWebhookEventProcessed;
  if (eventId && (await isProcessed(eventId))) {
    return Response.json({ received: true, duplicate: true });
  }

  const upsertUser = deps.upsertUser ?? queries.upsertUser;
  const ensureWorkspace = deps.ensureWorkspace ?? queries.getOrCreateWorkspaceByOwner;
  const deleteUser = deps.deleteUser ?? queries.deleteClerkUser;
  const markEventProcessed = deps.markEventProcessed ?? queries.markWebhookEventProcessed;

  try {
    switch (event.type) {
      case "user.created":
      case "user.updated": {
        const data = event.data as ClerkUserData;
        await upsertUser({ id: data.id, email: primaryEmail(data), name: fullName(data) });
        await ensureWorkspace(data.id);
        break;
      }
      case "user.deleted": {
        const data = event.data as { id?: string };
        if (data.id) await deleteUser(data.id);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("[clerk-webhook] handler failed", error);
    return Response.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  if (eventId) await markEventProcessed(eventId, "clerk");
  return Response.json({ received: true });
}
