import { defineConfig, devices } from "@playwright/test";

// Optional local override (E2E_PORT=3100) so concurrent agents on one machine
// don't fight over :3000. Default stays 3000 — CI starts its own server there.
const port = Number(process.env.E2E_PORT ?? 3000);
const baseURL = `http://localhost:${port}`;
const serverCommand =
  port === 3000 ? "pnpm exec next start" : `pnpm exec next start --port ${port}`;

// E2E database mode (E2E_DB=1): embedded Postgres (PGlite) seeded by
// scripts/e2e-seed.mjs plus the pglite-scoped auth seam (lib/auth.ts — never
// valid in production). Workspace flows ("db:" tests) run in this mode; the
// default keyless suite is unchanged.
const dbMode = process.env.E2E_DB === "1";
const E2E_ENV = {
  DATABASE_URL: "pglite:./.pglite-e2e",
  E2E_AUTH_USER_ID: "user_preview",
};

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: dbMode ? `node scripts/e2e-seed.mjs && ${serverCommand}` : serverCommand,
    url: baseURL,
    // CI starts its own server in the e2e step; locally reuse `pnpm dev` if running.
    reuseExistingServer: true,
    stdout: "ignore",
    timeout: 120_000,
    env: dbMode ? { ...E2E_ENV } : undefined,
  },
});
