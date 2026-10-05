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
  await expect(pieces.getByRole("button", { name: "Place cards", exact: true })).toHaveAttribute("aria-current", "true");
  const placeCards = await elementCount(page);

  await pieces.getByRole("button", { name: "+ New piece" }).click();
  const name = pieces.getByRole("textbox", { name: "Name of this piece" });
  await name.fill("Table numbers");
  await name.press("Enter");
  await expect(pieces.getByRole("button", { name: "Table numbers", exact: true })).toHaveAttribute("aria-current", "true");

  await page.getByRole("button", { name: "+ Text" }).click();
  await expect
    .poll(async () => ((await storedDocument(page)).stationery.pieces as Array<{ name: string; template: { elements: unknown[] } }>).map((p) => [p.name, p.template.elements.length]))
    .toEqual([
      ["Place cards", placeCards],
      ["Table numbers", 1],
    ]);

  await pieces.getByRole("button", { name: "Place cards", exact: true }).click();
  await expect(pieces.getByRole("button", { name: "Place cards", exact: true })).toHaveAttribute("aria-current", "true");
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

test("the floor plan starter draws the room from Seating, every guest named at their table", async ({ page }) => {
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

  // One format for the whole design: pick it, and every name on the plan follows.
  await page.getByRole("button", { name: /room\s*the whole room/ }).click();
  await page.getByRole("button", { name: "Ada B." }).click();
  await expect(card.getByText("Alex M.", { exact: true })).toBeVisible();
});

test("the table card starter shows its own table, and who sits where at it", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/place-cards");
  const pieces = page.getByRole("navigation", { name: "Pieces" });
  await pieces.getByRole("button", { name: "+ New piece" }).click();
  await pieces.getByRole("textbox", { name: "Name of this piece" }).fill("Table cards");
  await pieces.getByRole("textbox", { name: "Name of this piece" }).press("Enter");
  await page.getByLabel("Start from a design").selectOption({ label: "Table card — who sits here, A5" });
  // A card for each of the thirteen tables with people at them; the three still to seat have none.
  await expect(page.getByText(/^13 cards · \d+ sheets?$/)).toBeVisible();
  await expect(page.getByText(/3 rows have no Table, so are on none\./)).toBeVisible();
  await page.screenshot({ path: process.env.SHOT2 ?? "test-results/table-card.png" });
});

test("after printing, a change in the room names the cards it made wrong, and reprints just those", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/place-cards");
  const pieces = page.getByRole("navigation", { name: "Pieces" });
  await pieces.getByRole("button", { name: "+ New piece" }).click();
  await pieces.getByRole("textbox", { name: "Name of this piece" }).fill("Escort cards");
  await pieces.getByRole("textbox", { name: "Name of this piece" }).press("Enter");
  await page.getByLabel("Start from a design").selectOption({ label: "Escort card — name, table and seat" });
  await expect(page.getByRole("region", { name: "Card" }).getByText("Top table", { exact: true })).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download print-ready PDF" }).click();
  await page.getByRole("button", { name: /^Download all \d+ sheets$/ }).click();
  await download;
  await expect(page.getByRole("status").filter({ hasText: "changed" })).toHaveCount(0);

  await page.getByRole("link", { name: "Seating" }).click();
  await page.getByRole("button", { name: /^Top table, / }).click();
  await page.getByLabel("Table name").fill("Head table");
  await page.getByLabel("Table name").press("Enter");
  await page.getByRole("link", { name: "Place cards" }).click();

  await expect(page.getByRole("region", { name: "Card" }).getByText("Head table", { exact: true })).toBeVisible();
  const notice = page.getByRole("status").filter({ hasText: "changed" });
  await expect(notice).toContainText("8 cards have changed: Alex Morgan");
  await page.getByRole("button", { name: "Print just these 8" }).click();
  await expect(page.getByText("Just 8 of 100 cards")).toBeVisible();
  // The sheets on screen are the ones that will print: the eight, not the hundred.
  await expect(page.getByText("Sheet 1 of 1", { exact: true })).toBeVisible();

  // Once the eight are printed, nothing is out of date and the next print is the whole run again.
  const reprint = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download print-ready PDF" }).click();
  await page.getByRole("button", { name: /^Download all \d+ sheets?$/ }).click();
  await reprint;
  await expect(page.getByText(/^100 cards · \d+ sheets$/)).toBeVisible();
  await expect(notice).toHaveCount(0);
  await page.screenshot({ path: process.env.SHOT ?? "test-results/reprint.png" });
});

