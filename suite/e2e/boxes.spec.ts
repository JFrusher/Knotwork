import { expect, test } from "@playwright/test";
import { seedExampleWedding, storedDocument } from "./wedding";

type StoredBox = { id: string; items: Array<{ id: string; label: string; packed: boolean }> };
const stored = async (page: Parameters<typeof storedDocument>[0], boxId: string) =>
  ((await storedDocument(page)).boxes?.boxes as StoredBox[]).find((box) => box.id === boxId)!;

/*
 * Boxes keeps no copy: a tick is in the wedding when it is made, and the
 * header's undo takes it back. Where a box has to be, and by when, is the
 * Timeline's.
 */
test("shoes are found in their box, which says where it has to be and by when", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/boxes");
  const list = page.getByRole("list", { name: "The boxes" });
  await expect(list.getByRole("listitem")).toHaveCount(4);
  await expect(list.getByRole("listitem").nth(1)).toContainText("The suite, by 08:00");

  await page.getByRole("textbox", { name: "Find something" }).fill("shoes");
  await page.getByRole("list", { name: "Found" }).getByRole("button", { name: /Shoes\s*In box 2, Getting ready/ }).click();
  await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue("Getting ready");
});

test("a thing ticked as packed is stored, and undo takes the tick back", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/boxes");
  await page.getByRole("list", { name: "The boxes" }).getByRole("button", { name: /^2\. Getting ready/ }).click();

  await page.getByRole("checkbox", { name: "Steamer is packed" }).check();
  await expect.poll(async () => (await stored(page, "box-getting-ready")).items.find((item) => item.label === "Steamer")?.packed).toBe(true);

  await page.getByRole("button", { name: "Undo packing" }).click();
  await expect(page.getByRole("checkbox", { name: "Steamer is packed" })).not.toBeChecked();
});

test("a thing moved to another box goes, and lands at the end of it", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/boxes");
  await page.getByRole("list", { name: "The boxes" }).getByRole("button", { name: /^2\. Getting ready/ }).click();

  await page.getByRole("combobox", { name: "Move Steamer to another box" }).selectOption({ label: "Box 4 — Overnight and the day after" });
  await expect
    .poll(async () => (await stored(page, "box-overnight")).items.map((item) => item.label))
    .toEqual(["Clothes for the day after", "Toiletries", "Passports and travel documents", "Steamer"]);
  expect((await stored(page, "box-getting-ready")).items.map((item) => item.label)).not.toContain("Steamer");
});

test("a new wedding adds Boxes from Tools and starts from the usual ones", async ({ page }) => {
  await page.goto("/");
  const tabs = page.getByRole("navigation", { name: "Tools" });
  await tabs.getByRole("button", { name: "Add or remove tools" }).click();
  await page.getByRole("dialog", { name: "Tools" }).getByRole("button", { name: "Add Boxes" }).click();
  await page.keyboard.press("Escape");
  await tabs.getByRole("link", { name: "Boxes" }).click();

  await page.getByRole("button", { name: "Add the usual boxes" }).click();
  await expect(page.getByRole("list", { name: "The boxes" }).getByRole("listitem")).toHaveText([
    /1\. The rings and the paperwork/,
    /2\. Getting ready/,
    /3\. The day's odds and ends/,
    /4\. Overnight and the day after/,
  ]);
  await expect(page.getByRole("button", { name: "Add the usual boxes" })).toHaveCount(0);
});
