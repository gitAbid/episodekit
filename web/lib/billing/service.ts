/**
 * Billing service (WP-08, M10/MK-9): checkout, cancel, the owner-only manual
 * plan flag, and quota consume/refund. All DB access goes through the
 * documented @/db/queries boundary; the Lemon Squeezy API is reached only via
 * the injectable client in ls.ts (single fetch boundary), so every path here
 * is testable and the keyless preview never touches the network.
 *
 * Flow decisions logged in docs/relaunch/DECISIONS.md (founding payment-link
 * fallback, cancel-keeps-Pro semantics, manual plan period lengths).
 */
import * as queries from "@/db/queries";
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
import {
  effectivePlan,
  foundingLeft,
  PLAN_LIMITS,
  quotaMonth,
  quotaResetDate,
  quotaWallCopy,
  type WorkspaceStatus,
} from "./entitlements";
import { httpLsClient, isLsConfigured, type LsClient } from "./ls";

export type BillingDeps = {
  now: () => Date;
  dbConfigured: () => boolean;
  lsConfigured: () => boolean;
  lsClient: LsClient;
  ensureWorkspace: typeof queries.getOrCreateWorkspaceByOwner;
  getWorkspaceById: typeof queries.getWorkspaceById;
  getWorkspaceByOwnerEmail: typeof queries.getWorkspaceByOwnerEmail;
  updateWorkspacePlan: typeof queries.updateWorkspacePlan;
  countQuotaEpisodes: typeof queries.countQuotaEpisodes;
  markEpisodeQuotaCounted: typeof queries.markEpisodeQuotaCounted;
  refundEpisodeQuota: typeof queries.refundEpisodeQuota;
  countFoundingWorkspaces: typeof queries.countFoundingWorkspaces;
  getUserEmail: typeof queries.getUserEmail;
};

export function defaultBillingDeps(): BillingDeps {
  return {
    now: () => new Date(),
    dbConfigured: () => Boolean(process.env.DATABASE_URL),
    lsConfigured: () => isLsConfigured(),
    lsClient: httpLsClient,
    ensureWorkspace: queries.getOrCreateWorkspaceByOwner,
    getWorkspaceById: queries.getWorkspaceById,
    getWorkspaceByOwnerEmail: queries.getWorkspaceByOwnerEmail,
    updateWorkspacePlan: queries.updateWorkspacePlan,
    countQuotaEpisodes: queries.countQuotaEpisodes,
    markEpisodeQuotaCounted: queries.markEpisodeQuotaCounted,
    refundEpisodeQuota: queries.refundEpisodeQuota,
    countFoundingWorkspaces: queries.countFoundingWorkspaces,
    getUserEmail: queries.getUserEmail,
  };
}

export type BillingPlanRequest = "pro" | "founding";

export type ServiceResult = { status: number; json: Record<string, unknown> };

/** Calendar-month arithmetic in UTC ("one month from Oct 27" = Nov 27). */
function addUtcMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()));
}

function variantIdFor(plan: BillingPlanRequest): string | undefined {
  return plan === "founding" ? process.env.LS_VARIANT_FOUNDING : process.env.LS_VARIANT_PRO_MONTHLY;
}

/** POST /api/billing/checkout — LS checkout, or the Founding payment link without LS. */
export async function handleBillingCheckout(
  userId: string,
  body: unknown,
  deps: BillingDeps,
): Promise<ServiceResult> {
  if (!deps.dbConfigured()) {
    return { status: 503, json: { error: SAVE_UNAVAILABLE_COPY } };
  }
  const plan = (body as { plan?: unknown } | null)?.plan;
  if (plan !== "pro" && plan !== "founding") {
    return { status: 400, json: { error: PLAN_REQUIRED_COPY } };
  }

  const workspace = await deps.ensureWorkspace(userId);
  if (effectivePlan(workspace, deps.now()) === "pro") {
    return { status: 409, json: { error: ALREADY_PRO_COPY } };
  }

  const email = await deps.getUserEmail(userId) ?? undefined;

  // Founding without an LS store: the owner's payment link (§0.2 manual flow).
  // The plan only becomes active when the owner flags it manually in admin.
  const paymentLinkUrl = process.env.LS_FOUNDING_PAYMENT_URL;
  if (!deps.lsConfigured()) {
    if (plan === "founding" && paymentLinkUrl) {
      return { status: 200, json: { url: paymentLinkUrl, mode: "payment_link" } };
    }
    return { status: 503, json: { error: CHECKOUT_UNAVAILABLE_COPY } };
  }

  const variantId = variantIdFor(plan);
  const storeId = process.env.LS_STORE_ID;
  if (!variantId || !storeId) {
    return { status: 503, json: { error: CHECKOUT_UNAVAILABLE_COPY } };
  }

  try {
    const { url } = await deps.lsClient.createCheckout({
      storeId,
      variantId,
      email,
      custom: { workspace_id: workspace.id },
    });
    return { status: 200, json: { url, mode: "checkout" } };
  } catch (error) {
    console.error("[billing] checkout failed", error);
    return { status: 502, json: { error: LS_UNREACHABLE_COPY } };
  }
}

