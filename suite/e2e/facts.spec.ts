import { expect, test } from "@playwright/test";
import { openSeating, seedExampleWedding } from "./wedding";

/**
 * The wedding's names, venue and date are edited in one place — the Data
 * panel. Timeline and Seating each had their own fields for them, and each
 * wrote its copy back over the others.
 */
test("Timeline shows the wedding's facts and sends you to Data to change them", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/timeline");

  await expect(page.getByText("Alex & Sam", { exact: true })).toBeVisible();
  await expect(page.getByText("The Old Granary · 1 June 2028")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Couple", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Change names, date or venue" }).click();
  const data = page.getByRole("dialog", { name: "Your data" });
  await data.getByLabel("Names").fill("Robin & Kit");
  await page.keyboard.press("Escape");

  await expect(page.getByText("Robin & Kit", { exact: true })).toBeVisible();
});

test("Seating shows the wedding's names without offering to rename it", async ({ page }) => {
  await seedExampleWedding(page);
  await openSeating(page);

  await expect(page.getByText("Alex & Sam", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Alex & Sam" })).toHaveCount(0);
});
