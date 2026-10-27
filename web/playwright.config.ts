import { defineConfig, devices } from "@playwright/test";

// Optional local override (E2E_PORT=3100) so concurrent agents on one machine
// don't fight over :3000. Default stays 3000 — CI starts its own server there.
const port = Number(process.env.E2E_PORT ?? 3000);
const baseURL = `http://localhost:${port}`;
const serverCommand =
  port === 3000 ? "pnpm exec next start" : `pnpm exec next start --port ${port}`;

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
    command: serverCommand,
    url: baseURL,
    // CI starts its own server in the e2e step; locally reuse `pnpm dev` if running.
    reuseExistingServer: true,
    stdout: "ignore",
    timeout: 120_000,
  },
});