/** POST /api/billing/cancel — one-click cancel; Pro stays until the access end date (U15). */
export async function handleBillingCancel(userId: string, deps: BillingDeps): Promise<ServiceResult> {
  if (!deps.dbConfigured()) {
    return { status: 503, json: { error: SAVE_UNAVAILABLE_COPY } };
  }
  const workspace = await deps.ensureWorkspace(userId);
  if (effectivePlan(workspace, deps.now()) === "free") {
    return { status: 400, json: { error: FREE_PLAN_CANCEL_COPY } };
  }

  let accessEnds =
    workspace.currentPeriodEnd ??
    (workspace.planSource === "ls" ? null : quotaResetDate(deps.now()));

  // Cancel at LS when this subscription lives there; the webhook confirms with
  // subscription_cancelled. Manual plans are cancelled locally only.
  if (workspace.planSource === "ls" && workspace.lsSubscriptionId && deps.lsConfigured()) {
    try {
      const result = await deps.lsClient.cancelSubscription(workspace.lsSubscriptionId);
      accessEnds = result.endsAt ?? accessEnds;
    } catch (error) {
      console.error("[billing] LS cancel failed", error);
      return { status: 502, json: { error: LS_UNREACHABLE_COPY } };
    }
  }

  await deps.updateWorkspacePlan(workspace.id, {
    status: "cancelled",
    currentPeriodEnd: accessEnds,
  });
  return {
    status: 200,
    json: { cancelled: true, accessEnds: (accessEnds ?? quotaResetDate(deps.now())).toISOString() },
  };
}

