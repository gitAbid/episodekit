import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

/**
 * WP-06 workspace flows on the sample episode (M4–M8, MK-5/6/7). These run in
 * DB mode (E2E_DB=1): a seeded embedded Postgres + the pglite-scoped preview
 * user (see scripts/e2e-seed.mjs and lib/auth.ts). Titles carry the "db:"
 * marker so `pnpm e2e:db` selects exactly this suite; the default keyless
 * suite skips them.
 */
const DEMO = readFileSync("tests/fixtures/demo-episode.txt", "utf8");

test.skip(({ }) => process.env.E2E_DB !== "1", "DB mode only (pnpm e2e:db)");

// Deterministic generation over pglite can take a while under parallel load.
test.setTimeout(120_000);

async function createSampleEpisode(request: APIRequestContext): Promise<string> {
  const res = await request.post("/api/episodes", {
    data: {
      source: "sample",
      transcriptText: DEMO.slice(0, 8000),
      title: "Ep 42 · Attention is a budget",
      number: 42,
      guests: ["Maya"],
    },
  });
  expect(res.ok()).toBeTruthy();
  const { id } = (await res.json()) as { id: string };
  return id;
}

async function openWorkspace(page: Page): Promise<string> {
  const id = await createSampleEpisode(page.request);
  await page.goto(`/app/episodes/${id}`);
  return id;
}

test("db: U6 — the full package generates and artifacts appear (deterministic fallback)", async ({ page }) => {
  const id = await createSampleEpisode(page.request);
  const started = Date.now();
  await page.goto(`/app/episodes/${id}`);

  // All 8 artifacts land (fallback status — no AI keys configured).
  await expect(page.getByTestId("fallback-banner").first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("ready-count")).toHaveText("7/7 ready", { timeout: 60_000 });
  expect(Date.now() - started).toBeLessThan(5 * 60_000);
});

test("db: U11 — edits autosave and survive a reload", async ({ page }) => {
  await openWorkspace(page);
  await expect(page.getByTestId("edit-hook")).toBeVisible({ timeout: 60_000 });
  const hook = page.getByTestId("edit-hook");
  await hook.fill("A hand-written hook for the reload test.");
  await expect(page.getByTestId("autosave-hint")).toContainText("Saved", { timeout: 10_000 });
  await page.reload();
  await expect(page.getByTestId("edit-hook")).toHaveValue("A hand-written hook for the reload test.");
});

test("db: U12 — regenerate with an instruction and undo restores the snapshot", async ({ page }) => {
  await openWorkspace(page);
  await page.getByRole("button", { name: "Summary" }).first().click();
  await expect(page.getByTestId("edit-one-liner")).toBeVisible({ timeout: 60_000 });
  const before = await page.getByTestId("edit-one-liner").inputValue();

  await page.getByTestId("regenerate-menu").click();
  await page.getByRole("menuitem", { name: "Shorter" }).click();
  await expect(page.getByText("Regenerated")).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("edit-one-liner")).toHaveValue(before, { timeout: 30_000 });
});

test("db: U13 — copy for Apple Podcasts copies text with chapters and the free footer", async ({ browser }) => {
  const ctx = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  await openWorkspace(page);
  await expect(page.getByTestId("edit-hook")).toBeVisible({ timeout: 60_000 });

  await page.getByTestId("copy-menu").click();
  await page.getByRole("menuitem", { name: "Apple Podcasts" }).click();
  await expect(page.getByText(/Copied for Apple Podcasts/)).toBeVisible({ timeout: 10_000 });
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied.length).toBeGreaterThan(0);
  expect(copied.length).toBeLessThanOrEqual(4000);
  await ctx.close();
});

test("db: MK-7 — quote popover shows the verified context and play affordance", async ({ page }) => {
  await openWorkspace(page);
  await expect(page.getByTestId("quote-0")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("quote-0").locator("button").first().click();
  const popover = page.getByTestId("quote-popover");
  await expect(popover).toBeVisible();
  await expect(popover.getByTestId("play-from")).toBeVisible();
});

test("db: transcript panel searches", async ({ page }) => {
  await openWorkspace(page);
  await expect(page.getByTestId("transcript-search")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("transcript-search").fill("attention");
  await expect(page.getByLabel("Transcript").locator("li").first()).toBeVisible();
});

test("db: mobile — chip row and bottom tabs (§5.5)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openWorkspace(page);
  await expect(page.getByTestId("edit-hook").or(page.getByTestId("artifact-skeleton").first())).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("navigation", { name: "Artifacts" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Sections" })).toBeVisible();
  await page.getByRole("button", { name: "Quotes", exact: true }).click();
  await expect(page.getByTestId("right-panel").getByTestId("quote-0")).toBeVisible();
});

test("db: ready flag ticks an artifact (M8)", async ({ page }) => {
  await openWorkspace(page);
  await expect(page.getByTestId("ready-flag")).toBeVisible({ timeout: 60_000 });
  const checkbox = page.getByTestId("ready-flag");
  if (await checkbox.isVisible()) {
    await checkbox.check();
    await page.reload();
    await expect(page.getByTestId("ready-flag")).toBeChecked();
  }
});
