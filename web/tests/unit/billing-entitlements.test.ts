import { describe, expect, it } from "vitest";
import {
  cancelDialogCopy,
  durationLimitCopy,
  effectivePlan,
  entitlementsFor,
  FORMAT_RESET_DATE,
  foundingLeft,
  getEntitlements,
  PLAN_LIMITS,
  quotaMonth,
  quotaResetDate,
  quotaWallCopy,
  lsStatusToWorkspaceStatus,
  type WorkspacePlanState,
} from "@/lib/billing/entitlements";

const OCT_27_2026 = new Date("2026-10-27T12:00:00.000Z");

function ws(overrides: Partial<WorkspacePlanState> = {}): WorkspacePlanState {
  return {
    plan: "free",
    status: "active",
    founding: false,
    currentPeriodEnd: null,
    ...overrides,
  };
}

describe("plan limits (M10)", () => {
  it("free: 2 episodes/month, <=60 min, footer on", () => {
    expect(PLAN_LIMITS.free).toEqual({
      episodesPerMonth: 2,
      maxEpisodeDurationMs: 60 * 60_000,
      footer: true,
    });
  });

  it("pro: 10 episodes/month, <=2 h, no footer", () => {
    expect(PLAN_LIMITS.pro).toEqual({
      episodesPerMonth: 10,
      maxEpisodeDurationMs: 2 * 60 * 60_000,
      footer: false,
    });
  });

  it("founding gets pro entitlements (founding = pro yearly)", () => {
    const founding = getEntitlements(ws({ plan: "pro", founding: true }), OCT_27_2026);
    const pro = getEntitlements(ws({ plan: "pro" }), OCT_27_2026);
    expect(founding).toEqual(pro);
  });

  it("exposes the per-plan duration limit in words for the too_long error", () => {
    expect(durationLimitCopy("free")).toBe("60 minutes");
    expect(durationLimitCopy("pro")).toBe("2 hours");
  });
});

describe("quota month (episodes.quota_month char(7))", () => {
  it("formats the UTC calendar month as YYYY-MM", () => {
    expect(quotaMonth(OCT_27_2026)).toBe("2026-10");
    expect(quotaMonth(new Date("2026-01-01T00:30:00.000Z"))).toBe("2026-01");
    expect(quotaMonth(new Date("2026-12-31T23:59:59.000Z"))).toBe("2026-12");
  });

  it("rolls over the year", () => {
    expect(quotaMonth(new Date("2027-01-01T00:00:00.000Z"))).toBe("2027-01");
  });

  it("reset date is the first day of the next UTC month", () => {
    expect(quotaResetDate(OCT_27_2026).toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(quotaResetDate(new Date("2026-12-14T10:00:00.000Z")).toISOString()).toBe(
      "2027-01-01T00:00:00.000Z",
    );
  });

  it("formats the reset date like the mockup counter (Nov 14)", () => {
    expect(FORMAT_RESET_DATE(new Date("2026-11-14T00:00:00.000Z"))).toBe("Nov 14");
    expect(FORMAT_RESET_DATE(new Date("2026-11-01T00:00:00.000Z"))).toBe("Nov 1");
  });
});

describe("effective plan (cancel keeps Pro until period end)", () => {
  it("free stays free", () => {
    expect(effectivePlan(ws(), OCT_27_2026)).toBe("free");
  });

  it("active pro stays pro", () => {
    expect(
      effectivePlan(ws({ plan: "pro", status: "active", currentPeriodEnd: new Date("2026-11-30") }), OCT_27_2026),
    ).toBe("pro");
  });

  it("cancelled pro keeps Pro until the access end date", () => {
    const state = ws({
      plan: "pro",
      status: "cancelled",
      currentPeriodEnd: new Date("2026-11-30T00:00:00.000Z"),
    });
    expect(effectivePlan(state, OCT_27_2026)).toBe("pro");
    expect(effectivePlan(state, new Date("2026-11-30T00:00:00.000Z"))).toBe("free");
    expect(effectivePlan(state, new Date("2026-12-01T00:00:00.000Z"))).toBe("free");
  });

  it("cancelled without a period end stays pro (defensive; writers always set one)", () => {
    expect(effectivePlan(ws({ plan: "pro", status: "cancelled" }), OCT_27_2026)).toBe("pro");
  });
});

describe("entitlementsFor", () => {
  it("derives limits and footer from the effective plan", () => {
    expect(entitlementsFor(ws(), OCT_27_2026)).toEqual({
      plan: "free",
      episodesPerMonth: 2,
      maxEpisodeDurationMs: 60 * 60_000,
      footer: true,
    });
    expect(entitlementsFor(ws({ plan: "pro" }), OCT_27_2026)).toEqual({
      plan: "pro",
      episodesPerMonth: 10,
      maxEpisodeDurationMs: 2 * 60 * 60_000,
      footer: false,
    });
  });
});

describe("quota wall copy (02-design.md §6, verbatim)", () => {
  it("substitutes used, limit and the formatted reset date", () => {
    expect(
      quotaWallCopy({ used: 2, limit: 2, resetDate: new Date("2026-11-01T00:00:00.000Z") }),
    ).toBe(
      "You've used 2 of 2 episodes this month. Upgrade for more, or wait until Nov 1.",
    );
    expect(
      quotaWallCopy({ used: 10, limit: 10, resetDate: new Date("2026-12-01T00:00:00.000Z") }),
    ).toBe(
      "You've used 10 of 10 episodes this month. Upgrade for more, or wait until Dec 1.",
    );
  });
});

describe("cancel dialog copy (MK-9, verbatim)", () => {
  it("matches the mockup with the access end date", () => {
    expect(
      cancelDialogCopy({ periodEnd: new Date("2026-11-30T00:00:00.000Z") }),
    ).toEqual({
      title: "Cancel Pro?",
      body: "You'll keep Pro until Nov 30. Your episodes stay.",
      keepLabel: "Keep Pro",
      cancelLabel: "Cancel plan",
    });
  });
});

describe("founding counter (first 100, derived from the DB)", () => {
  it("subtracts founding workspaces from 100 and never goes negative", () => {
    expect(foundingLeft(0)).toBe(100);
    expect(foundingLeft(63)).toBe(37);
    expect(foundingLeft(100)).toBe(0);
    expect(foundingLeft(120)).toBe(0);
  });
});

describe("Lemon Squeezy status mapping (§7.1 workspace status)", () => {
  it("maps healthy states to active", () => {
    expect(lsStatusToWorkspaceStatus("active")).toBe("active");
    expect(lsStatusToWorkspaceStatus("on_trial")).toBe("active");
  });

  it("maps payment problems and holds to past_due", () => {
    expect(lsStatusToWorkspaceStatus("past_due")).toBe("past_due");
    expect(lsStatusToWorkspaceStatus("unpaid")).toBe("past_due");
    expect(lsStatusToWorkspaceStatus("paused")).toBe("past_due");
  });

  it("maps ended states to cancelled", () => {
    expect(lsStatusToWorkspaceStatus("cancelled")).toBe("cancelled");
    expect(lsStatusToWorkspaceStatus("expired")).toBe("cancelled");
  });

  it("fails closed on unknown states", () => {
    expect(lsStatusToWorkspaceStatus("something_new")).toBe("past_due");
  });
});
