import { interpolate } from "../csv/interpolate";
import type { GuestRow } from "../data/rows";
import { ptToMm } from "../units";
import type { GridElement, Mm } from "../types";

export interface GridBlock {
  heading: string;
  /** The rows with a line to print, in the order they print. */
  rows: GuestRow[];
  lines: string[];
}

/**
 * A grid's blocks: rows grouped by its column, the groups in the order people
 * read their names (Table 2 before Table 10, A before B), the lines in each
 * ordered by `sortBy` and then by the room's own order. A row with nothing in
 * the column is left out and counted; a row whose line comes out empty has
 * nothing to print and is dropped.
 */
export function gridBlocks(
  el: Pick<GridElement, "groupBy" | "headingTemplate" | "itemTemplate" | "sortBy">,
  rows: GuestRow[],
): { blocks: GridBlock[]; leftOut: number; missing: string[] } {
  const groups = new Map<string, GuestRow[]>();
  let leftOut = 0;
  for (const row of rows) {
    const value = (row[el.groupBy] ?? "").trim();
    if (!value) {
      leftOut += 1;
      continue;
    }
    groups.set(value, [...(groups.get(value) ?? []), row]);
  }

  const missing = new Set<string>();
  const fill = (template: string, row: GuestRow) => {
    const { text, missing: names } = interpolate(template, row);
    for (const name of names) missing.add(name);
    return text;
  };
  const byColumn = (a: GuestRow, b: GuestRow) =>
    el.sortBy ? (a[el.sortBy] ?? "").localeCompare(b[el.sortBy] ?? "", "en", { sensitivity: "base" }) : 0;

  const blocks = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([, members]) => {
      const printed = [...members]
        .sort(byColumn)
        .map((row) => ({ row, line: fill(el.itemTemplate, row) }))
        .filter(({ line }) => line.trim().length > 0);
      return {
        heading: fill(el.headingTemplate, members[0]!),
        rows: printed.map(({ row }) => row),
        lines: printed.map(({ line }) => line),
      };
    });
  return { blocks, leftOut, missing: [...missing] };
}

/**
 * Where everything in a `columns` grid goes, from line heights alone.
 *
 * Arithmetic only — no font — so the same plan decides both how a long list is
 * cut into pages (`withParts`) and where each line lands on each page
 * (`resolveCard`), and the two cannot disagree.
 *
 * Blocks stack down a column, a gap above each heading but the column's first;
 * a heading never sits alone at the foot of a column; a block too long for
 * what is left carries on at the top of the next column, then the next page.
 */
export interface FlowRun {
  page: number;
  column: number;
  /** From the top of the grid's box. */
  y: Mm;
  block: number;
  /** The heading, then these lines of the block, `from` inclusive, `to` exclusive. */
  heading: boolean;
  from: number;
  to: number;
}

type FlowSpec = Pick<GridElement, "h" | "columns" | "gapMm" | "fontSizePt" | "headingScale" | "lineHeight">;

/**
 * The plan. A list that fits on one page is balanced — laid out in the
 * shortest columns that still hold it — so it does not fill two columns and
 * leave the third bare; a longer one fills each page in turn.
 */
export function flowPlan(el: FlowSpec, counts: number[]): FlowRun[] {
  const full = flowInto(el, counts);
  if (pagesIn(full) > 1) return full;
  let low = 0;
  let high = el.h;
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2;
    if (pagesIn(flowInto({ ...el, h: mid }, counts)) === 1) high = mid;
    else low = mid;
  }
  return flowInto({ ...el, h: high }, counts);
}

function pagesIn(runs: FlowRun[]): number {
  return Math.max(0, ...runs.map((run) => run.page)) + 1;
}

function flowInto(el: FlowSpec, counts: number[]): FlowRun[] {
  const lineH = ptToMm(el.fontSizePt * el.lineHeight);
  const headingH = ptToMm(el.fontSizePt * el.headingScale * el.lineHeight);
  const columns = Math.max(1, Math.round(el.columns));
  const runs: FlowRun[] = [];

  let page = 0;
  let column = 0;
  let y = 0;
  const nextColumn = () => {
    column += 1;
    if (column === columns) {
      column = 0;
      page += 1;
    }
    y = 0;
  };
  const fits = (height: Mm) => y + height <= el.h + 1e-6;

  counts.forEach((count, block) => {
    if (y > 0) y += el.gapMm;
    // A heading needs at least its first line under it, or it moves on.
    if (y > 0 && !fits(headingH + Math.min(1, count) * lineH)) nextColumn();
    let heading = true;
    let from = 0;
    while (from < count || heading) {
      const top = y;
      if (heading) y += headingH;
      let to = from;
      while (to < count && fits(lineH)) {
        y += lineH;
        to += 1;
      }
      // Nothing placed in an empty column means a line taller than the box:
      // place it anyway rather than looping, and let the fit report it.
      if (to === from && !heading && top === 0) {
        y += lineH;
        to += 1;
      }
      runs.push({ page, column, y: top, block, heading, from, to });
      heading = false;
      from = to;
      if (from < count) nextColumn();
    }
  });
  return runs;
}
