import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { migrate } from "@jfrusher/knotwork";
import { nodeFontSource } from "@/lib/pdf/nodeFontSource";
import { textOf } from "@/lib/pdf/readPdf";
import { parseCsv } from "@/lib/data/csv";
import { dayPlaces, readBoxes, readCrew, readGuests } from "@/lib/model/slices";
import { renderBoxLabels } from "./render/pdf/labels";
import { renderPackingList } from "./render/pdf/packingList";
import { boxesCsv, boxRows, itemText } from "./rows";

const raw = JSON.parse(readFileSync(join(process.cwd(), "public", "fixtures", "example-wedding.knotwork.json"), "utf8"));
const doc = migrate(raw);
const rows = boxRows(readBoxes(doc), dayPlaces(doc), readCrew(doc), readGuests(doc));

describe("boxes, printed", () => {
  it("are in number order, each with where it goes, by when, and who takes it by name", () => {
    expect(rows.map((row) => row.number)).toEqual([1, 2, 3, 4]);
    expect(rows[1]).toMatchObject({ name: "Getting ready", where: "The suite, by 08:00", takenBy: ["Ines Ashdown"] });
    expect(rows[3]).toMatchObject({ where: "Not for the day", takenBy: [] });
    expect(itemText({ label: "Shoes", quantity: 2 })).toBe("2 × Shoes");
    expect(itemText({ label: "Steamer", quantity: 1 })).toBe("Steamer");
  });

  it("are a spreadsheet, one thing to a row", () => {
    const table = parseCsv(boxesCsv(rows));
    expect(table.headers).toEqual(["Box", "Name", "Needed", "Taken by", "Item", "How many", "Packed"]);
    expect(table.rows).toHaveLength(rows.reduce((sum, row) => sum + row.items.length, 0));
    expect(table.rows).toContainEqual({
      Box: "2",
      Name: "Getting ready",
      Needed: "The suite, by 08:00",
      "Taken by": "Ines Ashdown",
      Item: "Shoes",
      "How many": "2",
      Packed: "Yes",
    });
  });

  it("are labels, four to a sheet, each with its number, name, where and contents", async () => {
    const { text, pages } = await textOf(await renderBoxLabels(rows, { fontSource: nodeFontSource }));
    expect(pages).toBe(1);
    for (const row of rows) {
      expect(text).toContain(row.name);
      expect(text).toContain(row.where);
    }
    expect(text).toContain("2 × Shoes");
    expect(text).toContain("Taken by Ines Ashdown");
  });

  it("say how many more there are when a box holds more than its label", async () => {
    const full = { ...rows[0]!, items: Array.from({ length: 60 }, (_, i) => ({ id: `i${i}`, label: `Thing ${i + 1}`, quantity: 1, packed: false })) };
    const { text } = await textOf(await renderBoxLabels([full], { fontSource: nodeFontSource }));
    expect(text).toContain("Thing 1");
    expect(text).not.toContain("Thing 60");
    expect(text).toMatch(/and \d+ more/);
  });

  it("are a packing list, every box and every thing in it", async () => {
    const { text } = await textOf(await renderPackingList(rows, { fontSource: nodeFontSource, coupleNames: "Alex & Sam" }));
    expect(text).toContain("Packing list — Alex & Sam");
    expect(text).toContain("Box 2 · Getting ready");
    for (const item of rows.flatMap((row) => row.items)) expect(text).toContain(item.label);
  });
});
