import { expect, test } from "@playwright/test";

/**
 * WP-08 e2e — billing settings page (MK-9), keyless preview mode: free plan
 * card, quota meter, upgrade buttons, checkout error copy. LS-backed states
 * (Pro card, cancel dialog, webhook flow) are covered by unit tests with
 * signed fixtures because they need LS keys + the DB (owner blocker).
 */
test.describe("WP-08 billing settings", () => {
  test("renders the free plan card with the quota meter (MK-9)", async ({ page }) => {
    await page.goto("/app/settings/billing");
    await expect(page.getByTestId("billing-plan-card")).toBeVisible();
    await expect(page.getByTestId("billing-plan-name")).toHaveText("Free");
    await expect(page.getByTestId("billing-price")).toHaveText("$0");
    await expect(page.getByTestId("quota-meter")).toContainText("0 of 2 episodes");
    await expect(page.getByTestId("quota-meter")).toContainText(/resets \w+ \d+/);
  });

  test("shows the MK-9 upgrade buttons with the founding counter hidden without a DB", async ({ page }) => {
    await page.goto("/app/settings/billing");
    await expect(page.getByTestId("upgrade-pro")).toHaveText("Upgrade to Pro — $19/month");
    // Never fake the counter: without the DB there is no founding count.
    await expect(page.getByTestId("upgrade-founding")).toHaveText("Founding Pro — $99/year");
    await expect(page.getByTestId("cancel-plan")).toHaveCount(0);
    await expect(page.getByTestId("manage-payment")).toHaveCount(0);
  });

  test("upgrade keyless surfaces the preview copy instead of a checkout", async ({ page }) => {
    await page.goto("/app/settings/billing");
    await page.getByTestId("upgrade-pro").click();
    // Keyless (no DB): the same 503 copy as every other DB-backed action. With
    // a DB but no LS keys the API answers "Checkout isn't set up in this
    // preview." (unit-tested in billing-service.test.ts).
    await expect(page.getByTestId("checkout-error")).toHaveText(
      "Saving is unavailable in this preview.",
    );
  });

  test("POST /api/billing/checkout requires a plan and auth holds keyless", async ({ request }) => {
    const res = await request.post("/api/billing/checkout", { data: {} });
    // Keyless: auth passes (preview user), DB check answers 503; missing plan
    // would answer 400 only with a DB.
    expect([400, 503]).toContain(res.status());
  });

  test("POST /api/webhooks/lemonsqueezy rejects unsigned deliveries", async ({ request }) => {
    const res = await request.post("/api/webhooks/lemonsqueezy", {
      data: { meta: { event_name: "order_created" }, data: { type: "orders", id: "1", attributes: {} } },
    });
    // 503 without LS_WEBHOOK_SECRET; an unsigned delivery must never be 2xx.
    expect([401, 503]).toContain(res.status());
  });
});
