/**
 * POST /api/webhooks/lemonsqueezy (public, 03-architecture.md §7.5).
 * HMAC verification ported from legacy api/ls-webhook.js (see webhook-verify.ts);
 * idempotency via the webhook_events table keyed on sha256(raw body) — Lemon
 * Squeezy delivers no unique event id, but identical redeliveries are
 * byte-identical, so the hash is a stable dedupe key.
 *
 * Event mapping (payload shapes per docs.lemonsqueezy.com/help/webhooks):
 * - order_created / subscription_created|updated|resumed|unpaused /
 *   payment_success|recovered|failed / paused → plan=pro (+founding when the
 *   variant matches LS_VARIANT_FOUNDING), status mapped from
 *   attributes.status, current_period_end = renews_at.
 * - subscription_cancelled → keep Pro, status=cancelled,
 *   current_period_end = ends_at (grace period; U15 access end date).
 * - subscription_expired → downgrade to free (the grace period ended).
 * - anything else → ignored with 200.
 * Workspace attribution: meta.custom_data.workspace_id (passed as
 * checkout_data.custom at checkout creation) → fallback attributes.user_email.
 */
import { createHash } from "node:crypto";
import * as queries from "@/db/queries";
import { lsStatusToWorkspaceStatus } from "./entitlements";
import { verifyLsSignature } from "./webhook-verify";

export type WorkspacePlanUpdate = queries.WorkspacePlanUpdate;

type LsWebhookPayload = {
  meta?: { event_name?: string; custom_data?: Record<string, unknown> };
  data?: {
    type?: string;
    id?: string | number;
    attributes?: Record<string, unknown>;
  };
};

/** The handler only needs the workspace id, so deps accept minimal rows. */
export type MinimalWorkspace = { id: string };

export type LsWebhookDeps = {
  secret?: string;
  foundingVariantId?: string;
  isEventProcessed?: typeof queries.isWebhookEventProcessed;
  markEventProcessed?: typeof queries.markWebhookEventProcessed;
  getWorkspaceById?: (id: string) => Promise<MinimalWorkspace | null>;
  getWorkspaceByOwnerEmail?: (email: string) => Promise<MinimalWorkspace | null>;
  updateWorkspacePlan?: (id: string, update: WorkspacePlanUpdate) => Promise<unknown>;
};

/** Events that set/extend a paid plan. */
const PLAN_EVENTS = new Set([
  "order_created",
  "subscription_created",
  "subscription_updated",
  "subscription_resumed",
  "subscription_unpaused",
  "subscription_payment_success",
  "subscription_payment_recovered",
  "subscription_payment_failed",
  "subscription_paused",
]);

function asString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function asDate(value: unknown): Date | undefined {
  return typeof value === "string" ? new Date(value) : undefined;
}

function eventId(rawBody: string): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex");
}

export async function handleLsWebhook(req: Request, deps: LsWebhookDeps = {}): Promise<Response> {
  const secret = deps.secret ?? process.env.LS_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json({ error: "Webhook not configured." }, { status: 503 });
  }

  const raw = await req.text();
  if (!verifyLsSignature(raw, req.headers.get("x-signature") ?? "", secret)) {
    return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let event: LsWebhookPayload;
  try {
    event = JSON.parse(raw) as LsWebhookPayload;
  } catch {
    return Response.json({ error: "Invalid webhook body." }, { status: 400 });
  }

  const isProcessed = deps.isEventProcessed ?? queries.isWebhookEventProcessed;
  const markEventProcessed = deps.markEventProcessed ?? queries.markWebhookEventProcessed;
  const id = eventId(raw);
  if (await isProcessed(id)) {
    return Response.json({ received: true, duplicate: true });
  }

  const eventName = event.meta?.event_name ?? "";
  const attributes = event.data?.attributes ?? {};
  const handled = PLAN_EVENTS.has(eventName) || eventName === "subscription_cancelled" || eventName === "subscription_expired";
  if (!handled) {
    await markEventProcessed(id, "lemonsqueezy");
    return Response.json({ ok: true, ignored: eventName });
  }

  const getWorkspaceById = deps.getWorkspaceById ?? queries.getWorkspaceById;
  const getWorkspaceByOwnerEmail = deps.getWorkspaceByOwnerEmail ?? queries.getWorkspaceByOwnerEmail;
  const updateWorkspacePlan = deps.updateWorkspacePlan ?? queries.updateWorkspacePlan;

  const customWorkspaceId = asString(event.meta?.custom_data?.workspace_id);
  const email = asString(attributes.user_email);
  const workspace =
    (customWorkspaceId ? await getWorkspaceById(customWorkspaceId) : null) ??
    (email ? await getWorkspaceByOwnerEmail(email) : null);
  if (!workspace) {
    // Unknown workspace: 200 (not an error for LS) and record the id so
    // redeliveries stay no-ops; surfaced in logs for the owner.
    console.warn(JSON.stringify({ ls_webhook: { event: eventName, unmatched: true, email } }));
    await markEventProcessed(id, "lemonsqueezy");
    return Response.json({ ok: true, unmatched: true });
  }

  const foundingVariantId = deps.foundingVariantId ?? process.env.LS_VARIANT_FOUNDING;
  // Orders carry first_order_item.variant_id; subscription events carry a
  // top-level attributes.variant_id (LS payload docs).
  const firstOrder = attributes.first_order_item as { variant_id?: unknown } | undefined;
  const variantId = asString(firstOrder?.variant_id ?? attributes.variant_id);
  const founding = Boolean(foundingVariantId && variantId && variantId === foundingVariantId);

  let update: WorkspacePlanUpdate;
  if (eventName === "subscription_expired") {
    // Grace period over: access ends now (effectivePlan would also read this free).
    update = {
      plan: "free",
      status: "cancelled",
      currentPeriodEnd: asDate(attributes.ends_at) ?? null,
    };
  } else if (eventName === "subscription_cancelled") {
    // Keep Pro until the end of the paid period ("You'll keep Pro until …").
    update = {
      plan: "pro",
      status: "cancelled",
      currentPeriodEnd: asDate(attributes.ends_at) ?? asDate(attributes.renews_at) ?? null,
    };
  } else {
    // Paid/extended: an order was paid or the subscription is in a healthy or
    // held state; map the LS status (order status "paid" → active).
    const lsStatus = asString(attributes.status) ?? "";
    update = {
      plan: "pro",
      planSource: "ls",
      founding,
      status: eventName === "order_created" ? "active" : lsStatusToWorkspaceStatus(lsStatus),
      ...(asDate(attributes.renews_at) ? { currentPeriodEnd: asDate(attributes.renews_at) } : {}),
      ...(asString(attributes.customer_id) ? { lsCustomerId: asString(attributes.customer_id) } : {}),
      ...(event.data?.type === "subscriptions" && event.data.id
        ? { lsSubscriptionId: String(event.data.id) }
        : {}),
    };
  }

  try {
    await updateWorkspacePlan(workspace.id, update);
  } catch (error) {
    console.error("[ls-webhook] update failed", error);
    // 500 so Lemon Squeezy retries; the id was not recorded, so a redelivery re-applies.
    return Response.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  await markEventProcessed(id, "lemonsqueezy");
  return Response.json({ ok: true, event: eventName });
}
