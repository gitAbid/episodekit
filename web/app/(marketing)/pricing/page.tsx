// §5.4 /pricing — M10 plans, plain copy. Static.
import type { Metadata } from "next";
import Link from "next/link";
import { FOUNDING_TOTAL, foundingRemaining } from "@/lib/billing/entitlements";

export const metadata: Metadata = {
  title: "Pricing — EpisodeKit",
  description:
    "Free: 2 episodes a month. Pro $19/month: 10 episodes, up to 2 hours each, no footer. Founding Pro $99/year, price locked for life.",
};

export default async function PricingPage() {
  const foundingLeft = await foundingRemaining();
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
        <h1 className="text-[28px] font-semibold leading-9 tracking-tight">Pricing</h1>
        <p className="text-body">Pay per month, cancel in two clicks. Your episodes stay either way.</p>
      </div>

      <div className="mx-auto mt-10 grid w-full max-w-[720px] gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-xl border border-border p-6">
          <span className="font-semibold">Free</span>
          <span className="text-[32px] font-semibold leading-none">$0</span>
          <ul className="ml-4 list-disc space-y-1 text-sm text-body">
            <li>2 episodes a month</li>
            <li>Up to 60 minutes each</li>
            <li>All 7 pieces of content</li>
            <li>EpisodeKit footer on exports</li>
          </ul>
          <Link
            href="/sign-up"
            className="mt-auto inline-flex h-10 items-center justify-center rounded-md border border-border-strong bg-background text-sm font-medium hover:bg-surface-2"
          >
            Start free
          </Link>
        </div>
        <div className="flex flex-col gap-3 rounded-xl border border-accent p-6 ring-1 ring-accent">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Pro</span>
            <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
              Most popular
            </span>
          </div>
          <span className="text-[32px] font-semibold leading-none">
            $19<span className="text-sm font-normal text-faint">/month</span>
          </span>
          <ul className="ml-4 list-disc space-y-1 text-sm text-body">
            <li>10 episodes a month</li>
            <li>Up to 2 hours each</li>
            <li>All 7 pieces of content</li>
            <li>No EpisodeKit footer</li>
            <li>Cancel in 2 clicks</li>
          </ul>
          <Link
            href="/sign-up"
            className="mt-auto inline-flex h-10 items-center justify-center rounded-md border border-accent bg-accent text-sm font-medium text-on-accent hover:bg-accent-hover"
          >
            Get Pro
          </Link>
        </div>
      </div>

      <p className="mt-6 text-center text-sm">
        Founding Pro: <span className="font-semibold">$99/year</span>, price locked for life ·{" "}
        <span className="font-mono tabular-nums">{foundingLeft}</span> of {FOUNDING_TOTAL} left
      </p>

      <div className="mx-auto mt-10 flex max-w-2xl flex-col gap-3 text-sm text-body">
        <p>
          Quota is counted when a package starts and refunded if the pipeline fails. Free-plan
          exports carry the line “Show notes made with EpisodeKit”.
        </p>
      </div>
    </div>
  );
}
