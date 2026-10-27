import { expect, test } from "@playwright/test";

// MK-11 admin shell: keyless/locked deployments render empty states — never
// fake numbers (§0.5). All five tiles show "—" without a DB.
test("admin renders the shell with empty states when locked or keyless", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Admin");
  await expect(page.getByText("Feedback")).toBeVisible();

  // every stat tile shows the em dash (no fabricated numbers)
  const tiles = page.locator('[data-slot="stat-tile"]');
  await expect(tiles).toHaveCount(5);
  for (let i = 0; i < 5; i++) {
    await expect(tiles.nth(i)).toContainText("—");
  }

  // the AI provider card renders either the owner form or the locked copy
  await expect(page.getByText("AI provider")).toBeVisible();
});

test("admin is not indexed", async ({ page }) => {
  await page.goto("/admin");
  const robots = await page.evaluate(() => {
    const meta = document.querySelector('meta[name="robots"]');
    return meta?.getAttribute("content") ?? null;
  });
  expect(robots).toContain("noindex");
});
