import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { LEGACY_PUBLIC_PATHS } from "@/lib/marketing/routes";

// U16 (deterministic path): a visitor with no signup pastes a transcript into
// /tools/show-notes and gets package-quality output plus the honest fallback
// note — no AI keys exist in CI/preview, so the deterministic engine answers.
const demo = readFileSync(new URL("../tests/fixtures/demo-episode.txt", import.meta.url), "utf8");

test("visitor generates show notes without signup (deterministic path)", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/tools/show-notes");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Podcast Show Notes Generator");

  const area = page.getByLabel("Paste your transcript");
  await area.fill(demo.slice(0, 6000));
  await page.getByRole("button", { name: "Generate show notes" }).click();

  const result = page.getByRole("heading", { name: "Your show notes" });
  await expect(result).toBeVisible({ timeout: 30_000 });
  // honest fallback note (no AI keys in this environment)
  await expect(page.getByText("Basic version — our AI writer was unavailable")).toBeVisible();
  // package-quality output: hook, bullets, verbatim quote, CTA
  await expect(page.getByText("In this episode")).toBeVisible();
  await expect(page.getByText("✓ Verified in transcript")).toBeVisible();

  await page.getByRole("button", { name: "Copy" }).click();
  await expect(page.getByText("Copied")).toBeVisible();

  // CTA band (MK-10)
  await expect(page.getByText("Get the full package from audio")).toBeVisible();
});

test("short pastes are rejected client-side", async ({ page }) => {
  await page.goto("/tools/show-notes");
  await page.getByLabel("Paste your transcript").fill("too short");
  await expect(page.getByRole("button", { name: "Generate show notes" })).toBeDisabled();
});

// U17 — every legacy public URL answers 200 at the same path.
test("legacy URLs keep their paths", async ({ page }) => {
  for (const path of LEGACY_PUBLIC_PATHS) {
    const res = await page.goto(path);
    expect(res?.status(), `${path} status`).toBe(200);
  }
});
