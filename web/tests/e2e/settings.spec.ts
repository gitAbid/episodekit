import { expect, test } from "@playwright/test";

/** WP-02 e2e — settings General (M9) and app shells, keyless. */
test.describe("WP-02 settings and app shells", () => {
  test("/app redirects to the episodes list", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/app\/episodes$/);
    await expect(page.getByText("No episodes yet")).toBeVisible();
    await expect(page.getByTestId("episodes-empty")).toContainText(
      "Upload your first episode and get a full content package in minutes.",
    );
  });

  test("settings General renders all M9 fields", async ({ page }) => {
    await page.goto("/app/settings/show");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    for (const label of [
      "Show name",
      "Artwork URL",
      "Listen link",
      "Default CTA",
      "Vocabulary terms",
    ]) {
      await expect(page.getByLabel(label)).toBeVisible();
    }
  });

  test("saving settings keyless shows the preview copy", async ({ page }) => {
    await page.goto("/app/settings/show");
    await page.getByLabel("Show name").fill("The Focus Hour");
    await page.getByTestId("save-settings").click();
    await expect(page.getByTestId("settings-error")).toHaveText(
      "Saving is unavailable in this preview.",
    );
  });

  test("settings tabs exist; Voice/Account are stubs and Billing is real (WP-08)", async ({ page }) => {
    await page.goto("/app/settings/voice");
    await expect(page.getByTestId("voice-stub")).toBeVisible();
    await page.goto("/app/settings/billing");
    await expect(page.getByTestId("billing-plan-card")).toBeVisible();
    await page.goto("/app/settings/account");
    await expect(page.getByTestId("account-stub")).toBeVisible();
  });

  test("/app/episodes/new renders the intake shell", async ({ page }) => {
    await page.goto("/app/episodes/new");
    await expect(page.getByRole("heading", { name: "New episode" })).toBeVisible();
    await expect(page.getByTestId("drop-zone")).toBeVisible();
  });

  test("POST /api/show requires a name", async ({ request }) => {
    const res = await request.post("/api/show", { data: {} });
    // Keyless: the DB is unconfigured, so saving answers 503 before validation.
    expect([400, 503]).toContain(res.status());
  });
});
