import type { Knotwork } from "@jfrusher/knotwork";
import { cached, guestName, isComing, readGuests } from "@/lib/model/slices";
import { readSeats } from "@/lib/model/seats";
import { dietaryText } from "@/lib/model/dietary";
import { sideLabel } from "@/lib/model/partners";
import type { RowIssue, GuestRow } from "../core/data/rows";
import { chairName } from "../core/template/chairs";
import type { Template } from "../core/types";

/**
 * The guest list Place cards prints from: the room, and nothing else, read
 * fresh from the wedding every time it changes.
 *
 * Stationery started as Plaque, a standalone app, so the only way in was a CSV exported from
 * somewhere else — and a CSV exported before the last three people moved
 * prints three wrong tables. Here the wedding already holds the list, and
 * every table number on those cards is a fact this app already has. Nothing is
 * copied, so there is nothing to go stale.
 *
 * Going through the file shape rather than around it is deliberate. Stationery's
 * whole design is built on columns — you bind `{{First Name}}` to a text
 * element and it prints once per row — so handing it rows is handing it
 * something it already knows exactly what to do with.
 */

/** The columns a card can bind, and the only ones. */
export const ROOM_COLUMNS = [
  "First Name",
  "Last Name",
  "Name",
  "Known As",
  "Initial",
  "Last Initial",
  "Table",
  "Table Number",
  "Table Size",
  "Seat",
  "Place",
  "Dietary",
  "Side",
  "Guest Link",
] as const;

interface RoomRows {
  headers: string[];
  rows: GuestRow[];
  /** Guest ids, one per row: what per-guest tweaks and combined cards hang off. */
  rowIds: string[];
  issues: RowIssue[];
}

/** The wedding's guests as rows, once per document. */
export function roomRows(doc: Knotwork): RoomRows {
  return cached(doc, "stationery.roomRows", () => build(doc));
}

function build(doc: Knotwork): RoomRows {
  const seats = readSeats(doc);

  // Somebody who said they are not coming is not at the wedding — no card,
  // and not a guest "with no table yet". The guest link keeps the same rule.
  const people = Object.values(readGuests(doc))
    .filter(isComing)
    .sort((a, b) => guestName(a).localeCompare(guestName(b), "en"));

  const rows: GuestRow[] = people.map((guest) => {
    const at = seats.get(guest.id);
    return {
      "First Name": guest.firstName,
      "Last Name": guest.lastName,
      Name: guestName(guest),
      // Their own name for the stationery, which a design's name format gives way to.
      "Known As": guest.knownAs,
      // What a finder groups by: the surname's letter, or the first name's for
      // someone listed by one name.
      Initial: (guest.lastName.trim() || guest.firstName.trim()).charAt(0).toLocaleUpperCase("en"),
      // "B." for Ada Byron, and nothing for someone known by one name: never a first name's letter.
      "Last Initial": guest.lastName.trim() ? `${guest.lastName.trim().charAt(0).toLocaleUpperCase("en")}.` : "",
      Table: at?.table ?? "",
      "Table Number": at ? String(at.tableNumber) : "",
      "Table Size": at ? String(at.tableSize) : "",
      Seat: at?.seat ? String(at.seat) : "",
      // Where to go, in one phrase that reads right whether or not the table numbers its seats.
      Place: at ? (at.seat ? `${at.table}, seat ${at.seat}` : at.table) : "",
      // What the guest said, so the card reads "Coeliac" rather than "gluten-free".
      Dietary: dietaryText(guest),
      // "Alex’s side", as everywhere else — the stored "a" means nothing on a card.
      Side: sideLabel(guest.side, doc.event),
      // Not the room's to know: the store fills it in once a link is published.
      "Guest Link": "",
    };
  });

  /**
   * Someone with no table gets a card with an empty table line rather than no
   * card. That is the right way round: an unseated guest is a job still to do,
   * and a card that silently went missing is how somebody arrives to no place
   * at all. Said once, as a count, rather than once per person.
   */
  const unseated = people.filter((guest) => !seats.has(guest.id)).length;
  const issues: RowIssue[] =
    unseated === 0
      ? []
      : [
          {
            row: null,
            message:
              unseated === 1
                ? "One guest has no table yet, so their card has no table on it."
                : `${unseated} guests have no table yet, so their cards have no table on them.`,
          },
        ];

  return { headers: [...ROOM_COLUMNS], rows, rowIds: people.map((guest) => guest.id), issues };
}

/**
 * Guests printed together on one card, by the combined card's id: "Ada & Grace".
 * Stored as guest ids, so a combined card follows its people through the room.
 */
export type Merged = Record<string, string[]>;

/**
 * The room's rows with each combined card in place of its people, at the first
 * of them. Distinct values are joined in order: "Ada & Grace" for the names,
 * "Table 4" once for the table they share. A member who has left the list is
 * left out of the card; a card none of whose people remain is dropped.
 */
export function withMerges(
  room: RoomRows,
  merged: Merged,
  design: Pick<Template, "chairName">,
): Pick<RoomRows, "rows" | "rowIds"> {
  const cardOf = new Map<string, string>();
  for (const [cardId, members] of Object.entries(merged)) {
    for (const member of members) cardOf.set(member, cardId);
  }
  if (cardOf.size === 0) return { rows: room.rows, rowIds: room.rowIds };

  const rowAt = new Map(room.rowIds.map((id, index) => [id, room.rows[index]!]));
  const rows: GuestRow[] = [];
  const rowIds: string[] = [];
  const placed = new Set<string>();
  room.rowIds.forEach((id, index) => {
    const cardId = cardOf.get(id);
    if (!cardId) {
      rows.push(room.rows[index]!);
      rowIds.push(id);
      return;
    }
    if (placed.has(cardId)) return;
    placed.add(cardId);
    const members = merged[cardId]!.map((member) => rowAt.get(member)).filter((row): row is GuestRow => Boolean(row));
    const combined: GuestRow = {};
    for (const header of room.headers) {
      combined[header] = [...new Set(members.map((row) => row[header]).filter(Boolean))].join(" & ");
    }
    // One of them known by a name of their own: name each of them as the
    // design names guests, or the card would say only that one ("Granny Jo"
    // for Granny Jo and Eleanor).
    if (members.some((row) => row["Known As"])) {
      combined["Known As"] = members.map((row) => chairName(design, row)).join(" & ");
    }
    rows.push(combined);
    rowIds.push(cardId);
  });
  return { rows, rowIds };
}
