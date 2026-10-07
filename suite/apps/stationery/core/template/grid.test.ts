import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUNDLED_FONTS } from "../../assets/fonts";
import { loadFont, type LoadedFont } from "../text/measure";
import { fitGrid } from "../text/fit";
import type { CardSpec, GridElement, ResolvedText } from "../types";
import { GRID_HEADING, resolveCard } from "./bindings";
import { makeResolveOptions } from "./resolve";

/**
 * The seating board's grid: a block per table, every block the same size, as
 * large as the fullest table allows — resolved to plain text so neither
 * renderer has to know it exists.
 */
const fonts = new Map<string, LoadedFont>(
  BUNDLED_FONTS.map((f) => [f.id, loadFont(f.id, f.family, new Uint8Array(readFileSync(`public/fonts/${f.file}`)))]),
);
const resolve = makeResolveOptions(fonts);

const board: CardSpec = { widthMm: 594, heightMm: 841, fold: "none", foldPositionMm: 420, invertBackPanel: false, bleedMm: 0 };

const grid = (over: Partial<GridElement> = {}): GridElement => ({
  kind: "grid",
  id: "g",
  x: 20,
  y: 20,
  w: 554,
  h: 800,
  z: 3,
  groupBy: "Table",
  headingTemplate: "{{Table}}",
  itemTemplate: "{{Name}}",
  sortBy: "",
  layout: "cells",
  columns: 2,
  gapMm: 10,
  fontId: "crimson",
  fontSizePt: 24,
  headingFontId: "marcellus",
  headingScale: 1.5,
  headingColorHex: "#7a5c3a",
  align: "center",
  lineHeight: 1.3,
  colorHex: "#000000",
  letterSpacingMm: 0,
  fit: { mode: "shrink", minFontSizePt: 6, maxLines: 1, anchor: "align" },
  ...over,
});

const row = (Name: string, Table: string) => ({ Name, Table });
const rows = [row("Ada", "Table 10"), row("Bo", "Table 2"), row("Cy", "Table 2"), row("Di", "")];

const resolveGrid = (el: GridElement, data = rows) => {
  const { scene, warnings } = resolveCard({ elements: [el], backgroundHex: null }, data[0]!, board, resolve, data);
  return { pieces: scene.elements as ResolvedText[], warnings };
};

