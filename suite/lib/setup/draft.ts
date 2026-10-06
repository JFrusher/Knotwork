import { applyImport, planImport } from "@/lib/data/guestImport";
import type { CsvTable } from "@/lib/data/csv";
import type { Guest } from "@/lib/model/types";
// Seating's own table-making, so a starting room is made of exactly the
// tables Seating would have made by hand.
import { addTable } from "@/apps/tableaux/store/actions";
import { applyPatch } from "@/apps/tableaux/store/patch";
import { normalizePlan } from "@/apps/tableaux/store/plan";
import type { Plan } from "@/apps/tableaux/store/types";

/**
 * What setup builds before anything is written: the pieces it commits as one
 * change. Pure, so each can be checked without a page.
 */

export type StartingTable = "round" | "banquet";

/** Seats per table, as Seating's palette makes them. */
export const SEATS: Record<StartingTable, number> = { round: 8, banquet: 16 };

/**
 * Rows across the room Seating starts with (1200 × 900 canvas pixels), spaced
 * from what Seating actually draws: a round of eight with its chairs is about
 * 174px across, a long table of sixteen 264 × 74 with a row of chairs above
 * and below. Closer than this, the chairs of neighbouring tables collide —
 * as they do at the example wedding's 160px.
 */
const GRID: Record<StartingTable, { x0: number; y0: number; dx: number; dy: number; cols: number }> = {
  round: { x0: 150, y0: 150, dx: 200, dy: 210, cols: 5 },
  banquet: { x0: 200, y0: 130, dx: 320, dy: 180, cols: 3 },
};
const ROOM = { width: 1200, height: 900 };

/** Enough tables of a kind for everyone on the list. */
export function tablesFor(guests: number, type: StartingTable): number {
  return Math.max(1, Math.ceil(guests / SEATS[type]));
}

/** A room laid out with `count` tables, taller than Seating's default if they need it. */
export function startingRoom(seating: Record<string, unknown>, type: StartingTable, count: number): Record<string, unknown> {
  const grid = GRID[type];
  // As Seating would read the draft, so the tables are the ones it would add.
  let plan = normalizePlan(seating as Partial<Plan>);
  for (let i = 0; i < count; i += 1) {
    const x = grid.x0 + (i % grid.cols) * grid.dx;
    const y = grid.y0 + Math.floor(i / grid.cols) * grid.dy;
    const command = addTable({ type, x, y })(plan);
    if (!command) throw new Error("Seating would not add a starting table.");
    plan = { ...plan, ...applyPatch(plan, command.payload) };
  }
  const rows = Math.ceil(count / grid.cols);
  const height = Math.max(ROOM.height, grid.y0 + rows * grid.dy);
  return { ...seating, tables: plan.tables, room: { ...ROOM, height } };
}

/** One name per line, as a one-column file, so pasting runs the importer's own rules. */
function pastedList(text: string): CsvTable {
  const names = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return { headers: ["Name"], rows: names.map((Name) => ({ Name })) };
}

/** The pasted names added to a list: nobody duplicated, nobody removed. */
export function withPasted(
  text: string,
  guests: Record<string, Guest>,
  seating: unknown,
): Record<string, unknown> {
  const mapping = {
    firstName: null,
    lastName: null,
    fullName: "Name",
    email: null,
    rsvp: null,
    dietary: null,
    entree: null,
    side: null,
    notes: null,
  };
  const plan = planImport(pastedList(text), mapping, { rsvp: {}, side: {} }, guests);
  return applyImport(plan, { add: new Set(), remove: new Set() }, seating).guests;
}
