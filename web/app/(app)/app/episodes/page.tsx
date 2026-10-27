// M8 / MK-3: episode library for the show — status, length, user-ticked
// "Ready x/7", date — plus the quota meter and the empty state.
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { buttonVariants } from "@/components/ui/button";
import { QuotaMeter } from "@/components/app/quota-meter";
import { StatusPill } from "@/components/app/status-pill";
import { requireUser } from "@/lib/auth";
import { formatResetDate } from "@/lib/billing/entitlements";
import { defaultBillingDeps, getBillingView } from "@/lib/billing/service";
import { isDbConfigured } from "@/lib/env";
import { getShowByOwner, listEpisodeSummariesForShow, type EpisodeListRow } from "@/db/queries";

export const metadata = { title: "Episodes · EpisodeKit" };

export default function EpisodesPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-surface-2" data-testid="episodes-loading" />}>
      <EpisodesContent />
    </Suspense>
  );
}

const formatLength = (ms: number | null) => {
  if (!ms) return "—";
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
};

const episodeLabel = (e: EpisodeListRow) => {
  const title = e.title ?? (e.source === "sample" ? "Sample episode" : "Untitled episode");
  return e.number ? `Ep ${e.number} · ${title}` : title;
};

async function EpisodesContent() {
  // Per-user library — request-time rendering.
  await connection();
  const userId = await requireUser();

  let episodes: EpisodeListRow[] = [];
  let quota: { used: number; limit: number; resetsOn: string } | null = null;
  if (isDbConfigured()) {
    const show = await getShowByOwner(userId);
    if (show) episodes = await listEpisodeSummariesForShow(show.id);
    const billing = await getBillingView(userId, defaultBillingDeps());
    if (billing) {
      quota = { used: billing.used, limit: billing.limit, resetsOn: formatResetDate(new Date(billing.resetsAt)) };
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="flex-1 text-2xl font-semibold text-foreground">Episodes</h1>
        {quota ? (
          <QuotaMeter used={quota.used} limit={quota.limit} resetsOn={quota.resetsOn} className="w-56" />
        ) : null}
        {episodes.length ? (
          <Link href="/app/episodes/new" className={buttonVariants()}>
            + New episode
          </Link>
        ) : null}
      </div>

      {episodes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border p-10 text-center" data-testid="episodes-empty">
          <p className="font-medium text-foreground">No episodes yet</p>
          <p className="text-sm text-muted-foreground">
            Upload your first episode and get a full content package in minutes.
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
            <Link href="/app/episodes/new" className={buttonVariants()}>
              New episode
            </Link>
            <Link href="/app/episodes/new?sample=1" className="text-sm font-medium text-accent hover:underline">
              Try a sample episode
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full border-collapse text-sm" data-testid="episodes-table">
            <thead>
              <tr className="bg-surface-2 text-left text-xs font-medium text-faint">
                <th className="px-4 py-2.5 font-medium">Title</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Length</th>
                <th className="px-4 py-2.5 font-medium">Ready</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {episodes.map((e) => (
                <tr key={e.id} className="border-t hover:bg-surface-2" data-testid="episode-row">
                  <td className="px-4 py-3.5">
                    <Link href={`/app/episodes/${e.id}`} className="font-medium text-foreground hover:underline">
                      {episodeLabel(e)}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusPill
                      status={e.status === "uploading" ? "queued" : e.status}
                      label={e.status === "uploading" ? "Uploading" : undefined}
                    />
                  </td>
                  <td className="px-4 py-3.5 font-mono tabular-nums text-body">{formatLength(e.durationMs)}</td>
                  <td className="px-4 py-3.5 tabular-nums text-body">{e.status === "ready" ? `${e.readyCount}/7` : "—"}</td>
                  <td className="px-4 py-3.5 text-body">{formatResetDate(e.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
