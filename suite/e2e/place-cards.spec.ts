import { expect, test } from "@playwright/test";
import { openSeating, seedExampleWedding, storedDocument } from "./wedding";

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

test("a table renamed in Seating is on the cards with nothing pressed", async ({ page }) => {
  await seedExampleWedding(page);
  await openSeating(page);
  await page.getByRole("button", { name: /^Top table, / }).click();
  await page.getByLabel("Table name").fill("Head table");
  await page.getByLabel("Table name").press("Enter");

  await page.getByRole("link", { name: "Place cards" }).click();
  // Alex Morgan sits at the top table, and is the first card.
  const card = page.getByRole("region", { name: "Card" });
  await expect(card.getByText("Head table")).toBeVisible();
  await expect(page.getByText(/Printing from the room, as it stands: 100 guests/)).toBeVisible();
  await page.screenshot({ path: process.env.SHOT ?? "test-results/live.png" });
});

test("a seating board goes to a print shop at full size, or onto A4 at home in tiles", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/place-cards");
  const pieces = page.getByRole("navigation", { name: "Pieces" });
  await pieces.getByRole("button", { name: "+ New piece" }).click();
  await pieces.getByRole("textbox", { name: "Name of this piece" }).press("Enter");

  await page.getByLabel("What are you making?").selectOption({ label: "Seating board — A1, 594 × 841mm" });
  await page.getByLabel("Paper").selectOption({ label: "The card's own size" });
  await page.getByLabel("Print one artefact per").selectOption({ label: "The whole list — a board, a seating list" });

  const pdfPages = async (button: string, choose?: string) => {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      (async () => {
        await page.getByRole("button", { name: button }).click();
        if (choose) await page.getByRole("button", { name: choose }).click();
      })(),
    ]);
    const { PDFDocument } = await import("pdf-lib");
    const pdf = await PDFDocument.load(await (await import("node:fs/promises")).readFile((await download.path())!));
    return pdf.getPages().map((p) => [Math.round((p.getWidth() / 72) * 25.4), Math.round((p.getHeight() / 72) * 25.4)]);
  };

  // One page: the board plus room for its crop marks.
  expect(await pdfPages("Download print-shop PDF", "Download all 1 sheet")).toEqual([[608, 855]]);
  // Fifteen A4 sheets, turned whichever way takes fewest.
  const tiles = await pdfPages("Tile it onto A4");
  expect(tiles.length).toBe(15);
  expect(new Set(tiles.map(([w, h]) => `${w}x${h}`))).toEqual(new Set(["297x210"]));
  await page.screenshot({ path: process.env.SHOT ?? "test-results/board.png" });
});

test("the seating board starter lays every table out from the room", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/place-cards");
  const pieces = page.getByRole("navigation", { name: "Pieces" });
  await pieces.getByRole("button", { name: "+ New piece" }).click();
  await pieces.getByRole("textbox", { name: "Name of this piece" }).fill("Seating board");
  await pieces.getByRole("textbox", { name: "Name of this piece" }).press("Enter");
  await page.getByLabel("Start from a design").selectOption({ label: "Seating board — every table, A1" });

  const card = page.getByRole("region", { name: "Card" });
  await expect(card.getByText("Find your seat")).toBeVisible();
  await expect(card.getByText("Top table")).toBeVisible();
  // Table 13 has nobody at it, so it has no block; Table 12 has one guest.
  await expect(card.getByText("Table 12")).toBeVisible();
  await expect(card.getByText("Table 13")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Download print-shop PDF" })).toBeEnabled();
  await page.screenshot({ path: process.env.SHOT ?? "test-results/board-starter.png" });
});

test("the finder starter files every guest A to Z, and carries on to another page when it runs long", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/place-cards");
  const pieces = page.getByRole("navigation", { name: "Pieces" });
  await pieces.getByRole("button", { name: "+ New piece" }).click();
  await pieces.getByRole("textbox", { name: "Name of this piece" }).fill("Finder");
  await pieces.getByRole("textbox", { name: "Name of this piece" }).press("Enter");
  await page.getByLabel("Start from a design").selectOption({ label: "Finder — every guest A to Z, A2" });

  const card = page.getByRole("region", { name: "Card" });
  await expect(card.getByText("Find your seat")).toBeVisible();
  await expect(card.getByText(/^Morgan, Alex — Top table$/)).toBeVisible();
  await expect(page.getByText("1 card · 1 sheet")).toBeVisible();
  await page.screenshot({ path: process.env.SHOT ?? "test-results/finder.png" });

  // Set large, the same hundred names need more than one page, each its own sheet.
  await page.getByRole("button", { name: /grid\s*by Initial/ }).click();
  await page.getByRole("spinbutton", { name: "Size pt" }).fill("30");
  await page.getByRole("spinbutton", { name: "Size pt" }).press("Enter");
  await expect(page.getByText(/^[2-9] cards · [2-9] sheets$/)).toBeVisible();
  await expect(card.getByRole("heading")).toContainText(/All 100 rows — page 1 of [2-9]/);
});

test("the floor plan starter draws the room from Seating, a first name at every taken chair", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/place-cards");
  const pieces = page.getByRole("navigation", { name: "Pieces" });
  await pieces.getByRole("button", { name: "+ New piece" }).click();
  await pieces.getByRole("textbox", { name: "Name of this piece" }).fill("Floor plan");
  await pieces.getByRole("textbox", { name: "Name of this piece" }).press("Enter");
  await page.getByLabel("Start from a design").selectOption({ label: "Floor plan — the room to scale, A1" });

  const card = page.getByRole("region", { name: "Card" });
  await expect(card.getByText("Top table")).toBeVisible();
  await expect(card.getByText("Alex", { exact: true })).toBeVisible();
  await page.screenshot({ path: process.env.SHOT ?? "test-results/floor-plan.png" });
});

test("the table card starter shows its own table, and who sits where at it", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/place-cards");
  const pieces = page.getByRole("navigation", { name: "Pieces" });
  await pieces.getByRole("button", { name: "+ New piece" }).click();
  await pieces.getByRole("textbox", { name: "Name of this piece" }).fill("Table cards");
  await pieces.getByRole("textbox", { name: "Name of this piece" }).press("Enter");
  await page.getByLabel("Start from a design").selectOption({ label: "Table card — who sits here, A5" });
  // Thirteen tables with people at them, and one for the three still to seat.
  await expect(page.getByText(/^14 cards · \d+ sheets?$/)).toBeVisible();
  await page.screenshot({ path: process.env.SHOT2 ?? "test-results/table-card.png" });
});
