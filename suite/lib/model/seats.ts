import type { Knotwork } from "@jfrusher/knotwork";
import { cached, readSeating } from "./slices";
import type { Seating } from "./types";

/** Where one guest sits, as everything printed or shared says it. */
export interface SeatAt {
  tableId: string;
  /** The table's label as printed on the plan. */
  table: string;
  /** 1-based, in the table's own order. Null where guests choose their own seat. */
  seat: number | null;
  /** The table's place among all tables, ordered by label as people read them: 2 before 10. */
  tableNumber: number;
  /** How many are seated at the table. */
  tableSize: number;
}

/**
 * Every seated guest's place, by guest id.
 *
 * The one reading of the seating plan that the guest link, the place cards and
 * the boards share, so a card cannot say seat 7 where the link says seat 6. The
 * seat is the index in `assignedGuestIds`, and only on a table set to number its
 * seats — anywhere else the guests choose their own.
 */
export function seatsOf(seating: Seating): Map<string, SeatAt> {
  const tables = Object.values(seating.tables).sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true }),
  );
  const out = new Map<string, SeatAt>();
  tables.forEach((table, index) => {
    const tableSize = table.assignedGuestIds.filter((id) => id !== null).length;
    table.assignedGuestIds.forEach((id, seatIndex) => {
      if (id === null) return;
      out.set(id, {
        tableId: table.id,
        table: table.label,
        seat: table.seatMode === "seat" ? seatIndex + 1 : null,
        tableNumber: index + 1,
        tableSize,
      });
    });
  });
  return out;
}

/** `seatsOf` for a whole wedding, once per document. */
export function readSeats(doc: Knotwork): Map<string, SeatAt> {
  return cached(doc, "seats", () => seatsOf(readSeating(doc)));
}
