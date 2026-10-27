// Server-side resolution of the app_settings store. WP-02's Drizzle schema
// (`app_settings`: key text pk, value jsonb) is the persistence; DATABASE_URL
// unset (keyless preview) → null, so GET serves the env/default view and PUT
// reports 503 settings_store_unavailable. Generation reads env/defaults.
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { appSettings } from "@/db/schema";
import type { AppSettingsStore } from "./settings";

export function resolveAppSettingsStore(): AppSettingsStore | null {
  if (!process.env.DATABASE_URL) return null;
  return {
    async get(key: string): Promise<unknown | null> {
      const rows = await getDb()
        .select({ value: appSettings.value })
        .from(appSettings)
        .where(eq(appSettings.key, key))
        .limit(1);
      return rows[0]?.value ?? null;
    },
    async put(key: string, value: unknown): Promise<void> {
      await getDb()
        .insert(appSettings)
        .values({ key, value })
        .onConflictDoUpdate({ target: appSettings.key, set: { value } });
    },
  };
}
