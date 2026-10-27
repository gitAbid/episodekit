/**
 * Plan entitlements and quota semantics (01-product.md M10, 02-design.md §5.5 MK-9, §6 copy deck).
 *
 * Pure module — no DB, no env. Semantics:
 * - Quota is counted when generation starts (episodes.counts_quota=true with
 *   episodes.quota_month = the UTC calendar month) and refunded on pipeline
 *   failure (counts_quota=false). §7.5 POST /api/episodes "counts quota".
 * - quota_month is a UTC calendar month (char(7) per §7.1), so the quota
 *   resets on the first day of the next UTC month — independent of the
 *   billing renewal date shown on the plan card.
 * - Founding Pro = Pro yearly (M10): a workspace with founding=true always has
 *   plan=pro (invariant maintained by every writer); the flag only marks the
 *   $99/yr founding deal and counts against the first-100 counter.
 * - Cancelling keeps Pro until current_period_end ("You'll keep Pro until …").
 *   effectivePlan() derives the downgrade — no cron needed.
 */

export type PlanId = "free" | "pro";

/** The active|past_due|cancelled enum from §7.1 workspaces.status. */
export type WorkspaceStatus = "active" | "past_due" | "cancelled";

/** Structural subset of the workspaces row the billing layer needs. */
export type WorkspacePlanState = {
  plan: PlanId;
  status: WorkspaceStatus;
  founding: boolean;
  currentPeriodEnd: Date | null;
};

export const FREE_EPISODE_LIMIT = 2;
export const PRO_EPISODE_LIMIT = 10;
export const FREE_MAX_DURATION_MS = 60 * 60_000;
export const PRO_MAX_DURATION_MS = 2 * 60 * 60_000;

/** M10: "Founding Pro $99/yr, first 100" — the cap is fixed; the sold count is always derived from the DB. */
export const FOUNDING_TOTAL = 100;
export const FOUNDING_PRICE_COPY = "$99/year";
export const PRO_PRICE_COPY = "$19/month";

export const PLAN_LIMITS: Record<
  PlanId,
  { episodesPerMonth: number; maxEpisodeDurationMs: number; footer: boolean }
> = {
  free: { episodesPerMonth: FREE_EPISODE_LIMIT, maxEpisodeDurationMs: FREE_MAX_DURATION_MS, footer: true },
  pro: { episodesPerMonth: PRO_EPISODE_LIMIT, maxEpisodeDurationMs: PRO_MAX_DURATION_MS, footer: false },
};

/** "2026-10" — the UTC calendar month an episode counts against (episodes.quota_month). */
export function quotaMonth(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Quota resets on the first day of the next UTC month. */
export function quotaResetDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

/** Mockup counter format ("resets Nov 14"). UTC for determinism. */
export function formatResetDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

// Alias kept short for local copy assembly below.
const FORMAT_RESET_DATE = formatResetDate;
export { FORMAT_RESET_DATE };

/**
 * The plan the workspace may use right now. Cancelled workspaces keep Pro
 * until current_period_end, then read as free (U15 "see access end date").
 */
export function effectivePlan(wsState: WorkspacePlanState, now: Date): PlanId {
  if (wsState.plan === "free") return "free";
  if (
    wsState.status === "cancelled" &&
    wsState.currentPeriodEnd &&
    wsState.currentPeriodEnd.getTime() <= now.getTime()
  ) {
    return "free";
  }
  return "pro";
}

export type Entitlements = {
  plan: PlanId;
  episodesPerMonth: number;
  maxEpisodeDurationMs: number;
  /** Free plan appends "Show notes made with EpisodeKit" (M7/M10). */
  footer: boolean;
};

export function entitlementsFor(wsState: WorkspacePlanState, now: Date): Entitlements {
  const plan = effectivePlan(wsState, now);
  return { plan, ...PLAN_LIMITS[plan] };
}

export function getEntitlements(wsState: WorkspacePlanState, now: Date): Entitlements {
  return entitlementsFor(wsState, now);
}

/** {limit} for the §6 too_long copy "Episodes can be up to {limit} on your plan." */
export function durationLimitCopy(plan: PlanId): string {
  return plan === "pro" ? "2 hours" : "60 minutes";
}

/** Quota wall card copy — verbatim from the §6 copy deck. */
export function quotaWallCopy(input: { used: number; limit: number; resetDate: Date }): string {
  return (
    `You've used ${input.used} of ${input.limit} episodes this month. ` +
    `Upgrade for more, or wait until ${FORMAT_RESET_DATE(input.resetDate)}.`
  );
}

/** Cancel dialog copy — verbatim from MK-9. */
export function cancelDialogCopy(input: { periodEnd: Date }): {
  title: string;
  body: string;
  keepLabel: string;
  cancelLabel: string;
} {
  return {
    title: "Cancel Pro?",
    body: `You'll keep Pro until ${FORMAT_RESET_DATE(input.periodEnd)}. Your episodes stay.`,
    keepLabel: "Keep Pro",
    cancelLabel: "Cancel plan",
  };
}

/** "N of 100 left" — derived from a COUNT(*) of founding workspaces; never stored. */
export function foundingLeft(foundingCount: number): number {
  return Math.max(0, FOUNDING_TOTAL - foundingCount);
}

/**
 * LS subscription status → §7.1 workspace status. LS states: on_trial, active,
 * paused, past_due, unpaid, cancelled, expired. Paused/unpaid are holds, not
 * cancellations, so they map to past_due; unknown future states fail closed to
 * past_due (access kept, flagged) rather than cancelling a paying user.
 */
export function lsStatusToWorkspaceStatus(lsStatus: string): WorkspaceStatus {
  switch (lsStatus) {
    case "active":
    case "on_trial":
      return "active";
    case "cancelled":
    case "expired":
      return "cancelled";
    default:
      return "past_due";
  }
}
