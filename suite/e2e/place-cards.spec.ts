import { expect, test } from "@playwright/test";
import { seedExampleWedding, storedDocument } from "./wedding";

const elementCount = async (page: Parameters<typeof storedDocument>[0]) =>
  ((await storedDocument(page)).stationery.template.elements as unknown[]).length;

/*
 * Place cards keep no copy: a design edit is in the wedding as it is made, and
 * the header's undo — the wedding's one history — takes it back.
 */
test("something added to the card is stored at once, and the header's undo takes it back", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/place-cards");
  await expect(page.getByRole("button", { name: "+ Text" })).toBeVisible();
  const before = await elementCount(page);

  await page.getByRole("button", { name: "+ Text" }).click();
  await expect.poll(() => elementCount(page)).toBe(before + 1);

  await page.getByRole("button", { name: "Undo adding to the card" }).click();
  await expect.poll(() => elementCount(page)).toBe(before);
});
