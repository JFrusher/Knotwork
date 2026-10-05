import { describe, expect, it } from "vitest";
import type { Artefact } from "../core/data/artefacts";
import type { RoomScene, Template } from "../core/types";
import { printBasis, recordPrint, sincePrinted } from "./printed";

const card = (key: string, Table: string, number = "1"): Artefact => ({
  key,
  row: { Name: key, Table, "Table Number": number },
  rows: [{ Name: key, Table, "Table Number": number }],
  rowIndexes: [0],
  rowId: key,
  rowIds: [key],
  label: key,
});

const text = (template: string) => ({
  kind: "text" as const,
  id: template,
  x: 0,
  y: 0,
  w: 10,
  h: 10,
  z: 0,
  template,
  fontId: "crimson",
  fontSizePt: 12,
  align: "center" as const,
  vAlign: "middle" as const,
  lineHeight: 1.2,
  colorHex: "#000000",
  letterSpacingMm: 0,
  fit: { mode: "shrink" as const, minFontSizePt: 6, maxLines: 1, anchor: "align" as const },
});
const design = (...templates: string[]): Template => ({ backgroundHex: null, elements: templates.map(text) });
const room: RoomScene = { bounds: { x: 0, y: 0, w: 1, h: 1 }, walls: [], seatRadius: 1, tables: [] };

describe("what has changed since printing", () => {
  const basis = printBasis(design("{{Name}}", "{{Table}}"), room);
  const printed = recordPrint(null, [card("ada", "Table 1"), card("bo", "Table 2"), card("cy", "Table 3")], false, "2026-10-01T10:00:00Z", basis);

  it("is nothing straight after a print", () => {
    expect(sincePrinted(printed, [card("ada", "Table 1"), card("bo", "Table 2"), card("cy", "Table 3")], basis)).toEqual({ changed: [], gone: [] });
  });

  it("is a card whose guest moved, a guest who is new, and a card nobody needs now", () => {
    const now = [card("ada", "Table 4"), card("bo", "Table 2"), card("di", "Table 1")];
    const { changed, gone } = sincePrinted(printed, now, basis);
    expect(changed.map((a) => a.key)).toEqual(["ada", "di"]);
    expect(gone).toEqual(["cy"]);
  });

  it("ignores what the design does not print — a table renamed renumbers every table, and a name card does not care", () => {
    const names = printBasis(design("{{Name}}"), room);
    const before = recordPrint(null, [card("ada", "Top table", "14"), card("bo", "Table 2", "2")], false, "x", names);
    const renumbered = [card("ada", "Head table", "1"), card("bo", "Table 2", "3")];
    expect(sincePrinted(before, renumbered, names).changed).toEqual([]);
    // The same change, on a design that does print the table, is the one card.
    const tables = printBasis(design("{{Name}}", "{{Table}}"), room);
    const printedTables = recordPrint(null, [card("ada", "Top table", "14"), card("bo", "Table 2", "2")], false, "x", tables);
    expect(sincePrinted(printedTables, renumbered, tables).changed.map((a) => a.key)).toEqual(["ada"]);
  });

  it("adds a reprint of a few to what was printed, and a full run replaces it", () => {
    const reprinted = recordPrint(printed, [card("ada", "Table 4")], true, "2026-10-02T10:00:00Z", basis);
    expect(Object.keys(reprinted.cards).sort()).toEqual(["ada", "bo", "cy"]);
    expect(sincePrinted(reprinted, [card("ada", "Table 4"), card("bo", "Table 2"), card("cy", "Table 3")], basis).changed).toEqual([]);
    expect(Object.keys(recordPrint(printed, [card("ada", "Table 4")], false, "x", basis).cards)).toEqual(["ada"]);
  });
});

describe("a design that names chairs", () => {
  it("has changed when someone else sits in a chair it names", () => {
    const sitterRoom = (name: string): RoomScene => ({
      ...room,
      tables: [
        {
          label: "Table 1",
          x: 0,
          y: 0,
          rotationDeg: 0,
          pathD: "",
          view: { x: 0, y: 0, w: 1, h: 1 },
          numbered: true,
          interior: { x: 0, y: 0, w: 1, h: 1 },
          seats: [{ x: 0, y: 0, out: { x: 0, y: 1 }, number: 1, row: { "First Name": name, "Last Name": "" } }],
        },
      ],
    });
    const chairs = design("{{Table}}: {{At seat 1}}");
    const printed = recordPrint(null, [card("t1", "Table 1")], false, "x", printBasis(chairs, sitterRoom("Ada")));
    expect(sincePrinted(printed, [card("t1", "Table 1")], printBasis(chairs, sitterRoom("Ada"))).changed).toEqual([]);
    expect(sincePrinted(printed, [card("t1", "Table 1")], printBasis(chairs, sitterRoom("Grace"))).changed).toHaveLength(1);
  });
});
