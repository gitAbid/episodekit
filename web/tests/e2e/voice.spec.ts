import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

/**
 * WP-07 e2e — voice onboarding step 2 (U3, MK-2) and Settings → Voice
 * (M9, MK-8), keyless: no AI keys and no DATABASE_URL, so "Learn my voice"
 * runs the deterministic lib/ai path and answers are labelled; saving reports
 * the preview copy instead of faking a write.
 */
// Playwright runs from web/ (playwright.config.ts location).
const voiceSample = readFileSync(join(process.cwd(), "tests/fixtures/voice-sample.txt"), "utf8");

test.describe("WP-07 onboarding step 2 (U3)", () => {
  test("learn flow: paste sample → Learn → chips/sliders → Continue → step 3", async ({ page }) => {
    await page.goto("/app/onboarding/voice");
    await page.getByLabel("Example 1").fill(voiceSample);
    await expect(page.getByTestId("sample-counter-0")).toContainText("170 words · at least 150");
    await expect(page.getByTestId("learn-voice")).toBeEnabled();

    await page.getByTestId("learn-voice").click();

    // U3: chips + sliders appear within 15 s (deterministic path is instant here).
    await expect(page.getByRole("heading", { name: "Here's your voice" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("tone-chips")).toBeVisible();
    // Deterministic learn keeps the §7.4 tone trio; person is derived from the fixture ("I").
    await expect(page.getByTestId("tone-chip-clear")).toBeVisible();
    await expect(page.getByTestId("tone-chip-warm")).toBeVisible();
    await expect(page.getByTestId("tone-chip-curious")).toBeVisible();
    await expect(page.getByTestId("slider-formality")).toBeVisible();
    await expect(page.getByTestId("slider-energy")).toBeVisible();
    await expect(page.getByTestId("slider-humor")).toBeVisible();
    await expect(page.getByTestId("seg-person-I")).toHaveAttribute("aria-checked", "true");
    // Honest labelling: no AI keys exist here, so this was NOT a learned AI profile.
    await expect(page.getByTestId("voice-note")).toContainText("Basic profile");
    await expect(page.getByTestId("voice-saved-note")).toContainText(
      "Saving is unavailable in this preview.",
    );
    // MK-2 shows a preview in the after-learning card, rendered from the profile.
    await expect(page.getByTestId("preview-text")).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("continue-voice").click();
    await expect(page.getByRole("heading", { name: "Add your first episode" })).toBeVisible();
  });

  test("an under-150-word sample keeps Learn disabled with the hint", async ({ page }) => {
    await page.goto("/app/onboarding/voice");
    await page.getByLabel("Example 1").fill("Too short by far.");
    await expect(page.getByTestId("sample-counter-0")).toContainText("4 words · at least 150");
    await expect(page.getByTestId("learn-voice")).toBeDisabled();
    await expect(page.getByTestId("voice-min-hint")).toHaveText(
      "Each example needs at least 150 words.",
    );
  });

  test("a second example can be added up to three", async ({ page }) => {
    await page.goto("/app/onboarding/voice");
    await expect(page.getByLabel("Example 1")).toBeVisible();
    await page.getByTestId("add-sample-0").click();
    await expect(page.getByLabel("Example 2")).toBeVisible();
    await page.getByTestId("add-sample-1").click();
    await expect(page.getByLabel("Example 3")).toBeVisible();
    await expect(page.getByTestId("add-sample-2")).toHaveCount(0);
  });

  test("tone chips are removable and the editor gates Continue on three tones", async ({ page }) => {
    await page.goto("/app/onboarding/voice");
    await page.getByLabel("Example 1").fill(voiceSample);
    await page.getByTestId("learn-voice").click();
    await expect(page.getByTestId("tone-chips")).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("tone-remove-clear").click();
    await expect(page.getByTestId("tone-hint")).toHaveText("Add a tone word.");
    await expect(page.getByTestId("continue-voice")).toBeDisabled();
    await page.getByTestId("tone-add").click();
    await page.getByLabel("New tone term").fill("wry");
    await page.getByLabel("New tone term").press("Enter");
    await expect(page.getByTestId("tone-chip-wry")).toBeVisible();
    await expect(page.getByTestId("tone-hint")).toHaveCount(0);
    await expect(page.getByTestId("continue-voice")).toBeEnabled();
  });

  test("skip for now lands on step 3 without learning", async ({ page }) => {
    await page.goto("/app/onboarding/voice");
    await page.getByTestId("skip-voice").click();
    await expect(page.getByRole("heading", { name: "Add your first episode" })).toBeVisible();
  });
});

test.describe("WP-07 settings → Voice (M9, MK-8)", () => {
  test("default §7.4 profile renders keyless with preview and samples block", async ({ page }) => {
    await page.goto("/app/settings/voice");
    await expect(page.getByTestId("tone-chip-clear")).toBeVisible();
    await expect(page.getByTestId("tone-chip-warm")).toBeVisible();
    await expect(page.getByTestId("tone-chip-curious")).toBeVisible();
    await expect(page.getByTestId("slider-humor")).toBeVisible();
    await expect(page.getByTestId("seg-person-we")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("seg-emoji-none")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("seg-sentencelength-medium")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(page.getByTestId("never-say-chip-delve")).toBeVisible();
    await expect(page.getByTestId("always-include-chips")).toBeVisible();
    await expect(page.getByTestId("voice-samples")).toBeVisible();

    // Preview renders from the profile (deterministic keyless) and is labelled.
    await expect(page.getByTestId("preview-text")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("preview-note")).toContainText("Basic version");
  });

  test("Update preview re-renders; Save keyless shows the preview copy", async ({ page }) => {
    await page.goto("/app/settings/voice");
    await expect(page.getByTestId("preview-text")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("preview-update").click();
    await expect(page.getByTestId("preview-text")).toBeVisible();

    await page.getByTestId("save-voice").click();
    await expect(page.getByTestId("voice-error")).toHaveText(
      "Saving is unavailable in this preview.",
    );
  });

  test("adding a sample requires 150 words; remove works", async ({ page }) => {
    await page.goto("/app/settings/voice");
    await page.getByTestId("add-sample").click();
    await page.getByTestId("new-voice-sample").fill("Not nearly long enough yet.");
    await expect(page.getByTestId("confirm-add-sample")).toBeDisabled();
    await page.getByTestId("new-voice-sample").fill(voiceSample);
    await expect(page.getByTestId("confirm-add-sample")).toBeEnabled();
    await page.getByTestId("confirm-add-sample").click();
    await expect(page.getByTestId("voice-sample-row-0")).toContainText("170 words");
    await page.getByTestId("remove-sample-0").click();
    await expect(page.getByTestId("voice-sample-row-0")).toHaveCount(0);
  });
});
