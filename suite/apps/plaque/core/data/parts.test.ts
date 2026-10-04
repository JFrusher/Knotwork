import { describe, expect, it } from "vitest";
import { ptToMm } from "../units";
import type { GridElement, Template } from "../types";
import { flowPlan, gridBlocks } from "../template/grid";
import { artefactsOf } from "./parts";

/**
 * A finder: everyone A to Z under their letter, in newspaper columns, carrying
 * on onto another page when the list is too long for one.
 */
const finder = (over: Partial<GridElement> = {}): GridElement => ({
  kind: "grid",
  id: "names",
  x: 10,
  y: 10,
  w: 190,
  // 10 lines of 10pt × 1.2 a column, near enough: 42.3mm.
  h: ptToMm(10 * 1.2) * 10,
  z: 0,
  groupBy: "Initial",
  headingTemplate: "{{Initial}}",
  itemTemplate: "{{Last Name}}, {{First Name}}",
  sortBy: "Last Name",
  layout: "columns",
  columns: 2,
  gapMm: 0,
  fontId: "crimson",
  fontSizePt: 10,
  headingFontId: "crimson",
  // A heading as tall as a line, so the arithmetic below is in whole lines.
  headingScale: 1,
  headingColorHex: "#000000",
  align: "left",
  lineHeight: 1.2,
  colorHex: "#000000",
  letterSpacingMm: 0,
  fit: { mode: "shrink", minFontSizePt: 6, maxLines: 1, anchor: "align" },
  ...over,
});

const guest = (first: string, last: string) => ({
  "First Name": first,
  "Last Name": last,
  Initial: last.charAt(0).toUpperCase(),
});
const headers = ["First Name", "Last Name", "Initial"];

describe("a finder's blocks", () => {
  it("files guests under their letter, A to Z, by surname within it", () => {
    const rows = [guest("Zoe", "Smith"), guest("Ann", "Byron"), guest("Bo", "Sato"), guest("Cy", "Adams")];
    const { blocks } = gridBlocks(finder(), rows);
    expect(blocks.map((b) => b.heading)).toEqual(["A", "B", "S"]);
    expect(blocks[2]!.lines).toEqual(["Sato, Bo", "Smith, Zoe"]);
  });
});

describe("flowing down columns", () => {
  it("stacks blocks down a column and carries a long one over to the next, placing every line once", () => {
    const runs = flowPlan(finder(), [3, 8]);
    expect(runs[0]).toMatchObject({ column: 0, block: 0, heading: true, from: 0, to: 3 });
    const continued = runs.filter((run) => run.block === 1);
    expect(continued[0]).toMatchObject({ column: 0, heading: true, from: 0 });
    expect(continued.at(-1)).toMatchObject({ column: 1, heading: false, to: 8 });
    expect(continued.reduce((sum, run) => sum + run.to - run.from, 0)).toBe(8);
  });

  it("balances a list that fits on one page across its columns", () => {
    // Eleven lines in two columns of ten: six and five, not ten and one.
    const runs = flowPlan(finder(), [10]);
    const perColumn = [0, 1].map((column) => runs.filter((r) => r.column === column).reduce((sum, r) => sum + r.to - r.from + (r.heading ? 1 : 0), 0));
    expect(perColumn).toEqual([6, 5]);
  });

  it("never leaves a heading alone at the foot of a column", () => {
    // Long enough for two pages, so columns fill in turn: A fills nine lines,
    // and B's heading would be the tenth with nothing under it.
    const runs = flowPlan(finder(), [8, 2, 30]);
    expect(runs[1]).toMatchObject({ column: 1, y: 0, heading: true, from: 0, to: 2 });
  });

  it("goes on to another page when the columns are full", () => {
    const runs = flowPlan(finder(), [25]);
    expect(Math.max(...runs.map((r) => r.page))).toBe(1);
  });
});

describe("cutting a long list into pages", () => {
  const template = (el: GridElement): Template => ({ backgroundHex: null, rowScope: { kind: "document" }, elements: [el] });
  const many = Array.from({ length: 30 }, (_, i) => guest(`G${i}`, `Surname${String(i).padStart(2, "0")}`));

  it("leaves a list that fits as one artefact", () => {
    expect(artefactsOf(template(finder()), many.slice(0, 10), headers)).toHaveLength(1);
  });

  it("makes one artefact per page, each holding exactly what its page prints", () => {
    // One letter, 30 names: 2 columns × 10 lines, less the heading, is 19 a page.
    const parts = artefactsOf(template(finder()), many, headers);
    expect(parts.map((p) => p.rows.length)).toEqual([19, 11]);
    expect(parts.map((p) => p.label)).toEqual(["All 30 rows — page 1 of 2", "All 30 rows — page 2 of 2"]);
    expect(new Set(parts.map((p) => p.key)).size).toBe(2);
    expect(parts.flatMap((p) => p.rows)).toEqual([...many].sort((a, b) => a["Last Name"].localeCompare(b["Last Name"])));
  });

  it("keeps the artefact's own identity on every page, so a design tweak applies to all of them", () => {
    const parts = artefactsOf(template(finder()), many, headers);
    expect(new Set(parts.map((p) => p.rowId)).size).toBe(1);
  });

  it("leaves a design without a flowing grid alone", () => {
    expect(artefactsOf(template(finder({ layout: "cells" })), many, headers)).toHaveLength(1);
  });
});
