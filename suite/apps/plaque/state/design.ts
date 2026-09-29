import type { RowIssue, GuestRow } from "../core/data/rows";
import { defaultCard, defaultSheet } from "../core/template/defaults";
import type { CardSpec, SheetSpec, Template } from "../core/types";

/**
 * What of Place cards is the wedding's: the stationery slice. Everything
 * else in Plaque's store — fonts, images, printers, what is selected, which
 * page — belongs to this window.
 *
 * Guest data is included deliberately: losing a hundred and fifty names to an
 * accidental tab close is the worst papercut this app could have.
 */
export interface Design {
  card: CardSpec;
  sheet: SheetSpec;
  template: Template;
  headers: string[];
  rows: GuestRow[];
  /** Row identity and combines, without which per-row overrides lose their anchor. */
  rowIds: string[];
  merged: Record<string, { indexes: number[]; ids: string[]; rows: GuestRow[] }>;
  csvIssues: RowIssue[];
  fileName: string | null;
  uploadedIcons: Record<string, string>;
  /** Filenames of uploaded assets, so a lost blob can still be named (S-D1.4). */
  assetNames: Record<string, string>;
  snapEnabled: boolean;
  /** Workspace layout, not design: which pane the user last chose to see. */
  sheetCollapsed: boolean;
}

export const DESIGN_KEYS = [
  "card",
  "sheet",
  "template",
  "headers",
  "rows",
  "rowIds",
  "merged",
  "csvIssues",
  "fileName",
  "uploadedIcons",
  "assetNames",
  "snapEnabled",
  "sheetCollapsed",
] as const satisfies readonly (keyof Design)[];

/**
 * The starting design has an EMPTY template on purpose. Building a default
 * template before any CSV exists would produce elements bound to columns that
 * do not exist, and would then block `setCsv` from laying out a real one.
 */
export function initialDesign(): Design {
  return {
    card: defaultCard(),
    sheet: defaultSheet(),
    template: { elements: [], backgroundHex: null },
    headers: [],
    rows: [],
    rowIds: [],
    merged: {},
    csvIssues: [],
    fileName: null,
    uploadedIcons: {},
    assetNames: {},
    snapEnabled: true,
    sheetCollapsed: false,
  };
}

/** Just the design, from anything that carries it. */
export function designOf(source: Design): Design {
  return Object.fromEntries(DESIGN_KEYS.map((key) => [key, source[key]])) as unknown as Design;
}
