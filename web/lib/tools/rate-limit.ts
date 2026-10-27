// M12 — free tools: 5/day per IP. In-memory fixed UTC-day window.
//
// Limitation (documented in DECISIONS.md 2026-10-27 · WP-09): a plain Map is
// per-process and resets on deploy, so on serverless it is best-effort per
// instance. The hard spend boundary is the global daily cost cap
// (lib/tools/cost-cap.ts), which IS shared state (DB). This limiter keeps the
// MVP free of extra infra (tie-break §0.4 rule 1).
const buckets = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Unix ms when the window resets (next UTC midnight). */
  resetAt: number;
}

function nextUtcMidnight(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

/** Periodically drop expired buckets so the map cannot grow unbounded. */
function sweep(now: number): void {
  if (buckets.size < 10_000) return;
  for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
}

export function consumeDaily(
  ip: string,
  limit: number,
  opts?: { now?: Date; store?: Map<string, { count: number; resetAt: number }> },
): RateLimitResult {
  const now = opts?.now ?? new Date();
  const store = opts?.store ?? buckets;
  const resetAt = nextUtcMidnight(now).getTime();
  // The reset timestamp identifies the UTC day, so the bucket is stable all day.
  const key = `${resetAt}:${ip}`;
  const bucket = store.get(key) ?? { count: 0, resetAt };
  sweep(now.getTime());
  if (bucket.resetAt <= now.getTime()) {
    bucket.count = 0;
    bucket.resetAt = resetAt;
  }
  if (bucket.count >= limit) {
    store.set(key, bucket);
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }
  bucket.count += 1;
  store.set(key, bucket);
  return { allowed: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

/** Test/ops hook: forget all buckets. */
export function resetRateLimits(): void {
  buckets.clear();
}
