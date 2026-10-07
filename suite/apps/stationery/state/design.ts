import { defaultCard, defaultSheet, defaultTemplate } from "../core/template/defaults";
import type { Booklet, CardSpec, SheetSpec, Template } from "../core/types";
import { ROOM_COLUMNS, type Merged } from "./fromRoom";
import { FIRST_PIECE } from "./suite";
import type { Printed } from "./printed";

/**
 * What of Place cards is the wedding's: the stationery slice. Everything
 * else in Stationery's store — fonts, images, printers, what is selected, which
 * page — belongs to this window.
 *
 * No guest data: every piece prints from the room as it stands, so a copy of
 * the list here could only ever be a stale one. What is kept is who shares a
 * card, by guest id, which the room cannot know.
 */
export interface Design {
  card: CardSpec;
  sheet: SheetSpec;
  template: Template;
  /** Set when this piece is a booklet — the order of service — and how it is printed. */
  booklet: Booklet | null;
  /** Guests printed together on one card. See `withMerges`. */
  merged: Merged;
  /** What this piece last went to the printer as, or null if it never has. */
  printed: Printed | null;
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
  "booklet",
  "merged",
  "printed",
  "uploadedIcons",
  "assetNames",
  "snapEnabled",
  "sheetCollapsed",
] as const satisfies readonly (keyof Design)[];

/** A blank design: nothing on the card yet. */
export function initialDesign(): Design {
  return {
    card: defaultCard(),
    sheet: defaultSheet(),
    template: { elements: [], backgroundHex: null },
    booklet: null,
    merged: {},
    printed: null,
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
const PIECE_KEYS = ["card", "sheet", "template", "booklet", "merged", "printed"] as const satisfies readonly (keyof Design)[];

type PieceDesign = Pick<Design, (typeof PIECE_KEYS)[number]>;
type SharedDesign = Omit<Design, (typeof PIECE_KEYS)[number]>;

/** One printed thing — place cards, table numbers, the seating board. */
export interface Piece extends PieceDesign {
  id: string;
  name: string;
}

/** The stationery slice: the pieces in order, and what they share. */
export interface Suite extends SharedDesign {
  pieces: Piece[];
}

/**
 * A wedding's stationery before anything is made: place cards, laid out for
 * the room's columns so the first thing anyone sees is a card with a name on it.
 */
export function initialSuite(): Suite {
  const { pieces: _none, ...shared } = splitDesign(initialDesign());
  const placeCards = newPiece(FIRST_PIECE.id, FIRST_PIECE.name);
  return { ...shared, pieces: [{ ...placeCards, template: defaultTemplate([...ROOM_COLUMNS], placeCards.card) }] };
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
