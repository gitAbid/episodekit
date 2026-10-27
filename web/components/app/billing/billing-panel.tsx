"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  cancelDialogCopy,
  formatResetDate,
  FOUNDING_PRICE_COPY,
  PRO_PRICE_COPY,
} from "@/lib/billing/entitlements";
import type { BillingView } from "@/lib/billing/service";
import { UpgradeButton } from "./upgrade-button";
import { QuotaMeter } from "./quota-meter";

/**
 * MK-9 Billing settings: plan card (plan name, price, renewal/access date,
 * QuotaMeter), Upgrade / Founding buttons on Free, Manage payment + Cancel on
 * Pro, and the cancel dialog with the verbatim MK-9 copy.
 */
export function BillingPanel({ view }: { view: BillingView }) {
  const router = useRouter();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paid = view.plan === "pro";
  const dialog =
    view.accessEndsAt !== null
      ? cancelDialogCopy({ periodEnd: new Date(view.accessEndsAt) })
      : cancelDialogCopy({ periodEnd: new Date(view.resetsAt) });
  const foundingLabel =
    view.foundingLeft === null
      ? `Founding Pro — ${FOUNDING_PRICE_COPY}`
      : `Founding Pro — ${FOUNDING_PRICE_COPY} · ${view.foundingLeft} left`;

  async function confirmCancel() {
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.ok) {
        setCancelOpen(false);
        router.refresh();
        return;
      }
      setError(data?.error ?? "Something went wrong. Try again.");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div data-testid="billing-plan-card" className="max-w-xl rounded-lg border border-[#e3e6eb] p-6 dark:border-[#2a313c]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
              Current plan
            </p>
            <h2 className="mt-1 text-lg font-semibold" data-testid="billing-plan-name">
              {paid ? (view.founding ? "Founding Pro" : "Pro") : "Free"}
            </h2>
            {paid && view.accessEndsAt ? (
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400" data-testid="billing-renewal">
                {view.status === "cancelled" ? "Cancels" : "Renews"} {formatResetDate(new Date(view.accessEndsAt))}
              </p>
            ) : null}
          </div>
          <span className="text-lg font-semibold" data-testid="billing-price">
            {paid ? PRO_PRICE_COPY : "$0"}
          </span>
        </div>

        <div className="mt-4">
          <QuotaMeter used={view.used} limit={view.limit} resetsAt={view.resetsAt} />
        </div>

        <div className="mt-5 flex flex-wrap items-start gap-2">
          {paid ? (
            <>
              {view.managePaymentUrl ? (
                <a
                  href={view.managePaymentUrl}
                  data-testid="manage-payment"
                  className="rounded-md border border-[#cdd2da] px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-[#3a4350] dark:hover:bg-[#1b212a]"
                >
                  Manage payment
                </a>
              ) : null}
              <button
                type="button"
                data-testid="cancel-plan"
                onClick={() => setCancelOpen(true)}
                className="rounded-md px-4 py-2 text-sm font-medium text-[#b42318] hover:bg-[#fdecea] dark:text-[#ff6b5e] dark:hover:bg-[#2f1614]"
              >
                Cancel plan
              </button>
            </>
          ) : (
            <>
              <UpgradeButton plan="pro" label={`Upgrade to Pro — ${PRO_PRICE_COPY}`} testId="upgrade-pro" />
              <UpgradeButton
                plan="founding"
                label={foundingLabel}
                testId="upgrade-founding"
                disabled={view.foundingLeft === 0}
              />
            </>
          )}
        </div>
      </div>

      {cancelOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgb(17_24_39/0.4)] p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-dialog-title"
            data-testid="cancel-dialog"
            className="w-full max-w-sm rounded-xl border border-[#e3e6eb] bg-white p-6 dark:border-[#2a313c] dark:bg-[#151a21]"
          >
            <h2 id="cancel-dialog-title" className="text-base font-semibold">
              {dialog.title}
            </h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300" data-testid="cancel-dialog-copy">
              {dialog.body}
            </p>
            {error ? (
              <p role="alert" data-testid="cancel-error" className="mt-2 text-xs text-[#b42318] dark:text-[#ff6b5e]">
                {error}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                data-testid="keep-pro"
                onClick={() => setCancelOpen(false)}
                className="rounded-md border border-[#cdd2da] px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-[#3a4350] dark:hover:bg-[#1b212a]"
              >
                {dialog.keepLabel}
              </button>
              <button
                type="button"
                data-testid="confirm-cancel-plan"
                onClick={confirmCancel}
                disabled={cancelling}
                className="rounded-md bg-[#b42318] px-4 py-2 text-sm font-medium text-white hover:bg-[#9a1c12] disabled:opacity-50 dark:bg-[#ff6b5e] dark:text-[#0e1116]"
              >
                {cancelling ? "Cancelling…" : dialog.cancelLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
