import { defineConfig, devices } from "@playwright/test";

// E2E_PORT lets parallel worktrees run e2e side by side (default 3000).
const port = Number(process.env.E2E_PORT || 3000);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `pnpm exec next start -p ${port}`,
    url: `http://localhost:${port}`,
    // CI starts its own server in the e2e step; locally reuse `pnpm dev` if running.
    reuseExistingServer: true,
    stdout: "ignore",
    timeout: 120_000,
  },
});
