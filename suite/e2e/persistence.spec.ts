import { expect, test } from "@playwright/test";
import { openSeating, seedExampleWedding } from "./wedding";

/**
 * An edit shown on screen is an edit that survives a reload. Seating once
 * handed its plan over every 30 seconds and the store wrote it from a timer
 * that never fired during unload, so a rename followed by a reload vanished.
 */
test("a Seating edit survives an immediate reload", async ({ page }) => {
  await seedExampleWedding(page);
  await openSeating(page);

  await page.getByRole("button", { name: /^Table 1, / }).click();
  await page.getByLabel("Table name").fill("Top table");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: /^Top table, / })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: /^Top table, / })).toBeVisible();
});
