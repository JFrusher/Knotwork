import type { RowIssue, GuestRow } from "../core/data/rows";
import { defaultCard, defaultSheet } from "../core/template/defaults";
import type { CardSpec, SheetSpec, Template } from "../core/types";
import { FIRST_PIECE } from "./suite";

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

/** What each piece has of its own. Everything else in a `Design` is shared by the suite. */
export const PIECE_KEYS = [
  "card",
  "sheet",
  "template",
  "headers",
  "rows",
  "rowIds",
  "merged",
  "csvIssues",
  "fileName",
] as const satisfies readonly (keyof Design)[];

export type PieceDesign = Pick<Design, (typeof PIECE_KEYS)[number]>;
export type SharedDesign = Omit<Design, (typeof PIECE_KEYS)[number]>;

/** One printed thing — place cards, table numbers, the seating board. */
export interface Piece extends PieceDesign {
  id: string;
  name: string;
}

/** The stationery slice: the pieces in order, and what they share. */
export interface Suite extends SharedDesign {
  pieces: Piece[];
}

/** A wedding's stationery before anything is made: one empty set of place cards. */
export function initialSuite(): Suite {
  const { pieces: _none, ...shared } = splitDesign(initialDesign());
  return { ...shared, pieces: [newPiece(FIRST_PIECE.id, FIRST_PIECE.name)] };
}

/** An empty piece. */
export function newPiece(id: string, name: string): Piece {
  return { id, name, ...splitDesign(initialDesign()).pieces[0]! };
}

/** The flat view the editor works on: one piece, with what every piece shares. */
export function designFor(suite: Suite, pieceId: string): Design {
  const piece = suite.pieces.find((p) => p.id === pieceId);
  if (!piece) throw new Error(`No piece "${pieceId}" in the stationery.`);
  const { pieces: _pieces, ...shared } = suite;
  const { id: _id, name: _name, ...own } = piece;
  return { ...shared, ...own };
}

/** The suite with `design` written back as piece `pieceId`, and as what the pieces share. */
export function withDesign(suite: Suite, pieceId: string, design: Design): Suite {
  if (!suite.pieces.some((p) => p.id === pieceId)) throw new Error(`No piece "${pieceId}" in the stationery.`);
  const { pieces: [own], ...shared } = splitDesign(design);
  return {
    ...shared,
    pieces: suite.pieces.map((p) => (p.id === pieceId ? { id: p.id, name: p.name, ...own! } : p)),
  };
}

function splitDesign(design: Design): { pieces: [PieceDesign] } & SharedDesign {
  const own = Object.fromEntries(PIECE_KEYS.map((key) => [key, design[key]])) as unknown as PieceDesign;
  const shared = Object.fromEntries(
    DESIGN_KEYS.filter((key) => !(PIECE_KEYS as readonly string[]).includes(key)).map((key) => [key, design[key]]),
  ) as unknown as SharedDesign;
  return { ...shared, pieces: [own] };
}