test("Seating's Print opens Place cards on the floor plan, making it the first time", async ({ page }) => {
  await seedExampleWedding(page);
  await openSeating(page);
  await page.getByRole("button", { name: "Print & PDF" }).click();
  await page.getByRole("link", { name: /^Floor plan/ }).click();

  await expect(page).toHaveURL(/\/place-cards\?piece=floor-plan$/);
  const pieces = page.getByRole("navigation", { name: "Pieces" });
  await expect(pieces.getByRole("button", { name: "Floor plan", exact: true })).toHaveAttribute("aria-current", "true");
  await expect(page.getByRole("region", { name: "Card" }).getByText("Top table")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download print-shop PDF" })).toBeVisible();
});

test("a chair picked on the map goes into the text, and the card names whoever sits there", async ({ page }) => {
  await seedExampleWedding(page);
  await openSeating(page);
  await page.getByRole("button", { name: /^Top table, / }).click();
  await page.getByRole("button", { name: "Seat-level" }).click();

  await page.getByRole("link", { name: "Place cards" }).click();
  const pieces = page.getByRole("navigation", { name: "Pieces" });
  await pieces.getByRole("button", { name: "+ New piece" }).click();
  await pieces.getByRole("textbox", { name: "Name of this piece" }).press("Enter");
  await page.getByLabel("Start from a design").selectOption({ label: "Table card — who sits here, A5" });
  await page.getByRole("button", { name: "+ Text" }).click();

  await page.getByRole("button", { name: "Pick a chair" }).click();
  await expect(page.getByRole("button", { name: "This card's table" })).toHaveAttribute("aria-pressed", "true");
  const chair = page.getByRole("button", { name: /^Top table, seat 1: / });
  const sitter = ((await chair.getAttribute("aria-label")) ?? "").replace(/^Top table, seat 1: /, "");
  await chair.click();

  await expect(page.getByRole("textbox", { name: "Text" })).toHaveValue(/ \{\{At seat 1\}\}$/);
  // One line for the design, not one per free-seating table's card.
  await expect(page.getByText(/there are no numbered seats, so a seat says nothing there/)).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Card" }).getByText(sitter, { exact: true }).first()).toBeVisible();
  await expect(chair.locator("..")).toHaveClass(/used/);
  await page.screenshot({ path: process.env.SHOT ?? "test-results/chair-picker.png" });
});

test("a plan's names stamped out as boxes of their own say the same names, once each", async ({ page }) => {
  await seedExampleWedding(page);
  await openSeating(page);
  await page.getByRole("button", { name: /^Top table, / }).click();
  await page.getByRole("button", { name: "Seat-level" }).click();

  await page.getByRole("link", { name: "Place cards" }).click();
  const pieces = page.getByRole("navigation", { name: "Pieces" });
  await pieces.getByRole("button", { name: "+ New piece" }).click();
  await pieces.getByRole("textbox", { name: "Name of this piece" }).press("Enter");
  await page.getByLabel("Start from a design").selectOption({ label: "Floor plan — the room to scale, A1" });

  const doc = await storedDocument(page);
  const top = Object.values(doc.seating.tables as Record<string, any>).find((t) => t.label === "Top table");
  const sitter = doc.guests[top.assignedGuestIds[0]].firstName as string;
  const card = page.getByRole("region", { name: "Card" });
  const named = card.getByText(sitter, { exact: true });
  const before = await named.count();
  expect(before).toBeGreaterThan(0);

  await page.getByRole("button", { name: /room\s*the whole room/ }).click();
  await page.getByRole("button", { name: "Boxes that follow the plan" }).click();

  const all = page.getByText(/^Every chair has its box \(\d+\)\.$/);
  await expect(all).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Names at chairs" })).not.toBeChecked();
  // The plan stops naming its chairs, so each name is printed once, by its box.
  await expect(named).toHaveCount(before);
  const boxes = ((await storedDocument(page)).stationery.pieces.at(-1).template.elements as any[]).filter((el) => el.chair);
  expect(`Every chair has its box (${boxes.length}).`).toBe(await all.textContent());
  expect(boxes.every((b) => b.chair.follow && /^\{\{Top table, seat \d+\}\}$/.test(b.template))).toBe(true);
  await page.screenshot({ path: process.env.SHOT ?? "test-results/stamp-chairs.png" });
});

test("the wedding pack's room is the floor plan as Place cards draws it, on A4", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download the pack" }).click()]);
  await expect(page.getByText(/^The room \(1\), The day/)).toBeVisible();
  const { PDFDocument } = await import("pdf-lib");
  const { readFileSync, copyFileSync } = await import("node:fs");
  const path = await download.path();
  copyFileSync(path, process.env.PACK ?? "test-results/pack.pdf");
  const first = (await PDFDocument.load(readFileSync(path))).getPage(0);
  // A4 landscape, in points.
  expect([Math.round(first.getWidth()), Math.round(first.getHeight())]).toEqual([842, 595]);
});

test("a guest known by a name of their own is called it on the plan, whatever the design's format", async ({ page }) => {
  await seedExampleWedding(page);
  await page.goto("/guests");
  const knownAs = page.getByRole("textbox", { name: "What the stationery calls Alex Morgan" });
  await knownAs.fill("Granny Jo");
  await knownAs.press("Enter");
  await expect.poll(async () => Object.values((await storedDocument(page)).guests as Record<string, any>).find((g) => g.firstName === "Alex")?.knownAs).toBe("Granny Jo");

  await page.getByRole("link", { name: "Place cards" }).click();
  const pieces = page.getByRole("navigation", { name: "Pieces" });
  await pieces.getByRole("button", { name: "+ New piece" }).click();
  await pieces.getByRole("textbox", { name: "Name of this piece" }).press("Enter");
  await page.getByLabel("Start from a design").selectOption({ label: "Floor plan — the room to scale, A1" });
  const card = page.getByRole("region", { name: "Card" });
  await expect(card.getByText("Granny Jo", { exact: true })).toBeVisible();
  await expect(card.getByText("Alex", { exact: true })).toHaveCount(0);
});
