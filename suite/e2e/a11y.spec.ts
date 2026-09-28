import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { seedExampleWedding } from "./wedding";

/**
 * No axe violations on any page, with a real wedding loaded so the tools draw
 * everything they can. Every rule axe runs by default, best practices
 * included: landmarks and headings are how a screen reader user finds their
 * way around, and they are what these pages got wrong.
 */
const PAGES = ["/", "/seating", "/place-cards", "/timeline", "/delegation", "/group-shots", "/account", "/login"];

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
