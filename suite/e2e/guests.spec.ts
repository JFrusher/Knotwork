import { expect, test } from "@playwright/test";
import { openSeating, seedExampleWedding } from "./wedding";

/**
 * A dietary requirement means the same thing in every tool.
 *
 * The Data panel's importer stored what the file said ("Vegetarian", "None")
 * where Seating expected a key ("vegetarian"). The example wedding has
 * thirteen vegetarians, and Seating's Vegetarian filter found none of them —
 * while its dietary breakdown listed "None" as a diet.
 */
test("Seating's dietary filter finds the vegetarians the Data panel imported", async ({ page }) => {
  await seedExampleWedding(page);
  await openSeating(page);

  await page.getByRole("button", { name: "Vegetarian", exact: true }).click();
  // Thirteen in the example; one by name is enough to prove the filter sees
  // them. Both people named here are in no family or group, so they are
  // listed directly — a family member sits in a folded family block, where
  // "not shown" would prove nothing.
  // A card is named for the guest, with ", no table" while they have none.
  await expect(page.getByRole("button", { name: /^Ines MacIntyre(, no table)?$/ })).toBeVisible();
  // And someone whose answer was "None" is not among them.
  await expect(page.getByRole("button", { name: /^Devendra Raghunathan(, no table)?$/ })).toHaveCount(0);
});

test("nobody's diet is None", async ({ page }) => {
  await seedExampleWedding(page);
  await openSeating(page);
  await expect(page.getByRole("complementary", { name: "Details" }).getByText("None", { exact: true })).toHaveCount(0);
});

/**
 * One importer, from wherever it is opened. Seating had its own, with its own
 * rules; its button now opens this one. The preview says what will change, and
 * nobody leaves the list unless they are ticked.
 */
test("Seating's import is the one importer, and removes only who is ticked", async ({ page }) => {
  await seedExampleWedding(page);
  await openSeating(page);

  await page.getByRole("button", { name: "Import guests" }).first().click();
  const importer = page.getByRole("dialog", { name: "Import guests" });
  await importer.getByLabel("Guest list CSV").setInputFiles({
    name: "update.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Name,Dietary\nBeatrix Lindqvist,Vegan\nZelda Newcomer,\n"),
  });
  await importer.getByRole("button", { name: "See what will change" }).click();

  await expect(importer.getByText("1 new, 1 updated, 0 unchanged. Nobody is unseated.")).toBeVisible();
  const missing = importer.getByRole("group", { name: /On your list, not in this file \(105\)/ });
  await missing.getByLabel("Devendra Raghunathan").check();
  await importer.getByRole("button", { name: "Import", exact: true }).click();
  await expect(importer.getByText("Imported: 1 new, 1 updated, 1 removed.")).toBeVisible();
  await importer.getByRole("button", { name: "Done" }).click();

  // 106, one in, one out — and Seating shows it without a reload.
  await expect(page.getByTitle(/guests on this device$/)).toHaveText("106");
  await expect(page.getByRole("button", { name: "Zelda Newcomer, no table" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Devendra Raghunathan(, no table)?$/ })).toHaveCount(0);
});
