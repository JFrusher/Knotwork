import { expect, test } from "@playwright/test";
import { TOOLS } from "../lib/tools";
import { seedExampleWedding } from "./wedding";

/*
 * At 1024px, the narrowest width the tools support, Timeline's zoom, Fit day
 * and Present, and Delegation's "Unassigned only", once sat scrolled out of
 * sight inside the header's tool area. Every control a tool puts in the header
 * must be where it can be seen.
 */
test.describe("at 1024px", () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  // The Binder is a page for a phone, outside the planning app's header.
  for (const tool of TOOLS.filter((candidate) => candidate.id !== "binder")) {
    test(`${tool.name}'s own controls are all in view`, async ({ page }) => {
      await seedExampleWedding(page);
      await page.goto(tool.href);
      // The tool on screen, which is when it has put its controls up.
      await expect(page.locator("main [data-tour]").first()).toBeVisible();
      const area = page.locator('[data-chrome-slot="tool-actions"]').locator("..");

      const outside = await area.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return [...element.querySelectorAll("button, select, input")]
          .filter((control) => {
            const r = control.getBoundingClientRect();
            return r.width > 0 && (r.left < box.left - 1 || r.right > box.right + 1);
          })
          .map((control) => control.getAttribute("aria-label") || control.textContent?.trim());
      });
      expect(outside).toEqual([]);
    });
  }
});

test("the front page leads with the one thing to do next", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/");

  const next = page.getByRole("region", { name: "Next" });
  await expect(next.getByRole("link")).toHaveText(/3 guests have no table yet\.\s*Seat them/);
  await next.getByRole("link").click();
  await expect(page).toHaveURL(/\/seating$/);

  await page.goBack();
  const areas = page.getByRole("region", { name: "Where things stand" });
  await expect(areas.getByRole("link", { name: /Seating\s*97 of 100 seated/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Also left" })).toContainText("2 suppliers have not confirmed yet.");
});

/*
 * On a phone the tabs once shared a row with the wedding's name and the Data
 * button: 94px of 390, two and a half tabs showing and nothing to say there
 * were more. And the front page's one loud next step opened a tool that only
 * says it needs a wider screen.
 */
test.describe("at 390px", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("every tab is in view, with every tool added", async ({ page }) => {
    await seedExampleWedding(page);
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Tools" });
    await expect(nav.locator("a, button")).toHaveCount(TOOLS.length + 2);
    const outside = await nav.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return [...element.querySelectorAll("a, button")]
        .filter((tab) => {
          const r = tab.getBoundingClientRect();
          return r.left < Math.max(box.left, 0) - 1 || r.right > Math.min(box.right, window.innerWidth) + 1;
        })
        .map((tab) => tab.getAttribute("aria-label"));
    });
    expect(outside).toEqual([]);
  });

  test("a next step that needs a laptop says so, rather than opening a dead end", async ({ page }) => {
    await seedExampleWedding(page);
    await page.goto("/");
    const next = page.getByRole("region", { name: "Next" });
    await expect(next).toContainText(/3 guests have no table yet\.\s*On a laptop or tablet/);
    await expect(next.getByRole("link")).toHaveCount(0);
  });
});
