import { expect, test, type Page } from "@playwright/test";
import { openSeating, seedExampleWedding, unassignedCount } from "./wedding";

test.beforeEach(async ({ page }) => {
  await seedExampleWedding(page);
  await openSeating(page);
});

const tables = (page: Page) => page.getByRole("button", { name: / seats taken$/ });
const palette = (page: Page) => page.getByRole("group", { name: "Add a table" });

/** Tab until `name` has focus. Fails rather than looping for ever. */
async function tabTo(page: Page, name: RegExp): Promise<void> {
  for (let i = 0; i < 400; i++) {
    await page.keyboard.press("Tab");
    const label = await page.evaluate(() => {
      const el = document.activeElement;
      return el?.getAttribute("aria-label") ?? el?.textContent?.trim() ?? "";
    });
    if (name.test(label)) return;
  }
  throw new Error(`Tab never reached ${name}`);
}

test.describe("from the keyboard", () => {
  test("Enter on a palette item adds that table", async ({ page }) => {
    const before = await tables(page).count();
    await tabTo(page, /^Round$/);
    await page.keyboard.press("Enter");
    await expect(tables(page)).toHaveCount(before + 1);
    await expect(page.getByLabel("Table name")).toBeVisible();
  });

  test("a table can be reached, opened and moved", async ({ page }) => {
    await tabTo(page, /^Table 1, /);
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Table name")).toHaveValue("Table 1");

    const table = page.getByRole("button", { name: /^Table 1, / });
    const before = (await table.boundingBox())!.x;
    await table.focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(async () => (await table.boundingBox())!.x).toBeGreaterThan(before);
  });

  test("a guest can be opened and seated", async ({ page }) => {
    const before = await unassignedCount(page);
    await tabTo(page, /^Alexander Dubois/);
    await page.keyboard.press("Enter");
    const seat = page.getByLabel("Seat at table");
    await seat.selectOption({ index: 1 });
    await expect.poll(() => unassignedCount(page)).toBe(before - 1);
  });
});

test.describe("with a pointer", () => {
  /** Press, move in steps past the drag threshold, release. */
  async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= 20; i++) {
      await page.mouse.move(from.x + ((to.x - from.x) * i) / 20, from.y + ((to.y - from.y) * i) / 20);
    }
    await page.mouse.up();
  }

  async function guestHandle(page: Page) {
    const box = (await page.getByRole("button", { name: /^Alexander Dubois/ }).boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  // The drop target once sat half a table down and to the right of the table
  // drawn, so the top-left half missed and the floor beside it caught drops.
  test("a guest dropped on the top-left of a table is seated at it", async ({ page }) => {
    const box = (await page.getByRole("button", { name: /^Table 2, / }).boundingBox())!;
    const before = await unassignedCount(page);
    await drag(page, await guestHandle(page), { x: box.x + box.width * 0.35, y: box.y + box.height * 0.35 });
    await expect.poll(() => unassignedCount(page)).toBe(before - 1);
  });

  test("a guest dropped on the floor beside a table is not seated", async ({ page }) => {
    const box = (await page.getByRole("button", { name: /^Table 2, / }).boundingBox())!;
    const before = await unassignedCount(page);
    await drag(page, await guestHandle(page), { x: box.x + box.width + 12, y: box.y + box.height * 0.75 });
    await page.waitForTimeout(300);
    expect(await unassignedCount(page)).toBe(before);
  });

  test("dragging a palette item onto the canvas adds a table", async ({ page }) => {
    const before = await tables(page).count();
    const item = (await palette(page).getByRole("button", { name: /^Round$/ }).boundingBox())!;
    await drag(page, { x: item.x + item.width / 2, y: item.y + item.height / 2 }, { x: 1000, y: 650 });
    await expect(tables(page)).toHaveCount(before + 1);
  });
});
