import { describe, expect, it } from "vitest";
import type { Sheet } from "../types";
import { TILE_MARGIN_MM, TILE_OVERLAP_MM, tileSheets } from "./tile";

/** A board with one element at a known place, and its crop marks. */
const board = (w: number, h: number, index = 0): Sheet => ({
  index,
  pageWidthMm: w,
  pageHeightMm: h,
  cards: [
    {
      origin: { x: 0, y: 0 },
      footprint: { w, h },
      artefactIndex: 0,
      scene: {
        backgroundHex: null,
        elements: [{ id: "name", kind: "rect", x: 300, y: 400, w: 10, h: 10, rotationDeg: 0, z: 0, fillHex: "#000000", strokeHex: null, strokeWidthMm: 0, dashed: false }],
      },
    },
  ],
  guides: { cropMarks: [[{ x: 0, y: 0 }, { x: 5, y: 0 }]], cutLines: [], foldGuides: [], bleedBoxes: [] },
});

describe("tiling a board onto home paper", () => {
  // A4 portrait: a 190 × 277mm window, stepping 180 × 267mm.
  it("covers the whole board with the fewest sheets of paper", () => {
    const { sheets } = tileSheets([board(594, 841)], "A4");
    // Portrait: 4 × 4 = 16. Landscape (267 × 180 steps): 3 × 5 = 15.
    expect(sheets).toHaveLength(15);
    expect(sheets[0]).toMatchObject({ pageWidthMm: 297, pageHeightMm: 210 });
  });

  it("numbers every tile in order, and labels it by row and column", () => {
    const { sheets, labels } = tileSheets([board(594, 841)], "A4");
    expect(sheets.map((s) => s.index)).toEqual([...sheets.keys()]);
    expect(labels[0]).toMatch(/^tile A1 of 5 × 3\./);
    expect(labels[4]).toMatch(/^tile B2 of 5 × 3\./);
  });

  it("moves the board under each tile's window, overlapping the one before by the overlap", () => {
    const { sheets } = tileSheets([board(594, 841)], "A4");
    const rect = (i: number) => sheets[i]!.cards[0]!.scene.elements[0]!;
    // A1 shows the board from its corner, inset by the margin.
    expect(rect(0)).toMatchObject({ x: 300 + TILE_MARGIN_MM, y: 400 + TILE_MARGIN_MM });
    // A2 starts one step on: the window less the overlap.
    const stepX = 297 - TILE_MARGIN_MM * 2 - TILE_OVERLAP_MM;
    expect(rect(1).x).toBeCloseTo(300 + TILE_MARGIN_MM - stepX);
    // The board's own marks travel with it.
    expect(sheets[0]!.guides.cropMarks[0]![0]).toEqual({ x: TILE_MARGIN_MM, y: TILE_MARGIN_MM });
  });

  it("draws a trim line only where a tile has a neighbour before it, and a landing line where one follows", () => {
    const { sheets } = tileSheets([board(594, 841)], "A4");
    const lines = (i: number) => sheets[i]!.guides.cutLines;
    // A1: nothing before it; something to its right and below.
    expect(lines(0)).toHaveLength(2);
    // B2: neighbours on every side.
    expect(lines(4)).toHaveLength(4);
    // The last tile: only trim lines.
    expect(lines(sheets.length - 1)).toHaveLength(2);
    expect(lines(4)[0]).toEqual([
      { x: TILE_MARGIN_MM, y: TILE_MARGIN_MM },
      { x: TILE_MARGIN_MM, y: 210 - TILE_MARGIN_MM },
    ]);
  });

  it("does not tile what already fits on one sheet", () => {
    expect(tileSheets([board(150, 200)], "A4").sheets).toHaveLength(1);
  });

  it("says which board a tile belongs to when there is more than one", () => {
    const { labels } = tileSheets([board(150, 200, 0), board(150, 200, 1)], "A4");
    expect(labels).toEqual([expect.stringMatching(/^Board 1, tile A1/), expect.stringMatching(/^Board 2, tile A1/)]);
  });
});
