/**
 * Entitlements boundary — STUB returning free-plan limits until WP-08 lands
 * (billing + quota, M10). WP-08 replaces the bodies, not the call sites:
 * intake routes call `getEpisodeQuota` / `checkEpisodeQuota` and treat this
 * as the single documented entitlements seam.
 */
import { quotaMonthNow } from "@/lib/episodes/month";
import * as queries from "@/db/queries";

export const PLAN_LIMITS = {
  free: { monthlyEpisodes: 2, maxDurationMs: 60 * 60 * 1000 },
  pro: { monthlyEpisodes: 10, maxDurationMs: 2 * 60 * 60 * 1000 },
} as const;

export type PlanId = keyof typeof PLAN_LIMITS;

/** ≤300 MB compressed per §7.5 (uploads/token quota check). */
export const MAX_UPLOAD_BYTES = 300 * 1000 * 1000;

/** M2 upload allow-list: mp3, m4a, wav, aac, ogg, webm, mp4, mov. */
export const AUDIO_UPLOAD_EXTENSIONS = ["mp3", "m4a", "wav", "aac", "ogg", "webm", "mp4", "mov"] as const;

export const AUDIO_UPLOAD_CONTENT_TYPES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/aac",
  "audio/ogg",
  "audio/opus",
  "audio/vorbis",
  "audio/webm",
  "video/webm",
  "video/mp4",
  "video/quicktime",
] as const;

export interface EpisodeQuota {
  allowed: boolean;
  used: number;
  limit: number;
  resetDate: string;
}

export function planLimits(plan: string): (typeof PLAN_LIMITS)[PlanId] {
  return PLAN_LIMITS[plan === "pro" ? "pro" : "free"];
}

/**
 * Current quota state for a workspace. STUB: counts episodes created this
 * month that count against quota; WP-08 owns the real entitlements logic.
 */
export async function getEpisodeQuota(workspace: {
  id: string;
  plan: string;
}): Promise<EpisodeQuota> {
  const limits = planLimits(workspace.plan);
  const month = quotaMonthNow();
  const used = await queries.countQuotaEpisodes(workspace.id, month);
  return {
    allowed: used < limits.monthlyEpisodes,
    used,
    limit: limits.monthlyEpisodes,
    resetDate: resetDateFor(month),
  };
}

export async function checkEpisodeQuota(workspace: {
  id: string;
  plan: string;
}): Promise<EpisodeQuota> {
  return getEpisodeQuota(workspace);
}

/** First day of next month (YYYY-MM-DD) for the §6 quota-wall copy. */
export function resetDateFor(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
}

/** §6 verbatim quota-wall copy. */
export function quotaWallCopy(quota: EpisodeQuota): string {
  return `You've used ${quota.used} of ${quota.limit} episodes this month. Upgrade for more, or wait until ${quota.resetDate}.`;
}
