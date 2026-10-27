import { formatResetDate } from "@/lib/billing/entitlements";

/**
 * QuotaMeter (02-design.md §5.3) — bar + "3 of 10 episodes · resets Nov 14"
 * counter line from MK-3/MK-9. Plain Tailwind; §5.2 tokens inline (WP-01 not merged).
 */
export function QuotaMeter({ used, limit, resetsAt }: { used: number; limit: number; resetsAt: string }) {
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const atLimit = used >= limit;
  return (
    <div data-testid="quota-meter">
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-[#eceef2] dark:bg-[#232a35]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
        aria-label={`${used} of ${limit} episodes used this month`}
      >
        <div
          className={`h-full rounded-full ${atLimit ? "bg-[#9a5b00] dark:bg-[#e0a548]" : "bg-[#2457d6] dark:bg-[#5b8cff]"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        {used} of {limit} episodes · resets {formatResetDate(new Date(resetsAt))}
      </p>
    </div>
  );
}