/** OWNER_EMAILS — comma-separated; matched case-insensitively (M13). */
function ownerEmails(): string[] {
  return (process.env.OWNER_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export type AdminPlanBody = { email: string; plan: "pro" | "free"; founding?: boolean };

/**
 * Manual plan flag (§0.2: "LS payment link for Founding Pro + manual plan
 * flag"). Owner-only; the buyer pays via the payment link and the owner flips
 * the workspace to Pro by email. Founding runs a year, plain manual Pro a
 * month — the owner re-flags or downgrades from /admin.
 */
export async function handleAdminSetPlan(
  actorUserId: string,
  body: unknown,
  deps: BillingDeps,
): Promise<ServiceResult> {
  const allowed = ownerEmails();
  if (allowed.length === 0) {
    return { status: 403, json: { error: OWNER_NOT_CONFIGURED_COPY } };
  }
  const actorEmail = (await deps.getUserEmail(actorUserId))?.toLowerCase();
  if (!actorEmail || !allowed.includes(actorEmail)) {
    return { status: 403, json: { error: OWNER_ONLY_COPY } };
  }

  const parsed = body as AdminPlanBody | null;
  if (!parsed || (parsed.plan !== "pro" && parsed.plan !== "free") || typeof parsed.email !== "string") {
    return { status: 400, json: { error: PLAN_REQUIRED_COPY } };
  }
  const workspace = await deps.getWorkspaceByOwnerEmail(parsed.email);
  if (!workspace) {
    return { status: 404, json: { error: NO_WORKSPACE_FOR_EMAIL_COPY } };
  }

  const now = deps.now();
  if (parsed.plan === "pro") {
    const founding = parsed.founding === true;
    const periodEnd = addUtcMonths(now, founding ? 12 : 1);
    await deps.updateWorkspacePlan(workspace.id, {
      plan: "pro",
      planSource: "manual",
      founding,
      status: "active",
      currentPeriodEnd: periodEnd,
    });
    return { status: 200, json: { updated: true, plan: "pro", founding, accessEnds: periodEnd.toISOString() } };
  }

  await deps.updateWorkspacePlan(workspace.id, {
    plan: "free",
    planSource: null,
    founding: false,
    status: "active",
    currentPeriodEnd: null,
  });
  return { status: 200, json: { updated: true, plan: "free" } };
}

export type QuotaState = {
  allowed: boolean;
  used: number;
  limit: number;
  quotaMonth: string;
  resetDate: Date;
  wallCopy: string | null;
};

/**
 * Quota check for the pipeline (§7.5 POST /api/episodes "counts quota"; M10:
 * counted when generation starts, refunded on pipeline failure).
 * Check-then-mark is not atomic, but a workspace has a single owner (§3: no
 * teams in the MVP), so a double-submit races only against itself.
 */
export async function assertAndConsumeQuota(userId: string, deps: BillingDeps): Promise<QuotaState> {
  const now = deps.now();
  const workspace = await deps.ensureWorkspace(userId);
  const month = quotaMonth(now);
  const used = await deps.countQuotaEpisodes(workspace.id, month);
  const plan = effectivePlan(workspace, now);
  const limit = PLAN_LIMITS[plan].episodesPerMonth;
  const resetDate = quotaResetDate(now);
  const allowed = used < limit;
  return {
    allowed,
    used,
    limit,
    quotaMonth: month,
    resetDate,
    wallCopy: allowed ? null : quotaWallCopy({ used, limit, resetDate }),
  };
}

/** Mark an episode as counted (generation started). */
export async function consumeEpisodeQuota(
  episodeId: string,
  deps: BillingDeps,
): Promise<void> {
  await deps.markEpisodeQuotaCounted(episodeId, quotaMonth(deps.now()));
}

/** Refund on pipeline failure (M10) — keeps quota_month for the audit trail. */
export async function refundEpisode(episodeId: string, deps: BillingDeps): Promise<void> {
  await deps.refundEpisodeQuota(episodeId);
}

export type BillingView = {
  plan: "free" | "pro";
  founding: boolean;
  planSource: "ls" | "manual" | null;
  status: WorkspaceStatus;
  used: number;
  limit: number;
  resetsAt: string;
  accessEndsAt: string | null;
  /** Derived from COUNT(*) of founding workspaces; null when the DB is unavailable. */
  foundingLeft: number | null;
  checkoutConfigured: boolean;
  /** Payment-link mode for Founding when the LS store is not live (§0.2). */
  foundingPaymentUrl: string | null;
  /** Signed LS customer-portal link for [Manage payment]; null when unavailable. */
  managePaymentUrl: string | null;
};

/** Data for the MK-9 billing settings page. Null when the DB is unavailable. */
export async function getBillingView(userId: string, deps: BillingDeps): Promise<BillingView | null> {
  if (!deps.dbConfigured()) return null;
  const now = deps.now();
  const workspace = await deps.ensureWorkspace(userId);
  const plan = effectivePlan(workspace, now);
  const month = quotaMonth(now);
  const used = await deps.countQuotaEpisodes(workspace.id, month);
  const foundingCount = await deps.countFoundingWorkspaces();
  let managePaymentUrl: string | null = null;
  if (workspace.planSource === "ls" && workspace.lsSubscriptionId && deps.lsConfigured()) {
    // [Manage payment] opens LS's signed customer-portal link (~24 h validity).
    try {
      managePaymentUrl = (await deps.lsClient.getSubscription(workspace.lsSubscriptionId)).customerPortalUrl;
    } catch (error) {
      console.warn("[billing] portal url unavailable", error);
    }
  }
  return {
    plan,
    founding: workspace.founding,
    planSource: workspace.planSource,
    status: workspace.status,
    used,
    limit: PLAN_LIMITS[plan].episodesPerMonth,
    resetsAt: quotaResetDate(now).toISOString(),
    accessEndsAt: workspace.currentPeriodEnd ? workspace.currentPeriodEnd.toISOString() : null,
    foundingLeft: foundingLeft(foundingCount),
    checkoutConfigured: deps.lsConfigured(),
    foundingPaymentUrl: process.env.LS_FOUNDING_PAYMENT_URL ?? null,
    managePaymentUrl,
  };
}
