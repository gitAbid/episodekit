import { expect, test } from "@playwright/test";

// MK-1 landing: exact hero copy, pricing, founding counter, FAQ, footer.
test("landing renders the mockup hero and pricing", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Show notes that sound like you — and never misquote you.",
  );
  await expect(page.getByText("Upload an episode. Get show notes, chapters, a blog post")).toBeVisible();
  await expect(page.getByRole("link", { name: "Start free — 2 episodes/month" })).toBeVisible();
  await expect(page.getByText("No card required · Cancel anytime")).toBeVisible();

  await expect(page.getByText("Simple pricing")).toBeVisible();
  await expect(page.getByText("$19", { exact: false })).toBeVisible();
  await expect(page.getByText(/of 100 left/)).toBeVisible();
  await expect(page.getByText("A PeraByte AI product")).toBeVisible();
});

test("FAQ renders six questions", async ({ page }) => {
  await page.goto("/");
  const summaries = page.locator("details > summary");
  await expect(summaries).toHaveCount(6);
});

test("pricing page renders the three plans", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pricing");
  await expect(page.getByText("10 episodes a month").first()).toBeVisible();
  await expect(page.getByText(/Founding Pro/)).toBeVisible();
});
