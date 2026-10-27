// MK-11 stat tiles — every value is DB-derived (lib/admin/stats). null renders
// "—" (keyless/DB-less shell, or not-tracked metrics): never example numbers.
import type { AdminStats } from "@/lib/admin/stats";
import { STAT_WINDOW_DAYS } from "@/lib/admin/stats";

function fmtMoney(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

export function StatTiles({ stats }: { stats: AdminStats }) {
  const tiles: Array<{ label: string; value: string; note?: string }> = [
    {
      label: `SIGNUPS ${STAT_WINDOW_DAYS}D`,
      value: stats.signups7d == null ? "—" : String(stats.signups7d),
    },
    {
      label: `EPISODES ${STAT_WINDOW_DAYS}D`,
      value: stats.episodes7d == null ? "—" : String(stats.episodes7d),
    },
    {
      label: `EXPORTS ${STAT_WINDOW_DAYS}D`,
      value: "—",
      note: "Copy/export events aren't tracked yet",
    },
    { label: "PAYING", value: stats.paying == null ? "—" : String(stats.paying) },
    {
      label: `AI + ASR COST ${STAT_WINDOW_DAYS}D`,
      value: stats.aiCost7dUsd == null ? "—" : fmtMoney(stats.aiCost7dUsd),
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {tiles.map((t) => (
        <div key={t.label} data-slot="stat-tile" className="flex flex-col gap-1 rounded-xl border border-border p-4">
          <span className="text-xs font-medium tracking-wide text-faint">{t.label}</span>
          <span className="text-2xl font-semibold leading-8 tabular-nums">{t.value}</span>
          {t.note && <span className="text-[11px] leading-4 text-faint">{t.note}</span>}
        </div>
      ))}
    </div>
  );
}
