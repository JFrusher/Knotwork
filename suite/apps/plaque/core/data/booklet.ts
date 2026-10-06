import type { CardElement, PageRole } from "../types";
import type { GuestRow } from "./rows";

/**
 * A booklet's pages as rows: one per page, each the wedding's facts plus which
 * page it is. Everything downstream — pagination, preview, warnings, export —
 * then sees ordinary artefacts, one per page, as it sees a finder's pages.
 */

/** The page's number, from 1 at the cover: printable as `{{Page}}`. */
export const PAGE_COLUMN = "Page";
/** cover, inside or back: which of the design's pages it is. */
export const PAGE_ROLE_COLUMN = "Page Role";
/** Which inside page, from 1: which page of the service it carries. Empty off the inside pages. */
export const INSIDE_PAGE_COLUMN = "Inside Page";

/**
 * A cover, `inside` pages, and a back, padded with inside pages to a multiple
 * of four: a sheet folded in half is four pages, so nothing else folds.
 */
export function bookletRows(facts: GuestRow, inside: number): { rows: GuestRow[]; rowIds: string[] } {
  const total = Math.ceil((inside + 2) / 4) * 4;
  const rows: GuestRow[] = Array.from({ length: total }, (_, index) => {
    const role: PageRole = index === 0 ? "cover" : index === total - 1 ? "back" : "inside";
    return {
      ...facts,
      [PAGE_COLUMN]: String(index + 1),
      [PAGE_ROLE_COLUMN]: role,
      [INSIDE_PAGE_COLUMN]: role === "inside" ? String(index) : "",
    };
  });
  return { rows, rowIds: rows.map((_, index) => `page-${index + 1}`) };
}

/** True when the element prints on this row's page: always, on anything that is not a booklet's page. */
export function onThisPage(el: Pick<CardElement, "page" | "onPages">, row: GuestRow): boolean {
  const role = row[PAGE_ROLE_COLUMN];
  if (!role) return true;
  if ((el.page ?? "inside") !== role) return false;
  return !el.onPages?.length || el.onPages.includes(Number(row[PAGE_COLUMN]));
}

/**
 * The pages in the order a sheet printed both sides and folded needs them:
 * for eight, 8|1 then 2|7 on the first sheet, 6|3 then 4|5 on the second.
 * Indices from 0, two to a side, outside of each sheet first.
 */
export function bookletOrder(pageCount: number): number[] {
  if (pageCount % 4 !== 0) throw new Error(`A folded booklet has a multiple of four pages, not ${pageCount}.`);
  const order: number[] = [];
  for (let s = 0; s < pageCount / 4; s++) {
    order.push(pageCount - 1 - 2 * s, 2 * s, 2 * s + 1, pageCount - 2 - 2 * s);
  }
  return order;
}
