// Server-side resolution of the app_settings store (documented WP-02 seam).
// WP-02's Drizzle schema (§7.1 `app_settings`) will return a real store here;
// until then the admin routes get `null`: GET serves the env/default view,
// PUT reports 503 settings_store_unavailable. Generation reads env/defaults.
import type { AppSettingsStore } from "./settings";

export function resolveAppSettingsStore(): AppSettingsStore | null {
  // TODO(WP-02): return the Drizzle-backed store when DATABASE_URL is wired.
  return null;
}
