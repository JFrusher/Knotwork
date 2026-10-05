import { interpolate } from "../csv/interpolate";
import { normalise } from "../data/artefacts";
import type { GuestRow } from "../data/rows";
import type { RoomScene, RoomTable, Template } from "../types";

/**
 * Chairs, by token: a design that names whoever sits in a seat rather than the
 * card's own guest.
 *
 * `{{At seat 3}}` is seat 3 of the card's own table — one design, every table
 * fills in its own. `{{Table 1, seat 3}}` is that one chair in the room. Both
 * say whoever sits there now, through the design's name format, and nothing for
 * an empty chair. A table where guests sit where they like has no seat 3, so
 * there they say nothing and the warning says why: a card must never imply a
 * seat that is not real.
 */

/** Seat `seat` of the card's own table (`table: null`), or of the table so named. */
export interface ChairRef {
  table: string | null;
  seat: number;
}

/** The whole name, when a design has not said otherwise. */
export const DEFAULT_CHAIR_NAME = "{{First Name}} {{Last Name}}";

const AT_SEAT = /^at seat (\d+)$/i;
const TABLE_SEAT = /^(.+?),\s*seat (\d+)$/i;

/** The chair a token names, or null when it is an ordinary column. */
export function chairRef(token: string): ChairRef | null {
  const at = AT_SEAT.exec(token.trim());
  if (at) return { table: null, seat: Number(at[1]) };
  const of = TABLE_SEAT.exec(token.trim());
  if (of) return { table: of[1]!.trim(), seat: Number(of[2]) };
  return null;
}

/** The token for a chair, as it is written into a design. */
export function chairToken(ref: ChairRef): string {
  return ref.table === null ? `At seat ${ref.seat}` : `${ref.table}, seat ${ref.seat}`;
}

/** How a design names a sitter: the name they are known by, else its format applied to their row. */
export function chairName(template: Pick<Template, "chairName">, row: GuestRow): string {
  return row["Known As"] || interpolate(template.chairName ?? DEFAULT_CHAIR_NAME, row).text;
}

/**
 * A row as a design prints it: `{{Known As}}` is the name the guest is known
 * by, else the design's name format applied to them. Every card and every
 * reprint check reads rows through this, so the two cannot disagree.
 */
export function asKnown(template: Pick<Template, "chairName">, row: GuestRow): GuestRow {
  return { ...row, "Known As": chairName(template, row) };
}

/** The table a chair is at: the card's own, or the one named. */
export function chairTable(ref: ChairRef, scene: RoomScene, cardTable: string): RoomTable | null {
  const wanted = normalise(ref.table ?? cardTable);
  return scene.tables.find((t) => normalise(t.label) === wanted) ?? null;
}

/**
 * Each chair token in `tokens`, as the card for `row` says it. A table-wise
 * seat past the end of a smaller table is simply empty — one design serves
 * tables of every size; anything else that cannot be said comes back as a
 * problem, once.
 */
export function chairValues(
  tokens: string[],
  row: GuestRow,
  scene: RoomScene | null,
  template: Pick<Template, "chairName">,
): { values: GuestRow; problems: string[] } {
  const values: GuestRow = {};
  const problems: string[] = [];
  for (const token of tokens) {
    const ref = chairRef(token);
    if (!ref) continue;
    values[token] = "";
    if (!scene) {
      problems.push("There is no seating plan to read the chairs from yet.");
      continue;
    }
    const table = chairTable(ref, scene, row["Table"] ?? "");
    if (!table) {
      problems.push(
        ref.table === null
          ? row["Table"]
            ? `The plan has no table called "${row["Table"]}".`
            : "This card is not for a table, so it has no seats."
          : `The plan has no table called "${ref.table}".`,
      );
      continue;
    }
    if (!table.numbered) {
      // Said once for a design, not once per table card: the same words for
      // every table that leaves its guests to sit where they like.
      problems.push(
        ref.table === null
          ? "At tables where guests sit where they like there are no numbered seats, so a seat says nothing there."
          : `${table.label} seats its guests where they like, so it has no seat ${ref.seat}.`,
      );
      continue;
    }
    const seat = table.seats[ref.seat - 1];
    if (!seat) {
      if (ref.table !== null) problems.push(`${table.label} has ${table.seats.length === 1 ? "one seat" : `${table.seats.length} seats`}, so there is no seat ${ref.seat}.`);
      continue;
    }
    if (seat.row) values[token] = chairName(template, seat.row);
  }
  return { values, problems: [...new Set(problems)] };
}
