import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { seedExampleWedding } from "./wedding";

/**
 * No axe violations on any page, with a real wedding loaded so the tools draw
 * everything they can. Every rule axe runs by default, best practices
 * included: landmarks and headings are how a screen reader user finds their
 * way around, and they are what these pages got wrong.
 */
const PAGES = ["/", "/guests", "/seating", "/place-cards", "/timeline", "/delegation", "/group-shots", "/account", "/login", "/support", "/setup", "/weddings"];

for (const path of PAGES) {
  test(`${path} has no accessibility violations`, async ({ page }) => {
    await seedExampleWedding(page);
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    const { violations } = await new AxeBuilder({ page }).analyze();
    const summary = violations.map(
      (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
    );
    expect(summary).toEqual([]);
  });
}

test("the skip link is the first stop and lands on the page's main content", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});

/**
 * The pages nobody planning a wedding opens, and the surfaces that only exist
 * once something is open. `/seat` is the one page whose users did not choose
 * this software; a link to it that no longer works is still a page they see.
 */
async function noViolations(page: import("@playwright/test").Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
}

test("a guest link that does not work has no accessibility violations", async ({ page }) => {
  await page.goto("/seat/not-a-real-token#k=nothing");
  await page.waitForLoadState("networkidle");
  await noViolations(page);
});

test("an invite page has no accessibility violations", async ({ page }) => {
  await page.goto("/invite/not-a-real-token");
  await page.waitForLoadState("networkidle");
  await noViolations(page);
});

test("the Data panel, open, has no accessibility violations", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Data" }).click();
  await expect(page.getByRole("dialog", { name: "Your data" })).toBeVisible();
  await noViolations(page);
});

test("the tour, open, has no accessibility violations", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Take (a|the) tour/ }).click();
  await expect(page.getByRole("dialog", { name: /Your wedding/ })).toBeVisible();
  await noViolations(page);
});

test("the tour takes focus, keeps it, and gives it back", async ({ page }) => {
  await page.goto("/");
  const start = page.getByRole("button", { name: /Take (a|the) tour/ });
  await start.click();

  const tour = page.getByRole("dialog", { name: /Your wedding/ });
  await expect(tour.getByRole("button", { name: "Next" })).toBeFocused();

  // Tab never reaches the page behind the tour. (Past the last control it may
  // step out to the browser's own toolbar, which is the platform's business.)
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Tab");
    const behind = await page.evaluate(() => {
      const active = document.activeElement;
      return Boolean(
        active &&
          (document.querySelector("header")?.contains(active) ||
            document.getElementById("main")?.contains(active)),
      );
    });
    expect(behind).toBe(false);
  }

  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("dialog", { name: /What to do next/ })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(start).toBeFocused();
});

test("the front page of a new wedding, with setup leading, has no accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Set up your wedding" })).toBeVisible();
  await noViolations(page);
});

test("every setup step has no accessibility violations", async ({ page }) => {
  await page.goto("/setup");
  await expect(page.getByRole("heading", { name: "The two of you" })).toBeVisible();
  await noViolations(page);
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Paste names" }).click();
  await noViolations(page);
  await page.getByRole("button", { name: "Later — next" }).click();
  await noViolations(page);
  await page.getByRole("button", { name: "Save and continue" }).click();
  await noViolations(page);
});
