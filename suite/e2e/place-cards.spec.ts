import { expect, test } from "@playwright/test";
import { seedExampleWedding, storedDocument } from "./wedding";

const elementCount = async (page: Parameters<typeof storedDocument>[0]) =>
  ((await storedDocument(page)).stationery.pieces[0].template.elements as unknown[]).length;

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

test("a second piece is designed on its own and kept in the wedding beside the first", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/place-cards");
  const pieces = page.getByRole("navigation", { name: "Pieces" });
  await expect(pieces.getByRole("tab", { name: "Place cards" })).toHaveAttribute("aria-selected", "true");
  const placeCards = await elementCount(page);

  await pieces.getByRole("button", { name: "+ New piece" }).click();
  const name = pieces.getByRole("textbox", { name: "Name of this piece" });
  await name.fill("Table numbers");
  await name.press("Enter");
  await expect(pieces.getByRole("tab", { name: "Table numbers" })).toHaveAttribute("aria-selected", "true");

  await page.getByRole("button", { name: "+ Text" }).click();
  await expect
    .poll(async () => ((await storedDocument(page)).stationery.pieces as Array<{ name: string; template: { elements: unknown[] } }>).map((p) => [p.name, p.template.elements.length]))
    .toEqual([
      ["Place cards", placeCards],
      ["Table numbers", 1],
    ]);

  await pieces.getByRole("tab", { name: "Place cards" }).click();
  await expect(pieces.getByRole("tab", { name: "Place cards" })).toHaveAttribute("aria-selected", "true");
  await page.screenshot({ path: process.env.SHOT ?? "test-results/pieces.png" });
});
