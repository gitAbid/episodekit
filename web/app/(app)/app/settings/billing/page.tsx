import { connection } from "next/server";
import { Suspense } from "react";
import { BillingPanel } from "@/components/app/billing/billing-panel";
import { requireUser } from "@/lib/auth";
import { quotaResetDate } from "@/lib/billing/entitlements";
import { defaultBillingDeps, getBillingView, type BillingView } from "@/lib/billing/service";
import { isDbConfigured } from "@/lib/env";

export const metadata = { title: "Settings · EpisodeKit" };

/**
 * Keyless preview default (WP-02 pattern): a free plan with honest zeros.
 * Nothing is faked — the founding counter stays hidden without a DB and the
 * checkout/cancel buttons surface the preview copy from the API.
 */
function keylessView(): BillingView {
  return {
    plan: "free",
    founding: false,
    planSource: null,
    status: "active",
    used: 0,
    limit: 2,
    resetsAt: quotaResetDate(new Date()).toISOString(),
    accessEndsAt: null,
    foundingLeft: null,
    checkoutConfigured: false,
    foundingPaymentUrl: process.env.LS_FOUNDING_PAYMENT_URL ?? null,
    managePaymentUrl: null,
  };
}

async function BillingContent() {
  // Per-user state (plan, quota, reset date) — request-time rendering.
  await connection();
  const userId = await requireUser();
  let view = keylessView();
  if (isDbConfigured()) {
    try {
      view = (await getBillingView(userId, defaultBillingDeps())) ?? view;
    } catch (error) {
      console.error("[billing] view unavailable", error);
    }
  }
  return <BillingPanel view={view} />;
}

/** Settings → Billing (M10, MK-9). Shell prerenders; the panel streams per user. */
export default function SettingsBillingPage() {
  return (
    <Suspense fallback={<div data-testid="billing-loading" className="h-48 animate-pulse rounded-lg bg-neutral-100 dark:bg-[#1b212a]" />}>
      <BillingContent />
    </Suspense>
  );
}
