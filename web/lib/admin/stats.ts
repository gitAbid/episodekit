// M13 — admin stat tiles, ALL DB-derived via the @/db boundary. Keyless/DB-less
// mode renders the shell with empty states — never example numbers (§0.5).
//
// "Exports 7d": copy/export events are not tracked anywhere in the MVP schema
// (client-side copy, no events table) — the tile renders "—" with a footnote.
// Logged in DECISIONS.md 2026-10-27 · WP-09 and added to BACKLOG.md.
import { and, count, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { episodes, usageEvents, users, workspaces } from "@/db/schema";

export const STAT_WINDOW_DAYS = 7;

export interface AdminStats {
  signups7d: number | null;
  episodes7d: number | null;
  /** Not tracked in the MVP schema — always null for now. */
  exports7d: null;
  paying: number | null;
  /** AI + ASR spend (usage_events.cost_usd) over the last 7 days. */
  aiCost7dUsd: number | null;
  dbAvailable: boolean;
}

export function statWindowCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - STAT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

export const EMPTY_STATS: AdminStats = {
  signups7d: null,
  episodes7d: null,
  exports7d: null,
  paying: null,
  aiCost7dUsd: null,
  dbAvailable: false,
};

export async function loadAdminStats(now: Date = new Date()): Promise<AdminStats> {
  if (!process.env.DATABASE_URL) return EMPTY_STATS;
  const cutoff = statWindowCutoff(now);
  try {
    const db = getDb();
    const [signups] = await db.select({ n: count() }).from(users).where(gte(users.createdAt, cutoff));
    const [episodesRows] = await db
      .select({ n: count() })
      .from(episodes)
      .where(gte(episodes.createdAt, cutoff));
    const [payingRows] = await db
      .select({ n: count() })
      .from(workspaces)
      .where(and(eq(workspaces.plan, "pro"), eq(workspaces.status, "active")));
    const [costRows] = await db
      .select({ total: sql<string>`COALESCE(SUM(${usageEvents.costUsd}), 0)` })
      .from(usageEvents)
      .where(gte(usageEvents.createdAt, cutoff));
    return {
      signups7d: signups?.n ?? 0,
      episodes7d: episodesRows?.n ?? 0,
      exports7d: null,
      paying: payingRows?.n ?? 0,
      aiCost7dUsd: Number.parseFloat(costRows?.total ?? "0") || 0,
      dbAvailable: true,
    };
  } catch (err) {
    console.error("[admin] stats query failed:", err);
    return EMPTY_STATS;
  }
}
