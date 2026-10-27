import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// WP-01 acceptance: every §5.3 component renders light and dark with
// 0 axe violations. The /dev/components gallery renders all of them; the
// overlay components are scanned in their open state (their content lives
// in a portal that only exists while open).

const PAGE = "/dev/components";

async function expectNoViolations(page: Page, when: string, scope?: string) {
  // Let open/fade transitions finish, otherwise axe samples blended
  // mid-animation colors and reports bogus contrast values.
  await page.waitForTimeout(300);
  let builder = new AxeBuilder({ page });
  if (scope) builder = builder.include(scope);
  const results = await builder.analyze();
  const summary = results.violations
    .map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.target.join(" ")}`)
    .join("; ");
  expect(results.violations, `${when}: ${summary}`).toEqual([]);
}

test.describe("light mode", () => {
  test("gallery has no axe violations", async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Components",
    );
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
    await expectNoViolations(page, "light");
  });
});

test.describe("dark mode", () => {
  test.use({ colorScheme: "dark" });

  test("gallery has no axe violations", async ({ page }) => {
    await page.goto(PAGE);
    // §5.2 dark tokens actually apply under prefers-color-scheme: dark.
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      "rgb(14, 17, 22)",
    );
    await expectNoViolations(page, "dark");
  });
});

test("overlay components have no axe violations while open", async ({
  page,
}) => {
  // Five open/scan/close cycles plus axe analysis blow past the 30s default.
  test.setTimeout(120_000);
  await page.goto(PAGE);

  // First interaction: retry until the app is hydrated and Radix responds.
  const openDialog = page.getByRole("button", { name: "Open dialog" });
  await expect(async () => {
    await openDialog.click();
    await expect(page.getByRole("dialog")).toBeVisible();
  }).toPass({ timeout: 15_000 });
  await expectNoViolations(page, "dialog open");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.getByRole("button", { name: "Open sheet" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectNoViolations(page, "sheet open");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.getByRole("button", { name: "Open popover" }).click();
  await expect(page.getByText("Exact words from the audio")).toBeVisible();
  await expectNoViolations(page, "popover open");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("menuitem", { name: "Shorter" })).toBeVisible();
  // Radix renders this menu modal: the entire background is aria-hidden
  // while focus is trapped in the menu, which makes axe flag hidden-but-
  // focusable background nodes and the page-level heading/region rules.
  // Those are artifacts of the modal pattern, so scan the open portal.
  await expectNoViolations(page, "dropdown menu open", "[data-radix-popper-content-wrapper]");
  await page.keyboard.press("Escape");

  // Radix tooltips open on focus, which is how keyboard users reach them.
  // The tooltip is portaled outside <main>, so scan the portal (the same
  // landmark artifact as the menu above).
  await page.getByRole("button", { name: "Download all" }).focus();
  await expect(page.getByText("Download all artifacts")).toBeVisible();
  await expectNoViolations(page, "tooltip open", "[data-radix-popper-content-wrapper]");
});