describe("a seating grid", () => {
  it("gives each table a heading and its guests, in the order people read table names", () => {
    const { pieces } = resolveGrid(grid());
    const headings = pieces.filter((p) => p.id.startsWith(`g${GRID_HEADING}`)).map((p) => p.lines);
    const lines = pieces.filter((p) => !p.id.startsWith(`g${GRID_HEADING}`)).map((p) => p.lines);
    expect(headings).toEqual([["Table 2"], ["Table 10"]]);
    expect(lines).toEqual([["Bo", "Cy"], ["Ada"]]);
  });

  it("names every piece after the grid, so selecting any selects the grid", () => {
    const { pieces } = resolveGrid(grid());
    expect(new Set(pieces.map((p) => p.sourceId))).toEqual(new Set(["g"]));
    expect(new Set(pieces.map((p) => p.id)).size).toBe(pieces.length);
  });

  it("lays blocks out in columns of equal cells, left to right then down", () => {
    const { pieces } = resolveGrid(grid(), [row("A", "1"), row("B", "2"), row("C", "3")]);
    const headings = pieces.filter((p) => p.id.startsWith(`g${GRID_HEADING}`));
    // Two columns of (554 - 10) / 2 = 272mm.
    expect(headings.map((h) => [h.x, h.y, h.w])).toEqual([
      [20, 20, 272],
      [302, 20, 272],
      [20, 425, 272],
    ]);
  });

  it("sets every table at one size, the heading a multiple of it", () => {
    const { pieces } = resolveGrid(grid());
    const sizes = new Set(pieces.filter((p) => !p.id.startsWith(`g${GRID_HEADING}`)).map((p) => p.fontSizePt));
    expect(sizes.size).toBe(1);
    const [size] = sizes;
    expect(pieces.find((p) => p.id.startsWith(`g${GRID_HEADING}`))!.fontSizePt).toBeCloseTo(size! * 1.5);
  });

  it("leaves off a guest with no table, and says so rather than printing a block for nobody", () => {
    const { pieces, warnings } = resolveGrid(grid());
    expect(pieces.flatMap((p) => p.lines)).not.toContain("Di");
    expect(warnings).toContainEqual(expect.objectContaining({ kind: "left-out", detail: expect.stringMatching(/One row has no Table/) }));
  });

  it("shrinks every block together until the fullest fits, and reports what will not", () => {
    const crowded = Array.from({ length: 40 }, (_, i) => row(`Guest number ${i}`, "Table 1"));
    const small = resolveGrid(grid({ h: 200 }), crowded);
    const size = small.pieces.find((p) => !p.id.startsWith(`g${GRID_HEADING}`))!.fontSizePt;
    expect(size).toBeLessThan(24);
    expect(small.warnings.filter((w) => w.kind === "overflow")).toEqual([]);

    const impossible = resolveGrid(grid({ h: 40 }), crowded);
    expect(impossible.warnings).toContainEqual(expect.objectContaining({ kind: "overflow" }));
  });

  it("says the font is missing rather than guessing a size", () => {
    const { warnings } = resolveGrid(grid({ headingFontId: "user:gone" }));
    expect(warnings).toContainEqual(expect.objectContaining({ kind: "missing-font" }));
  });
});

describe("fitGrid", () => {
  const crimson = fonts.get("crimson")!;
  const config = { mode: "shrink" as const, minFontSizePt: 6, maxLines: 1, anchor: "align" as const };

  it("keeps the size asked for when every block fits", () => {
    const blocks = [{ heading: "Table 1", items: ["Ada", "Bo"] }];
    expect(
      fitGrid(crimson, crimson, { blocks, cellWMm: 100, cellHMm: 100, fontSizePt: 12, headingScale: 1.5, lineHeight: 1.2, letterSpacingMm: 0, fit: config }),
    ).toEqual({ fontSizePt: 12, overflowed: false });
  });

  it("is held back by the widest heading as much as by the longest line", () => {
    const blocks = [{ heading: "The Long Table by the Window", items: ["Ada"] }];
    const { fontSizePt } = fitGrid(crimson, crimson, { blocks, cellWMm: 60, cellHMm: 100, fontSizePt: 24, headingScale: 1.5, lineHeight: 1.2, letterSpacingMm: 0, fit: config });
    expect(fontSizePt).toBeLessThan(24);
  });
});

describe("the order of a board's tables", () => {
  it("is the room's: the top table first, then 2 before 10", async () => {
    const { gridBlocks } = await import("./grid");
    const row = (Name: string, Table: string, number: string) => ({ Name, Table, "Table Number": number });
    const { blocks } = gridBlocks(
      { groupBy: "Table", headingTemplate: "{{Table}}", itemTemplate: "{{Name}}", sortBy: "" },
      [row("Ada", "Table 10", "3"), row("Bo", "Top table", "1"), row("Cy", "Table 2", "2")],
    );
    expect(blocks.map((b) => b.heading)).toEqual(["Top table", "Table 2", "Table 10"]);
  });

  it("is as people read them for anything else a board groups by", async () => {
    const { gridBlocks } = await import("./grid");
    const { blocks } = gridBlocks(
      { groupBy: "Initial", headingTemplate: "{{Initial}}", itemTemplate: "{{Name}}", sortBy: "" },
      [{ Name: "Zed", Initial: "Z" }, { Name: "Ada", Initial: "A" }],
    );
    expect(blocks.map((b) => b.heading)).toEqual(["A", "Z"]);
  });
});
