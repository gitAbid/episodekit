import { quotaWallCopy } from "@/lib/billing/entitlements";
import { UpgradeButton } from "./upgrade-button";

/**
 * Plan wall card (02-design.md §5.7) with the §6 verbatim quota copy.
 * Mounted by the intake flow when the workspace is over quota (U14); the
 * billing page itself always shows the plan card instead.
 */
export function QuotaWall({ used, limit, resetsAt }: { used: number; limit: number; resetsAt: string }) {
  return (
    <div data-testid="quota-wall" className="rounded-lg border border-[#e3e6eb] p-6 dark:border-[#2a313c]">
      <p className="text-sm font-semibold">Monthly episode limit reached</p>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
        {quotaWallCopy({ used, limit, resetDate: new Date(resetsAt) })}
      </p>
      <div className="mt-4">
        <UpgradeButton plan="pro" label="Upgrade to Pro — $19/month" testId="quota-wall-upgrade" />
      </div>
    </div>
  );
}
