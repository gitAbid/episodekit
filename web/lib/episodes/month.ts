/** "2026-10" — quota month stamp for episodes.counts_quota (§7.1). */
export function quotaMonthNow(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7);
}
