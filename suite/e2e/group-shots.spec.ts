import { expect, test } from "@playwright/test";
import { seedExampleWedding } from "./wedding";

/*
 * The example wedding is a `.knotwork.json` export made before the folders
 * were named after the tool. Its shot list opens as it was saved.
 */
test("a wedding exported before the rename opens with its shot list", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/group-shots");
  await expect(page.getByText("The couple, alone")).toBeVisible();
  await expect(page.getByText("Alex with their parents")).toBeVisible();
});
