import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm exec next start",
    url: "http://localhost:3000",
    // CI starts its own server in the e2e step; locally reuse `pnpm dev` if running.
    reuseExistingServer: true,
    stdout: "ignore",
    timeout: 120_000,
  },
});
