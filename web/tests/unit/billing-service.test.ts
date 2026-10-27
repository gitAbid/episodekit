import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ALREADY_PRO_COPY,
  CHECKOUT_UNAVAILABLE_COPY,
  FREE_PLAN_CANCEL_COPY,
  LS_UNREACHABLE_COPY,
  NO_WORKSPACE_FOR_EMAIL_COPY,
  OWNER_NOT_CONFIGURED_COPY,
  OWNER_ONLY_COPY,
  PLAN_REQUIRED_COPY,
  SAVE_UNAVAILABLE_COPY,
} from "@/lib/copy";
import { quotaResetDate } from "@/lib/billing/entitlements";
import {
  assertAndConsumeQuota,
  consumeEpisodeQuota,
  getBillingView,
  handleAdminSetPlan,
  handleBillingCancel,
  handleBillingCheckout,
  refundEpisode,
  type BillingDeps,
} from "@/lib/billing/service";
import type { WorkspaceRow } from "@/db/queries";

const NOW = new Date("2026-10-27T12:00:00.000Z");

function workspaceRow(overrides: Partial<WorkspaceRow> = {}): WorkspaceRow {
  return {
    id: "ws-1",
    ownerId: "user_1",
    plan: "free",
    planSource: null,
    founding: false,
    lsCustomerId: null,
    lsSubscriptionId: null,
    status: "active",
    currentPeriodEnd: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function deps(overrides: Partial<BillingDeps> = {}): BillingDeps {
  const rows: Record<string, WorkspaceRow> = { "ws-1": workspaceRow() };
  return {
    now: () => NOW,
    dbConfigured: () => true,
    lsConfigured: () => true,
    lsClient: {
      createCheckout: vi.fn().mockResolvedValue({ url: "https://ls.test/checkout/abc" }),
      cancelSubscription: vi
        .fn()
        .mockResolvedValue({ status: "cancelled", endsAt: new Date("2026-11-30T00:00:00Z"), customerPortalUrl: "https://portal", updatePaymentMethodUrl: null }),
      getSubscription: vi.fn().mockResolvedValue({
        status: "active",
        renewsAt: new Date("2026-11-27T00:00:00Z"),
        endsAt: null,
        customerPortalUrl: "https://ls.test/portal",
        updatePaymentMethodUrl: null,
      }),
    },
    ensureWorkspace: vi.fn().mockResolvedValue(rows["ws-1"]),
    getWorkspaceById: vi.fn().mockResolvedValue(rows["ws-1"]),
    getWorkspaceByOwnerEmail: vi.fn().mockResolvedValue(rows["ws-1"]),
    updateWorkspacePlan: vi.fn().mockImplementation(async (id, update) => ({ ...rows[id], ...update }) as WorkspaceRow),
    countQuotaEpisodes: vi.fn().mockResolvedValue(0),
    markEpisodeQuotaCounted: vi.fn().mockResolvedValue(undefined),
    refundEpisodeQuota: vi.fn().mockResolvedValue(undefined),
    countFoundingWorkspaces: vi.fn().mockResolvedValue(63),
    getUserEmail: vi.fn().mockResolvedValue("maya@focus.fm"),
    ...overrides,
  };
}

beforeEach(() => {
  process.env.LS_STORE_ID = "1";
  process.env.LS_VARIANT_PRO_MONTHLY = "111";
  process.env.LS_VARIANT_FOUNDING = "555";
  delete process.env.LS_FOUNDING_PAYMENT_URL;
  delete process.env.OWNER_EMAILS;
});

afterEach(() => {
  delete process.env.LS_STORE_ID;
  delete process.env.LS_VARIANT_PRO_MONTHLY;
  delete process.env.LS_VARIANT_FOUNDING;
  delete process.env.LS_FOUNDING_PAYMENT_URL;
  delete process.env.OWNER_EMAILS;
});

describe("handleBillingCheckout (POST /api/billing/checkout)", () => {
  it("answers 503 with preview copy when the DB is not configured", async () => {
    const result = await handleBillingCheckout("user_1", { plan: "pro" }, deps({ dbConfigured: () => false }));
    expect(result.status).toBe(503);
    expect(result.json).toEqual({ error: SAVE_UNAVAILABLE_COPY });
  });

  it("validates the requested plan", async () => {
    expect((await handleBillingCheckout("user_1", {}, deps())).json).toEqual({ error: PLAN_REQUIRED_COPY });
    expect((await handleBillingCheckout("user_1", { plan: "studio" }, deps())).json).toEqual({
      error: PLAN_REQUIRED_COPY,
    });
  });

  it("creates an LS checkout for Pro with the workspace id as custom_data", async () => {
    const d = deps();
    const result = await handleBillingCheckout("user_1", { plan: "pro" }, d);
    expect(result.status).toBe(200);
    expect(result.json).toEqual({ url: "https://ls.test/checkout/abc", mode: "checkout" });
    expect(d.lsClient.createCheckout).toHaveBeenCalledWith({
      storeId: "1",
      variantId: "111",
      email: "maya@focus.fm",
      custom: { workspace_id: "ws-1" },
    });
  });

  it("uses the Founding variant for plan=founding", async () => {
    const d = deps();
    await handleBillingCheckout("user_1", { plan: "founding" }, d);
    expect(d.lsClient.createCheckout).toHaveBeenCalledWith(expect.objectContaining({ variantId: "555" }));
  });

  it("refuses a second upgrade while Pro is active", async () => {
    const d = deps({ ensureWorkspace: vi.fn().mockResolvedValue(workspaceRow({ plan: "pro" })) });
    const result = await handleBillingCheckout("user_1", { plan: "pro" }, d);
    expect(result.status).toBe(409);
    expect(result.json).toEqual({ error: ALREADY_PRO_COPY });
  });

  it("answers 503 when LS is not configured (owner blocker)", async () => {
    const result = await handleBillingCheckout("user_1", { plan: "pro" }, deps({ lsConfigured: () => false }));
    expect(result.status).toBe(503);
    expect(result.json).toEqual({ error: CHECKOUT_UNAVAILABLE_COPY });
  });

  it("Founding falls back to the payment-link URL when LS API is not configured", async () => {
    process.env.LS_FOUNDING_PAYMENT_URL = "https://ek.lemonsqueezy.com/buy/abc";
    const d = deps({ lsConfigured: () => false });
    const result = await handleBillingCheckout("user_1", { plan: "founding" }, d);
    expect(result.status).toBe(200);
    expect(result.json).toEqual({ url: "https://ek.lemonsqueezy.com/buy/abc", mode: "payment_link" });
    expect(d.lsClient.createCheckout).not.toHaveBeenCalled();
  });

  it("surfaces LS failures as 502", async () => {
    const d = deps({
      lsClient: {
        createCheckout: vi.fn().mockRejectedValue(new Error("500")),
        cancelSubscription: vi.fn(),
        getSubscription: vi.fn(),
      },
    });
    const result = await handleBillingCheckout("user_1", { plan: "pro" }, d);
    expect(result.status).toBe(502);
    expect(result.json).toEqual({ error: LS_UNREACHABLE_COPY });
  });
});

describe("handleBillingCancel (POST /api/billing/cancel)", () => {
  it("refuses to cancel the Free plan", async () => {
    const result = await handleBillingCancel("user_1", deps());
    expect(result.status).toBe(400);
    expect(result.json).toEqual({ error: FREE_PLAN_CANCEL_COPY });
  });

  it("cancels via the LS API and keeps Pro until the LS end date", async () => {
    const d = deps({
      ensureWorkspace: vi.fn().mockResolvedValue(
        workspaceRow({ plan: "pro", planSource: "ls", lsSubscriptionId: "sub_1", currentPeriodEnd: new Date("2026-11-30T00:00:00Z") }),
      ),
    });
    const result = await handleBillingCancel("user_1", d);
    expect(d.lsClient.cancelSubscription).toHaveBeenCalledWith("sub_1");
    expect(d.updateWorkspacePlan).toHaveBeenCalledWith("ws-1", {
      status: "cancelled",
      currentPeriodEnd: new Date("2026-11-30T00:00:00Z"),
    });
    expect(result.status).toBe(200);
    expect(result.json).toEqual({ cancelled: true, accessEnds: "2026-11-30T00:00:00.000Z" });
  });

  it("cancels a manual plan without touching LS, keeping access until period end", async () => {
    const d = deps({
      ensureWorkspace: vi.fn().mockResolvedValue(
        workspaceRow({ plan: "pro", planSource: "manual", founding: true, currentPeriodEnd: new Date("2027-10-27T00:00:00Z") }),
      ),
    });
    const result = await handleBillingCancel("user_1", d);
    expect(d.lsClient.cancelSubscription).not.toHaveBeenCalled();
    expect(d.updateWorkspacePlan).toHaveBeenCalledWith("ws-1", {
      status: "cancelled",
      currentPeriodEnd: new Date("2027-10-27T00:00:00Z"),
    });
    expect(result.status).toBe(200);
  });

  it("manual plan without a period end keeps access until the quota reset", async () => {
    const d = deps({
      ensureWorkspace: vi.fn().mockResolvedValue(workspaceRow({ plan: "pro", planSource: "manual" })),
    });
    await handleBillingCancel("user_1", d);
    expect(d.updateWorkspacePlan).toHaveBeenCalledWith("ws-1", {
      status: "cancelled",
      currentPeriodEnd: quotaResetDate(NOW),
    });
  });

  it("surfaces LS cancel failures as 502 without local changes", async () => {
    const d = deps({
      ensureWorkspace: vi.fn().mockResolvedValue(workspaceRow({ plan: "pro", planSource: "ls", lsSubscriptionId: "sub_1" })),
      lsClient: {
        createCheckout: vi.fn(),
        cancelSubscription: vi.fn().mockRejectedValue(new Error("500")),
        getSubscription: vi.fn(),
      },
    });
    const result = await handleBillingCancel("user_1", d);
    expect(result.status).toBe(502);
    expect(result.json).toEqual({ error: LS_UNREACHABLE_COPY });
    expect(d.updateWorkspacePlan).not.toHaveBeenCalled();
  });
});

describe("handleAdminSetPlan (manual plan flag, owner only)", () => {
  it("fails closed when OWNER_EMAILS is not configured", async () => {
    const result = await handleAdminSetPlan("user_1", { email: "x@y.fm", plan: "pro" }, deps());
    expect(result.status).toBe(403);
    expect(result.json).toEqual({ error: OWNER_NOT_CONFIGURED_COPY });
  });

  it("rejects non-owner callers", async () => {
    process.env.OWNER_EMAILS = "abid@episodekit.app";
    const result = await handleAdminSetPlan("user_1", { email: "x@y.fm", plan: "pro" }, deps());
    expect(result.status).toBe(403);
    expect(result.json).toEqual({ error: OWNER_ONLY_COPY });
  });

  it("flags a workspace Founding Pro manually (plan_source=manual, +1 year)", async () => {
    process.env.OWNER_EMAILS = "maya@focus.fm, abid@episodekit.app";
    const d = deps();
    const result = await handleAdminSetPlan("user_1", { email: "maya@focus.fm", plan: "pro", founding: true }, d);
    expect(result.status).toBe(200);
    expect(d.updateWorkspacePlan).toHaveBeenCalledWith("ws-1", {
      plan: "pro",
      planSource: "manual",
      founding: true,
      status: "active",
      currentPeriodEnd: new Date("2027-10-27T12:00:00.000Z"),
    });
  });

  it("manual Pro (non-founding) runs one month", async () => {
    process.env.OWNER_EMAILS = "abid@episodekit.app, maya@focus.fm";
    const d = deps();
    await handleAdminSetPlan("user_1", { email: "maya@focus.fm", plan: "pro" }, d);
    expect(d.updateWorkspacePlan).toHaveBeenCalledWith(
      "ws-1",
      expect.objectContaining({ plan: "pro", founding: false, currentPeriodEnd: new Date("2026-11-27T12:00:00.000Z") }),
    );
  });

  it("downgrades to Free and clears the founding flag", async () => {
    process.env.OWNER_EMAILS = "abid@episodekit.app, maya@focus.fm";
    const d = deps();
    await handleAdminSetPlan("user_1", { email: "maya@focus.fm", plan: "free" }, d);
    expect(d.updateWorkspacePlan).toHaveBeenCalledWith("ws-1", {
      plan: "free",
      planSource: null,
      founding: false,
      status: "active",
      currentPeriodEnd: null,
    });
  });

  it("404s for an unknown workspace email", async () => {
    process.env.OWNER_EMAILS = "abid@episodekit.app, maya@focus.fm";
    const result = await handleAdminSetPlan(
      "user_1",
      { email: "maya@focus.fm", plan: "pro" },
      deps({ getWorkspaceByOwnerEmail: vi.fn().mockResolvedValue(null) }),
    );
    expect(result.status).toBe(404);
    expect(result.json).toEqual({ error: NO_WORKSPACE_FOR_EMAIL_COPY });
  });

  it("matches owner emails case-insensitively and trims the list", async () => {
    process.env.OWNER_EMAILS = " Maya@Focus.FM ";
    const result = await handleAdminSetPlan("user_1", { email: "maya@focus.fm", plan: "pro" }, deps());
    expect(result.status).toBe(200);
  });
});

describe("quota consume/refund semantics (M10)", () => {
  it("counts against the current quota month and reports over-quota", async () => {
    const d = deps({ countQuotaEpisodes: vi.fn().mockResolvedValue(2) });
    const state = await assertAndConsumeQuota("user_1", d);
    expect(state).toEqual({
      allowed: false,
      used: 2,
      limit: 2,
      quotaMonth: "2026-10",
      resetDate: new Date("2026-11-01T00:00:00.000Z"),
      wallCopy: "You've used 2 of 2 episodes this month. Upgrade for more, or wait until Nov 1.",
    });
    expect(d.markEpisodeQuotaCounted).not.toHaveBeenCalled();
  });

  it("marks the episode counted when generation starts under the limit", async () => {
    const d = deps({ countQuotaEpisodes: vi.fn().mockResolvedValue(1) });
    const state = await assertAndConsumeQuota("user_1", d);
    expect(state.allowed).toBe(true);
    expect(state.wallCopy).toBeNull();
    await consumeEpisodeQuota("ep-9", d);
    expect(d.markEpisodeQuotaCounted).toHaveBeenCalledWith("ep-9", "2026-10");
  });

  it("pro users get the 10/month limit", async () => {
    const d = deps({
      ensureWorkspace: vi.fn().mockResolvedValue(workspaceRow({ plan: "pro" })),
      countQuotaEpisodes: vi.fn().mockResolvedValue(10),
    });
    const state = await assertAndConsumeQuota("user_1", d);
    expect(state.allowed).toBe(false);
    expect(state.limit).toBe(10);
  });

  it("refunds on pipeline failure by unflagging counts_quota", async () => {
    const d = deps();
    await refundEpisode("ep-1", d);
    expect(d.refundEpisodeQuota).toHaveBeenCalledWith("ep-1");
  });

  it("quota state reads pro until a cancelled period ends", async () => {
    const d = deps({
      ensureWorkspace: vi.fn().mockResolvedValue(
        workspaceRow({ plan: "pro", status: "cancelled", currentPeriodEnd: new Date("2026-10-01T00:00:00Z") }),
      ),
    });
    const state = await assertAndConsumeQuota("user_1", d);
    expect(state.limit).toBe(2);
  });
});

describe("getBillingView (settings billing page)", () => {
  it("returns null when the DB is unavailable", async () => {
    expect(await getBillingView("user_1", deps({ dbConfigured: () => false }))).toBeNull();
  });

  it("builds the free-plan view with derived quota and founding counter", async () => {
    const d = deps({ countQuotaEpisodes: vi.fn().mockResolvedValue(1) });
    const view = await getBillingView("user_1", d);
    expect(view).toEqual({
      status: "active",
      plan: "free",
      managePaymentUrl: null,
      founding: false,
      planSource: null,
      used: 1,
      limit: 2,
      resetsAt: "2026-11-01T00:00:00.000Z",
      accessEndsAt: null,
      foundingLeft: 37,
      checkoutConfigured: true,
      foundingPaymentUrl: null,
    });
  });

  it("reports pro with the access end date", async () => {
    const view = await getBillingView(
      "user_1",
      deps({
        ensureWorkspace: vi.fn().mockResolvedValue(
          workspaceRow({
            plan: "pro",
            planSource: "ls",
            lsSubscriptionId: "sub_1",
            currentPeriodEnd: new Date("2026-11-30T00:00:00Z"),
          }),
        ),
        countQuotaEpisodes: vi.fn().mockResolvedValue(3),
      }),
    );
    expect(view).toMatchObject({
      plan: "pro",
      used: 3,
      limit: 10,
      accessEndsAt: "2026-11-30T00:00:00.000Z",
      managePaymentUrl: "https://ls.test/portal",
    });
  });

  it("downgrades the view after a cancelled period ended", async () => {
    const view = await getBillingView(
      "user_1",
      deps({
        ensureWorkspace: vi.fn().mockResolvedValue(
          workspaceRow({ plan: "pro", status: "cancelled", currentPeriodEnd: new Date("2026-10-01T00:00:00Z") }),
        ),
      }),
    );
    expect(view).toMatchObject({ plan: "free", limit: 2 });
  });
});
