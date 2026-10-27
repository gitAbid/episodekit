import { expect, test } from "@playwright/test";

/**
 * WP-02 e2e — keyless (no Clerk keys / DATABASE_URL in this environment):
 * shells render, and the invalid-RSS error path returns the exact U2 copy.
 * Sign-up → workspace in DB (U1) and valid-RSS prefill need owner keys.
 */
test.describe("WP-02 keyless shells", () => {
  test("sign-in renders the keyless fallback, not a faked provider", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByTestId("sign-in-unconfigured")).toContainText(
      "Sign in isn't set up in this preview.",
    );
  });

  test("sign-up renders the keyless fallback", async ({ page }) => {
    await page.goto("/sign-up");
    await expect(page.getByTestId("sign-up-unconfigured")).toBeVisible();
  });

  test("onboarding step 1 renders show name + optional RSS", async ({ page }) => {
    await page.goto("/app/onboarding/show");
    await expect(page.getByRole("heading", { name: "Set up your show" })).toBeVisible();
    await expect(page.getByLabel("Show name")).toBeVisible();
    await expect(page.getByTestId("prefill-rss")).toBeDisabled();
  });

  test("invalid RSS URL shows the exact U2 error copy", async ({ page }) => {
    await page.goto("/app/onboarding/show");
    await page.getByLabel("RSS URL").fill("http://127.0.0.1/feed.xml");
    await page.getByTestId("prefill-rss").click();
    await expect(page.getByTestId("rss-error")).toHaveText(
      "We couldn't read that feed. Check the URL or skip.",
    );
  });

  test("unreachable RSS URL shows the exact U2 error copy", async ({ page }) => {
    await page.goto("/app/onboarding/show");
    await page.getByLabel("RSS URL").fill("https://episodekit.invalid.example/feed.xml");
    await page.getByTestId("prefill-rss").click();
    await expect(page.getByTestId("rss-error")).toHaveText(
      "We couldn't read that feed. Check the URL or skip.",
    );
  });

  test("the API rejects a private URL with the same copy", async ({ request }) => {
    const res = await request.post("/api/rss/preview", {
      data: { url: "http://192.168.1.10/feed.xml" },
    });
    expect(res.status()).toBe(400);
    expect(await res.json()).toEqual({
      error: "We couldn't read that feed. Check the URL or skip.",
    });
  });

  test("step 2 placeholder offers skip to step 3", async ({ page }) => {
    await page.goto("/app/onboarding/voice");
    await expect(page.getByText("This page is coming soon.")).toBeVisible();
    await page.getByTestId("skip-voice").click();
    await expect(page.getByRole("heading", { name: "Add your first episode" })).toBeVisible();
  });

  test("step 3 renders the first-episode intake shell", async ({ page }) => {
    await page.goto("/app/onboarding/first");
    await expect(page.getByRole("heading", { name: "Add your first episode" })).toBeVisible();
    await expect(page.getByTestId("drop-zone")).toContainText("Drop audio or video, or browse");
  });
});
