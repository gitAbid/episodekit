// M13 / MK-11 — /admin, owner-only (OWNER_EMAILS via lib/ai/owner). Keyless or
// non-owner → the shell with empty states and a clear reason; never fake
// numbers (§0.5). Stats + feedback are DB-derived; the AI provider card talks
// to WP-04's existing /api/admin/ai routes.
import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireOwner } from "@/lib/ai/owner";
import { loadAdminStats } from "@/lib/admin/stats";
import { listFeedback } from "@/db/queries";
import { StatTiles } from "@/components/admin/stat-tiles";
import { AiProviderCard } from "@/components/admin/ai-provider-card";
import type { FeedbackListRow } from "@/db/queries";

export const metadata: Metadata = {
  title: "Admin — EpisodeKit",
  robots: { index: false },
};


const DENY_COPY: Record<string, string> = {
  unauthenticated: "Sign in with the owner account to see admin.",
  not_owner: "This page is owner-only. Your account isn't in OWNER_EMAILS.",
  owner_not_configured:
    "Admin unlocks when OWNER_EMAILS is set in the environment. Until then everything below shows empty states — no example numbers.",
  auth_unavailable:
    "Auth isn't configured in this deployment (keyless preview). The admin shell renders with empty states; no numbers are faked.",
};

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function AdminPage() {
  return (
    // Request-time data (owner gate, 7-day windows) streams inside Suspense;
    // the shell prerenders (cacheComponents).
    <Suspense fallback={<AdminSkeleton />}>
      <AdminContent />
    </Suspense>
  );
}

function AdminSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8" aria-busy="true">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      <div className="h-16 rounded-xl border border-border bg-surface-2" />
      <div className="h-40 rounded-xl border border-border bg-surface-2" />
    </div>
  );
}

async function AdminContent() {
  // request-time boundary: owner gate + 7-day windows need the live request
  await connection();
  const gate = await requireOwner();
  const stats = await loadAdminStats();

  let feedback: FeedbackListRow[] | null = null;
  if (gate.ok) {
    try {
      feedback = await listFeedback(50);
    } catch {
      feedback = null;
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <span className="text-sm text-faint">
          {gate.ok ? `Owner · ${gate.email}` : "Locked"} · Last {7} days
        </span>
      </div>

      <StatTiles stats={stats} />

      <AiProviderCard />

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Feedback</h2>
        {!gate.ok ? (
          <p className="rounded-xl border border-border p-4 text-sm text-body">
            {DENY_COPY[gate.reason] ?? "Owner-only."}
          </p>
        ) : feedback == null ? (
          <p className="rounded-xl border border-border p-4 text-sm text-body">
            Feedback needs the database, which isn&apos;t reachable right now.
          </p>
        ) : feedback.length === 0 ? (
          <p className="rounded-xl border border-border p-4 text-sm text-body">
            No feedback yet. It appears here the moment someone rates an artifact or uses the
            Feedback button.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-surface-2 text-left text-xs tracking-wide text-faint uppercase">
                  <th className="p-3">When</th>
                  <th className="p-3">Artifact</th>
                  <th className="p-3">Rating</th>
                  <th className="p-3">Note</th>
                </tr>
              </thead>
              <tbody>
                {feedback.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="p-3 whitespace-nowrap text-faint">{fmtDate(row.createdAt)}</td>
                    <td className="p-3">{row.artifactKind ?? "—"}</td>
                    <td className="p-3">{row.rating === 1 ? "👍" : row.rating === -1 ? "👎" : "—"}</td>
                    <td className="p-3 text-body">{row.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
