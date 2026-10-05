import { pageSizeMm } from "../units";
import type { Mm, Orientation, PaperName, Segment, Sheet, Size } from "../types";
import { offsetSheet } from "./duplex";

/**
 * A board printed at home: each full-size sheet cut into pieces of ordinary
 * paper, to trim and lay over one another.
 *
 * Each tile prints a view of the board inside a margin wide enough for any
 * home printer's unprintable border and for the tile's label. Neighbouring
 * windows overlap, so a tile trimmed along its left and top lines lays over its
 * neighbours' landing lines with the artwork continuing across the join.
 *
 * Pure geometry after imposition: it moves sheets, and adds lines. Neither
 * renderer knows tiling exists.
 */

/** Room for the printer's border and, along the foot, the label. */
export const TILE_MARGIN_MM = 10;
/** How far each tile runs under the next. */
export const TILE_OVERLAP_MM = 10;

export interface Tiled {
  sheets: Sheet[];
  /** One per tile, in order: which tile it is and how it goes together. */
  labels: string[];
}

export function tileSheets(sheets: Sheet[], paper: PaperName): Tiled {
  const out: Sheet[] = [];
  const labels: string[] = [];

  for (const sheet of sheets) {
    const { size, cols, rows } = bestGrid(sheet, paper);
    const view = { w: size.w - TILE_MARGIN_MM * 2, h: size.h - TILE_MARGIN_MM * 2 };
    const step = { w: view.w - TILE_OVERLAP_MM, h: view.h - TILE_OVERLAP_MM };
    const board = sheets.length > 1 ? `Board ${sheet.index + 1}, ` : "";

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const moved = offsetSheet(sheet, TILE_MARGIN_MM - col * step.w, TILE_MARGIN_MM - row * step.h);
        const name = `${String.fromCharCode(65 + row)}${col + 1}`;
        out.push({
          ...moved,
          index: out.length,
          pageWidthMm: size.w,
          pageHeightMm: size.h,
          guides: {
            ...moved.guides,
            cutLines: [...moved.guides.cutLines, ...joinLines(view, step, row, col, rows, cols)],
          },
        });
        labels.push(
          `${board}tile ${name} of ${rows} × ${cols}. Trim on the line at the left and top, and lay it over the line on the tile before.`,
        );
      }
    }
  }

  return { sheets: out, labels };
}

/** The paper turned whichever way takes fewer tiles; portrait when it is a tie. */
function bestGrid(sheet: Sheet, paper: PaperName): { size: Size; cols: number; rows: number } {
  const grids = (["portrait", "landscape"] as Orientation[]).map((orientation) => {
    const size = pageSizeMm(paper, orientation);
    const step = { w: size.w - TILE_MARGIN_MM * 2 - TILE_OVERLAP_MM, h: size.h - TILE_MARGIN_MM * 2 - TILE_OVERLAP_MM };
    return {
      size,
      cols: count(sheet.pageWidthMm, step.w),
      rows: count(sheet.pageHeightMm, step.h),
    };
  });
  return grids.reduce((best, grid) => (grid.cols * grid.rows < best.cols * best.rows ? grid : best));
}

/** Tiles of `step` needed to cover `length`, the last one carrying the overlap. */
function count(length: Mm, step: Mm): number {
  return Math.max(1, Math.ceil((length - TILE_OVERLAP_MM) / step));
}

/**
 * Where to trim and where to lay the next tile, in the tile's own coordinates:
 * a trim line on the window's left and top edges unless they are the board's,
 * and a landing line one overlap in from the right and bottom unless nothing
 * comes after.
 */
function joinLines(view: Size, step: Size, row: number, col: number, rows: number, cols: number): Segment[] {
  const left = TILE_MARGIN_MM;
  const top = TILE_MARGIN_MM;
  const right = left + view.w;
  const bottom = top + view.h;
  const vertical = (x: Mm): Segment => [
    { x, y: top },
    { x, y: bottom },
  ];
  const horizontal = (y: Mm): Segment => [
    { x: left, y },
    { x: right, y },
  ];

  const lines: Segment[] = [];
  if (col > 0) lines.push(vertical(left));
  if (row > 0) lines.push(horizontal(top));
  if (col < cols - 1) lines.push(vertical(left + step.w));
  if (row < rows - 1) lines.push(horizontal(top + step.h));
  return lines;
}
