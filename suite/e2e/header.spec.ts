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

  for (const tool of TOOLS) {
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
