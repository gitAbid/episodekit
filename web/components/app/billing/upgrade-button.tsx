"use client";

import { useState } from "react";

/**
 * Upgrade button: POSTs /api/billing/checkout and redirects to the returned
 * Lemon Squeezy checkout (or Founding payment link) URL. Route errors carry
 * their own copy (preview unavailable, already Pro, LS unreachable).
 */
export function UpgradeButton({
  plan,
  label,
  testId,
  disabled = false,
}: {
  plan: "pro" | "founding";
  label: string;
  testId?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (res.ok && typeof data?.url === "string") {
        window.location.href = data.url;
        return;
      }
      setError(data?.error ?? "Something went wrong. Try again.");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        data-testid={testId}
        onClick={startCheckout}
        disabled={disabled || busy}
        className="rounded-md bg-[#2457d6] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d48b5] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#5b8cff] dark:text-[#0e1116] dark:hover:bg-[#7aa2ff]"
      >
        {busy ? "Opening checkout…" : label}
      </button>
      {error ? (
        <span role="alert" data-testid="checkout-error" className="text-xs text-[#b42318] dark:text-[#ff6b5e]">
          {error}
        </span>
      ) : null}
    </span>
  );
}
