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
  await data.getByLabel("One of you").fill("Robin");
  await data.getByLabel("The other").fill("Kit");
  await page.keyboard.press("Escape");

  await expect(page.getByText("Robin & Kit", { exact: true })).toBeVisible();
});

test("Seating shows the wedding's names without offering to rename it", async ({ page }) => {
  await seedExampleWedding(page);
  await openSeating(page);

  await expect(page.getByText("Alex & Sam", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Alex & Sam" })).toHaveCount(0);
});

/**
 * Sides and group shots are named after the partners — the example wedding is
 * Alex and Sam, and "Bride's" and "Groom's" fitted neither of them.
 */
test("sides and group shots are named after the partners", async ({ page }) => {
  await seedExampleWedding(page);
  await openSeating(page);
  await expect(page.getByRole("button", { name: "Alex’s", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sam’s", exact: true })).toBeVisible();
  await expect(page.getByText(/Bride|Groom/)).toHaveCount(0);

  // Renamed in one place, renamed everywhere.
  await page.getByRole("button", { name: "Data" }).click();
  await page.getByRole("dialog", { name: "Your data" }).getByLabel("The other").fill("Samira");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Samira’s", exact: true })).toBeVisible();

  await page.goto("/group-shots");
  await page.getByRole("button", { name: "Seed the classic list" }).click();
  // Section names are editable, so they are the value of a field.
  await expect
    .poll(() => page.locator("input").evaluateAll((fields) => fields.map((f) => (f as HTMLInputElement).value)))
    .toContain("Alex’s family");
  await expect(page.getByText("Samira with their parents")).toBeVisible();
  await expect(page.getByText(/bride|groom/i)).toHaveCount(0);
});
