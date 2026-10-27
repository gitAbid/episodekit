import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

/**
 * WP-05 e2e — keyless (no Clerk keys / DATABASE_URL / BLOB token here):
 * MK-4 intake renders; the U5 chip appears for a pasted Riverside transcript;
 * the sample button fills the paste tab; U4/U19 resume-status paths render
 * from the server status read path (network-intercepted — the real DB-backed
 * status route is covered by unit tests at the @/db/queries boundary).
 */

const riverside = [
  "Maya (00:00:00): Welcome back to the show. Today we talk about focus.",
  "Dev (00:00:12): Glad to be here. Focus is the most expensive resource in modern work.",
  "Maya (00:01:03): We budget our dollars, we calendar our hours.",
].join("\n");

test("/app/episodes/new renders the MK-4 intake: tabs, drop zone, details", async ({ page }) => {
  await page.goto("/app/episodes/new");
  await expect(page.getByRole("heading", { name: "New episode" })).toBeVisible();
  await expect(page.getByTestId("tab-upload")).toContainText("Upload audio");
  await expect(page.getByTestId("tab-paste")).toContainText("Paste transcript");
  await expect(page.getByTestId("drop-zone")).toContainText("Drop audio or video, or browse");
  await expect(page.getByTestId("drop-zone")).toContainText("up to 2 hours");
  await expect(page.getByTestId("sample-button")).toBeVisible();
  await expect(page.getByTestId("episode-title")).toBeVisible();
  await expect(page.getByTestId("add-guest")).toBeVisible();
  await expect(page.getByTestId("create-button")).toBeDisabled();
});

test("U5: pasting a Riverside transcript shows the exact format chip", async ({ page }) => {
  await page.goto("/app/episodes/new");
  await page.getByTestId("tab-paste").click();
  await page.getByTestId("paste-textarea").fill(riverside);
  await expect(page.getByTestId("format-chip")).toHaveText(
    "Riverside · speakers and timestamps found",
  );
});

test("paste tab chip reflects plain text and SRT variants", async ({ page }) => {
  await page.goto("/app/episodes/new");
  await page.getByTestId("tab-paste").click();
  await page.getByTestId("paste-textarea").fill("Just a plain paragraph about focus.\n\nAnother one.");
  await expect(page.getByTestId("format-chip")).toHaveText("Plain text");

  await page.getByTestId("paste-textarea").fill(
    ["1", "00:00:00,000 --> 00:00:04,000", "Hello there.", ""].join("\n"),
  );
  await expect(page.getByTestId("format-chip")).toHaveText("SRT · timestamps found");
});

test("'Try with a sample episode' fills the paste tab and marks the free sample", async ({ page }) => {
  await page.goto("/app/episodes/new");
  await page.getByTestId("sample-button").click();
  const sample = readFileSync(join(process.cwd(), "public/samples/demo-episode.txt"), "utf8");
  await expect(page.getByTestId("paste-textarea")).toHaveValue(sample); // raw bytes incl. trailing newline
  await expect(page.getByTestId("format-chip")).toHaveText("Plain text");
  await expect(page.getByText("The sample is free")).toBeVisible();
});

test("U4: ?id= resumes from server status (transcribing)", async ({ page }) => {
  await page.route("**/api/episodes/ep-test-1", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        episode: {
          id: "ep-test-1",
          title: "Ep 42",
          number: 42,
          source: "upload",
          status: "transcribing",
          errorCode: null,
          durationMs: null,
          hasTimestamps: false,
          hasSpeakers: false,
          countsQuota: true,
        },
      }),
    });
  });
  await page.goto("/app/episodes/new?id=ep-test-1");
  await expect(page.getByTestId("status-pill")).toContainText("Transcribing");
});

test("U19: failed unsupported-language episode shows the exact copy", async ({ page }) => {
  await page.route("**/api/episodes/ep-test-2", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        episode: {
          id: "ep-test-2",
          title: null,
          number: null,
          source: "upload",
          status: "failed",
          errorCode: "unsupported_language",
          durationMs: null,
          hasTimestamps: false,
          hasSpeakers: false,
          countsQuota: false,
        },
      }),
    });
  });
  await page.goto("/app/episodes/new?id=ep-test-2");
  await expect(page.getByTestId("status-pill")).toContainText("Failed");
  await expect(page.getByTestId("status-error")).toHaveText(
    "EpisodeKit works with English episodes for now. This one wasn't charged.",
  );
});

test("non-audio file selection shows the type error", async ({ page }) => {
  await page.goto("/app/episodes/new");
  await page.getByTestId("file-input").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not audio"),
  });
  await expect(page.getByTestId("intake-error")).toContainText("That file type isn't supported");
});
