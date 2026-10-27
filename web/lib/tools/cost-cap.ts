// M12 — global daily cost cap for the free tools (FREE_TOOL_DAILY_USD,
// default 3, UTC day). When the cap is hit (or no AI provider is configured)
// the tools answer with the deterministic engine + honest note instead of AI.
//
// Storage: `app_settings` key "free_tool_spend" ({day, costUsd}) via
// FreeToolSpendStore. The §7.1 usage_events table cannot hold free-tool rows
// (workspace_id is NOT NULL — no workspace exists for anonymous visitors), so
// the spend counter lives in the documented key-value table instead. Logged in
// DECISIONS.md 2026-10-27 · WP-09; BACKLOG carries the schema fix.
export const FREE_TOOL_SPEND_KEY = "free_tool_spend";

export interface FreeToolSpendStore {
  /** Total USD spent today (UTC). null = store unavailable (cap not enforced). */
  spentToday(): Promise<number | null>;
  /** Add cost to today's total (creates/rolls the day entry). */
  addCost(costUsd: number): Promise<void>;
}

export const DEFAULT_DAILY_CAP_USD = 3;

export function dailyCapUsd(env: NodeJS.ProcessEnv): number {
  const raw = Number.parseFloat(env.FREE_TOOL_DAILY_USD ?? "");
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_DAILY_CAP_USD;
}

export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export interface CapStatus {
  /** true = AI is off for the rest of the day; tools use the deterministic path. */
  exceeded: boolean;
  spent: number | null;
  cap: number;
}

export async function capStatus(
  store: FreeToolSpendStore | null,
  opts?: { env?: NodeJS.ProcessEnv; now?: Date },
): Promise<CapStatus> {
  const env = opts?.env ?? process.env;
  const cap = dailyCapUsd(env);
  if (!store) return { exceeded: false, spent: null, cap };
  const spent = await store.spentToday();
  return { exceeded: spent != null && spent >= cap, spent, cap };
}

/** In-memory store for tests / DB-less previews (documented, not shared state). */
export function memorySpendStore(opts?: {
  initial?: Map<string, number>;
  now?: () => Date;
}): FreeToolSpendStore {
  const initial = opts?.initial ?? new Map<string, number>();
  const now = opts?.now ?? (() => new Date());
  return {
    async spentToday() {
      return initial.get(utcDay(now())) ?? 0;
    },
    async addCost(costUsd) {
      const day = utcDay(now());
      initial.set(day, (initial.get(day) ?? 0) + costUsd);
    },
  };
}
