import { expect, test, type Page } from "@playwright/test";
import { openSeating, seedExampleWedding, storedDocument, unassignedCount } from "./wedding";

test.beforeEach(async ({ page }) => {
  await seedExampleWedding(page);
  await openSeating(page);
});

const tables = (page: Page) => page.getByRole("button", { name: / seats taken$/ });
/**
 * Coming, and not yet seated, in the example wedding. Drops go to the top
 * table, which has free seats and is in full view — the bottom row sits under
 * the canvas's own toolbar at this size, and a drop there lands on the toolbar.
 */
const UNSEATED = "Zainab Thistlewood";
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
    await tabTo(page, new RegExp(`^${UNSEATED}`));
    await page.keyboard.press("Enter");
    const seat = page.getByLabel("Seat at table");
    await seat.selectOption({ label: "Table 13 — 8 free" });
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
    // Scrolled to first, as a person would: the list is longer than the screen.
    const card = page.getByRole("button", { name: new RegExp(`^${UNSEATED}`) });
    await card.scrollIntoViewIfNeeded();
    const box = (await card.boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  // The drop target once sat half a table down and to the right of the table
  // drawn, so the top-left half missed and the floor beside it caught drops.
  test("a guest dropped on the top-left of a table is seated at it", async ({ page }) => {
    const box = (await page.getByRole("button", { name: /^Top table, / }).boundingBox())!;
    const before = await unassignedCount(page);
    await drag(page, await guestHandle(page), { x: box.x + box.width * 0.35, y: box.y + box.height * 0.35 });
    await expect.poll(() => unassignedCount(page)).toBe(before - 1);
  });

  test("a guest dropped on the floor beside a table is not seated", async ({ page }) => {
    const box = (await page.getByRole("button", { name: /^Top table, / }).boundingBox())!;
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

/*
 * Seating keeps no copy: an edit is in the wedding as it is made, and the
 * header's undo — the wedding's one history — takes it back.
 */
test("a table renamed is stored at once, and the header's undo takes it back", async ({ page }) => {
  const topTable = async () =>
    ((await storedDocument(page)).seating.tables as Record<string, { label: string }>)["tbl_mulleqvk1f43i"]!.label;

  await page.getByRole("button", { name: /^Top table, / }).click();
  await page.getByLabel("Table name").fill("Head table");
  await page.getByLabel("Table name").press("Enter");
  await expect.poll(topTable).toBe("Head table");

  await page.getByRole("button", { name: "Undo rename table" }).click();
  await expect.poll(topTable).toBe("Top table");
  await expect(page.getByLabel("Table name")).toHaveValue("Top table");
});

/*
 * What a pointer does to the room. Each drag is drawn in the window as it
 * moves and written into the wedding once, when it ends, as one step the
 * header's undo takes back.
 */
test.describe("shaping the room with a pointer", () => {
  const TOP_TABLE = "tbl_mulleqvk1f43i";
  const TABLE_1 = "tbl_mulleqvk2se1n";

  const table = async (page: Page, id: string) =>
    (await storedDocument(page)).seating.tables[id] as {
      x: number;
      rotation: number;
      sizeUnits: { diameter?: number };
    };
  const room = async (page: Page) =>
    (await storedDocument(page)).seating.room.spaces[0] as { x: number; y: number };

  /** A point in the room, 1200 by 900 across, on the screen. */
  async function inRoom(page: Page, x: number, y: number) {
    const box = (await page.locator("[data-room-svg] rect").first().boundingBox())!;
    return { x: box.x + (x * box.width) / 1200, y: box.y + (y * box.height) / 900 };
  }

  async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(from.x + ((to.x - from.x) * i) / 10, from.y + ((to.y - from.y) * i) / 10);
    }
    await page.mouse.up();
  }

  const centre = async (page: Page, name: string | RegExp) => {
    const box = (await page.getByRole("button", { name }).boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };

  test("a table dragged across the room is stored where it lands", async ({ page }) => {
    const before = (await table(page, TOP_TABLE)).x;
    // By its corner: its middle is the guests seated at it.
    const box = (await page.getByRole("button", { name: /^Top table, / }).boundingBox())!;
    await drag(page, { x: box.x + 4, y: box.y + 4 }, { x: box.x + 124, y: box.y + 4 });
    await expect.poll(async () => (await table(page, TOP_TABLE)).x).toBeGreaterThan(before);

    await page.getByRole("button", { name: "Undo move table" }).click();
    await expect.poll(async () => (await table(page, TOP_TABLE)).x).toBe(before);
  });

  test("a table's knob turns it", async ({ page }) => {
    await page.getByRole("button", { name: /^Top table, / }).click({ position: { x: 4, y: 4 } });
    const knob = await centre(page, "Rotate table");
    const middle = await inRoom(page, 600, 130);
    // Straight out to the right of the table: a quarter turn.
    await drag(page, knob, { x: middle.x + 200, y: middle.y });
    await expect.poll(async () => (await table(page, TOP_TABLE)).rotation).toBe(90);

    await page.getByRole("button", { name: "Undo rotate table" }).click();
    await expect.poll(async () => (await table(page, TOP_TABLE)).rotation).toBe(0);
  });

  test("a table's handle resizes it", async ({ page }) => {
    const before = (await table(page, TABLE_1)).sizeUnits.diameter!;
    await page.getByRole("button", { name: /^Table 1, / }).click({ position: { x: 4, y: 4 } });
    const handle = await centre(page, "Resize table");
    await drag(page, handle, { x: handle.x + 40, y: handle.y + 40 });
    await expect.poll(async () => (await table(page, TABLE_1)).sizeUnits.diameter).toBeGreaterThan(before);

    await page.getByRole("button", { name: "Undo resize table" }).click();
    await expect.poll(async () => (await table(page, TABLE_1)).sizeUnits.diameter).toBe(before);
  });

  test("a room moved by its grip is stored where it lands", async ({ page }) => {
    // A click on the floor, clear of every table, picks the room.
    const floor = await inRoom(page, 100, 130);
    await page.mouse.click(floor.x, floor.y);
    const grip = await centre(page, "Move Room");
    await drag(page, grip, { x: grip.x + 60, y: grip.y + 60 });
    await expect.poll(async () => (await room(page)).x).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Undo edit space" }).click();
    await expect.poll(async () => (await room(page)).x).toBe(0);
  });

  test("a pillar is put down, then moved", async ({ page }) => {
    const pillars = async () => Object.values((await storedDocument(page)).seating.pillars ?? {}) as Array<{ x: number }>;
    await page.getByRole("button", { name: /^Place a structural pillar/ }).click();
    const spot = await inRoom(page, 100, 130);
    await page.mouse.click(spot.x, spot.y);
    await expect.poll(async () => (await pillars()).length).toBe(1);

    const [placed] = await pillars();
    await drag(page, spot, { x: spot.x + 60, y: spot.y });
    await expect.poll(async () => (await pillars())[0]!.x).toBeGreaterThan(placed!.x);

    await page.getByRole("button", { name: "Undo move pillar" }).click();
    await expect.poll(async () => (await pillars())[0]!.x).toBe(placed!.x);
  });
});

/*
 * The tools that draw on the floor or put something on it work inside a room.
 * The room counted as something already on the canvas, and a press on one
 * went to it — so a zone or a pillar could only be put down off the floor.
 */
test("a zone is drawn on the floor, then moved", async ({ page }) => {
  const zones = async () =>
    Object.values((await storedDocument(page)).seating.zones ?? {}) as Array<{ x: number }>;
  const box = (await page.locator("[data-room-svg] rect").first().boundingBox())!;
  const at = (x: number, y: number) => ({ x: box.x + (x * box.width) / 1200, y: box.y + (y * box.height) / 900 });
  const drag = async (from: { x: number; y: number }, to: { x: number; y: number }) => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(from.x + ((to.x - from.x) * i) / 10, from.y + ((to.y - from.y) * i) / 10);
    }
    await page.mouse.up();
  };

  await page.getByRole("button", { name: "Draw a zone" }).click();
  await drag(at(40, 430), at(140, 490));
  await expect.poll(async () => (await zones()).length).toBe(1);

  const [drawn] = await zones();
  await drag(at(90, 460), at(150, 460));
  await expect.poll(async () => (await zones())[0]!.x).toBeGreaterThan(drawn!.x);

  await page.getByRole("button", { name: "Undo move zone" }).click();
  await expect.poll(async () => (await zones())[0]!.x).toBe(drawn!.x);
});
