// Drizzle-backed FreeToolSpendStore over app_settings (see cost-cap.ts for why
// this is not usage_events). The increment happens inside ONE SQL statement so
// concurrent tool calls cannot lose spend. Returns null when DATABASE_URL is
// unset (keyless preview): the cap then simply is not enforced, which is safe
// because previews have no AI keys either.
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { FREE_TOOL_SPEND_KEY, utcDay, type FreeToolSpendStore } from "./cost-cap";

export function dbSpendStore(now: Date = new Date()): FreeToolSpendStore | null {
  if (!process.env.DATABASE_URL) return null;
  const day = utcDay(now);
  return {
    async spentToday(): Promise<number | null> {
      try {
        const rows = await getDb().execute(
          sql`SELECT value->>'cost_usd' AS cost FROM app_settings WHERE key = ${FREE_TOOL_SPEND_KEY} AND value->>'day' = ${day}`,
        );
        const row = (rows as unknown as Array<{ cost: string | null }>)[0];
        if (!row || row.cost == null) return 0;
        return Number.parseFloat(row.cost) || 0;
      } catch (err) {
        console.error("[tools] spend read failed:", err);
        return null;
      }
    },
    async addCost(costUsd: number): Promise<void> {
      if (!(costUsd > 0)) return;
      try {
        await getDb().execute(sql`
          INSERT INTO app_settings (key, value)
          VALUES (${FREE_TOOL_SPEND_KEY}, jsonb_build_object('day', ${day}, 'cost_usd', ${costUsd}::numeric))
          ON CONFLICT (key) DO UPDATE SET value = CASE
            WHEN app_settings.value->>'day' = ${day}
            THEN jsonb_build_object('day', ${day}, 'cost_usd',
                 (COALESCE(NULLIF(app_settings.value->>'cost_usd','')::numeric, 0) + ${costUsd}::numeric))
            ELSE jsonb_build_object('day', ${day}, 'cost_usd', ${costUsd}::numeric)
          END
        `);
      } catch (err) {
        console.error("[tools] spend write failed:", err);
      }
    },
  };
}
