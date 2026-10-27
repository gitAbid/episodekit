import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleLsWebhook, type WorkspacePlanUpdate } from "@/lib/billing/webhook";

vi.mock("@/db/queries", () => ({
  isWebhookEventProcessed: vi.fn().mockResolvedValue(false),
  markWebhookEventProcessed: vi.fn(),
  getWorkspaceById: vi.fn().mockResolvedValue({ id: "ws-1" }),
  getWorkspaceByOwnerEmail: vi.fn().mockResolvedValue({ id: "ws-1" }),
  updateWorkspacePlan: vi.fn().mockResolvedValue(undefined),
}));

import * as queries from "@/db/queries";
const mocked = vi.mocked(queries);

// The webhook handler only reads workspace.id, so the stub carries just that.
const WS_STUB = { id: "ws-1" } as unknown as queries.WorkspaceRow;

const SECRET = "ls_webhook_test_secret_123";

/** Sign exactly like Lemon Squeezy does (docs: HMAC-SHA256 hex of the raw body). */
function sign(raw: string): string {
  return createHmac("sha256", SECRET).update(raw).digest("hex");
}

function signedRequest(payload: unknown | string, opts: { signature?: string; secret?: string } = {}) {
  const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
  return new Request("http://localhost/api/webhooks/lemonsqueezy", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-signature": opts.signature ?? sign(raw),
    },
    body: raw,
  });
}

function subscriptionEvent(
  eventName: string,
  attributes: Record<string, unknown>,
  meta: Record<string, unknown> = {},
) {
  return {
    meta: { event_name: eventName, ...meta },
    data: {
      type: "subscriptions",
      id: "sub_1",
      attributes: {
        status: "active",
        renews_at: "2026-11-27T00:00:00.000000Z",
        ends_at: null,
        variant_id: 111,
        customer_id: 42,
        user_email: "maya@focus.fm",
        ...attributes,
      },
    },
  };
}

beforeEach(() => {
  process.env.LS_WEBHOOK_SECRET = SECRET;
  process.env.LS_VARIANT_FOUNDING = "555";
  mocked.isWebhookEventProcessed.mockResolvedValue(false);
  mocked.getWorkspaceById.mockResolvedValue(WS_STUB);
  mocked.getWorkspaceByOwnerEmail.mockResolvedValue(WS_STUB);
});

afterEach(() => {
  delete process.env.LS_WEBHOOK_SECRET;
  delete process.env.LS_VARIANT_FOUNDING;
  vi.clearAllMocks();
});

function expectUpdate(): WorkspacePlanUpdate[] {
  return mocked.updateWorkspacePlan.mock.calls.map((call) => call[1] as WorkspacePlanUpdate);
}

