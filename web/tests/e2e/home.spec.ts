import { expect, test } from "@playwright/test";

// WP-00 smoke: the scaffold renders. Real user flows land with later WPs.
test("home page renders the spec positioning line", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Show notes that sound like you — and never misquote you.",
  );
  await expect(page.title()).resolves.toBe("EpisodeKit");
});