describe("POST /api/webhooks/lemonsqueezy", () => {
  it("returns 503 while LS_WEBHOOK_SECRET is unset (owner blocker)", async () => {
    delete process.env.LS_WEBHOOK_SECRET;
    const res = await handleLsWebhook(signedRequest(subscriptionEvent("subscription_created", {})));
    expect(res.status).toBe(503);
    expect(mocked.updateWorkspacePlan).not.toHaveBeenCalled();
  });

  it("rejects a signature made with the wrong secret", async () => {
    const res = await handleLsWebhook(
      signedRequest(subscriptionEvent("subscription_created", {}), { signature: sign("x") }),
    );
    expect(res.status).toBe(401);
    expect(mocked.updateWorkspacePlan).not.toHaveBeenCalled();
  });

  it("rejects a tampered body", async () => {
    const event = subscriptionEvent("subscription_created", {});
    const raw = JSON.stringify(event);
    const tampered = JSON.stringify(event).replace("active", "expired");
    expect(tampered).not.toBe(raw);
    const res = await handleLsWebhook(
      new Request("http://localhost/api/webhooks/lemonsqueezy", {
        method: "POST",
        headers: { "content-type": "application/json", "x-signature": sign(raw) },
        body: tampered,
      }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects malformed JSON even with a valid signature over those bytes", async () => {
    const res = await handleLsWebhook(signedRequest("not-json{"));
    expect(res.status).toBe(400);
  });

  it("maps subscription_created to plan=pro via meta.custom_data.workspace_id (U14)", async () => {
    const event = subscriptionEvent("subscription_created", {}, { custom_data: { workspace_id: "ws-1" } });
    const res = await handleLsWebhook(signedRequest(event));
    expect(res.status).toBe(200);
    expect(mocked.getWorkspaceById).toHaveBeenCalledWith("ws-1");
    expect(expectUpdate()[0]).toEqual({
      plan: "pro",
      planSource: "ls",
      founding: false,
      status: "active",
      currentPeriodEnd: new Date("2026-11-27T00:00:00.000Z"),
      lsCustomerId: "42",
      lsSubscriptionId: "sub_1",
    });
    expect(mocked.markWebhookEventProcessed).toHaveBeenCalledWith(expect.any(String), "lemonsqueezy");
  });

  it("marks the founding deal when the variant matches LS_VARIANT_FOUNDING", async () => {
    const event = subscriptionEvent(
      "subscription_created",
      { variant_id: 555 },
      { custom_data: { workspace_id: "ws-1" } },
    );
    await handleLsWebhook(signedRequest(event));
    expect(expectUpdate()[0]).toMatchObject({ plan: "pro", founding: true });
  });

  it("maps order_created via first_order_item.variant_id and keeps a paid workspace active", async () => {
    const event = {
      meta: { event_name: "order_created", custom_data: { workspace_id: "ws-1" } },
      data: {
        type: "orders",
        id: "order_1",
        attributes: {
          user_email: "maya@focus.fm",
          customer_id: 42,
          status: "paid",
          first_order_item: { variant_id: 111, product_name: "EpisodeKit Pro", variant_name: "Pro monthly" },
        },
      },
    };
    const res = await handleLsWebhook(signedRequest(event));
    expect(res.status).toBe(200);
    expect(expectUpdate()[0]).toMatchObject({
      plan: "pro",
      planSource: "ls",
      founding: false,
      status: "active",
      lsCustomerId: "42",
    });
    // Orders carry no renewal date; the following subscription_created sets it.
    expect(expectUpdate()[0].currentPeriodEnd).toBeUndefined();
    expect(expectUpdate()[0].lsSubscriptionId).toBeUndefined();
  });

  it("falls back to the billing email when custom_data is missing", async () => {
    const event = subscriptionEvent("subscription_created", {});
    await handleLsWebhook(signedRequest(event));
    expect(mocked.getWorkspaceByOwnerEmail).toHaveBeenCalledWith("maya@focus.fm");
    expect(mocked.updateWorkspacePlan).toHaveBeenCalledWith("ws-1", expect.objectContaining({ plan: "pro" }));
  });

  it("answers 200 unmatched without applying anything when no workspace resolves", async () => {
    mocked.getWorkspaceById.mockResolvedValue(null);
    mocked.getWorkspaceByOwnerEmail.mockResolvedValue(null);
    const event = subscriptionEvent("subscription_created", {}, { custom_data: { workspace_id: "ws-x" } });
    const res = await handleLsWebhook(signedRequest(event));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, unmatched: true });
    expect(mocked.updateWorkspacePlan).not.toHaveBeenCalled();
  });

  it("maps subscription_cancelled to cancelled but keeps Pro until ends_at (U15)", async () => {
    const event = subscriptionEvent(
      "subscription_cancelled",
      { status: "cancelled", ends_at: "2026-11-30T00:00:00.000000Z", cancelled: true },
      { custom_data: { workspace_id: "ws-1" } },
    );
    await handleLsWebhook(signedRequest(event));
    expect(expectUpdate()[0]).toMatchObject({
      plan: "pro",
      status: "cancelled",
      currentPeriodEnd: new Date("2026-11-30T00:00:00.000Z"),
    });
  });

  it("maps subscription_expired to a downgrade (access ended)", async () => {
    const event = subscriptionEvent(
      "subscription_expired",
      { status: "expired", ends_at: "2026-11-30T00:00:00.000000Z" },
      { custom_data: { workspace_id: "ws-1" } },
    );
    await handleLsWebhook(signedRequest(event));
    expect(expectUpdate()[0]).toMatchObject({ plan: "free", status: "cancelled" });
  });

  it("extends access on subscription_payment_success", async () => {
    const event = subscriptionEvent(
      "subscription_payment_success",
      { status: "active", renews_at: "2026-12-27T00:00:00.000000Z" },
      { custom_data: { workspace_id: "ws-1" } },
    );
    await handleLsWebhook(signedRequest(event));
    expect(expectUpdate()[0]).toMatchObject({
      plan: "pro",
      status: "active",
      currentPeriodEnd: new Date("2026-12-27T00:00:00.000Z"),
    });
  });

  it("maps payment failure and pause to past_due", async () => {
    await handleLsWebhook(
      signedRequest(
        subscriptionEvent("subscription_payment_failed", { status: "past_due" }, { custom_data: { workspace_id: "ws-1" } }),
      ),
    );
    await handleLsWebhook(
      signedRequest(subscriptionEvent("subscription_paused", { status: "paused" }, { custom_data: { workspace_id: "ws-1" } })),
    );
    const updates = expectUpdate();
    expect(updates[0]).toMatchObject({ plan: "pro", status: "past_due" });
    expect(updates[1]).toMatchObject({ plan: "pro", status: "past_due" });
  });

  it("maps resumed/recovered subscriptions back to active", async () => {
    await handleLsWebhook(
      signedRequest(
        subscriptionEvent("subscription_payment_recovered", { status: "active" }, { custom_data: { workspace_id: "ws-1" } }),
      ),
    );
    expect(expectUpdate()[0]).toMatchObject({ status: "active" });
  });

  it("ignores unhandled events without touching workspaces", async () => {
    const res = await handleLsWebhook(
      signedRequest(subscriptionEvent("license_key_created", {}, { custom_data: { workspace_id: "ws-1" } })),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, ignored: "license_key_created" });
    expect(mocked.updateWorkspacePlan).not.toHaveBeenCalled();
  });

  it("dedupes identical redeliveries via webhook_events (idempotent)", async () => {
    const event = subscriptionEvent("subscription_created", {}, { custom_data: { workspace_id: "ws-1" } });
    await handleLsWebhook(signedRequest(event));
    mocked.isWebhookEventProcessed.mockResolvedValue(true);
    const res = await handleLsWebhook(signedRequest(event));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, duplicate: true });
    expect(mocked.updateWorkspacePlan).toHaveBeenCalledOnce();
  });

  it("still records the id of a payload that fails to parse later stages", async () => {
    // An unmatched payload is marked processed so LS redeliveries stay no-ops.
    mocked.getWorkspaceById.mockResolvedValue(null);
    mocked.getWorkspaceByOwnerEmail.mockResolvedValue(null);
    const event = subscriptionEvent("subscription_created", {}, { custom_data: { workspace_id: "ws-x" } });
    await handleLsWebhook(signedRequest(event));
    expect(mocked.markWebhookEventProcessed).toHaveBeenCalled();
  });
});
