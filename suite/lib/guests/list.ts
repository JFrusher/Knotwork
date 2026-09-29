import type { Trousseau } from "@jfrusher/trousseau";
import { dietaryText, type DietaryKey } from "@/lib/model/dietary";
import { guestName, readGuests, readSeating } from "@/lib/model/slices";
import type { Guest, RsvpStatus, Side } from "@/lib/model/types";

/** One guest as the Guests page shows them: the facts, joined to the room. */
export interface GuestRow {
  guest: Guest;
  name: string;
  /** The table's label, or "" for nobody's table yet. */
  table: string;
  /** What they said about food, in their words. */
  dietary: string;
  /** "Guest of Ada Byron", "Brings Alan Turing", or "". */
  plusOne: string;
}

export function guestRows(doc: Trousseau): GuestRow[] {
  const guests = readGuests(doc);
  const tables = readSeating(doc).tables;
  const brings = new Map<string, string[]>();
  for (const guest of Object.values(guests)) {
    if (guest.plusOneOf && guests[guest.plusOneOf]) {
      brings.set(guest.plusOneOf, [...(brings.get(guest.plusOneOf) ?? []), guestName(guest)]);
    }
  }
  return Object.values(guests).map((guest) => {
    const host = guest.plusOneOf ? guests[guest.plusOneOf] : undefined;
    const guestsOf = brings.get(guest.id);
    return {
      guest,
      name: guestName(guest),
      table: guest.assignedTableId ? (tables[guest.assignedTableId]?.label ?? "") : "",
      dietary: dietaryText(guest),
      plusOne: host ? `Guest of ${guestName(host)}` : guestsOf ? `Brings ${guestsOf.join(", ")}` : "",
    };
  });
}

export interface ListFilter {
  /** Matched against name, table, dietary words and tags. */
  text: string;
  reply: RsvpStatus | "all";
  side: Side | "all";
  /** A table's id, "none" for nobody's table yet, or "all". */
  table: string;
  /** A requirement, "any" for anyone with one, or "all". */
  dietary: DietaryKey | "any" | "all";
}

export const NO_FILTER: ListFilter = { text: "", reply: "all", side: "all", table: "all", dietary: "all" };

export type SortKey = "name" | "reply" | "side" | "dietary" | "table";

export interface ListSort {
  key: SortKey;
  direction: "ascending" | "descending";
}

const compare = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });

/** Replies in the order they need attention: not yet, then yes, then no. */
const REPLY_ORDER: Record<RsvpStatus, number> = { pending: 0, confirmed: 1, declined: 2 };

function matches(row: GuestRow, filter: ListFilter): boolean {
  const { guest } = row;
  if (filter.reply !== "all" && guest.rsvpStatus !== filter.reply) return false;
  if (filter.side !== "all" && guest.side !== filter.side) return false;
  if (filter.table === "none" && guest.assignedTableId !== null) return false;
  if (filter.table !== "all" && filter.table !== "none" && guest.assignedTableId !== filter.table) return false;
  if (filter.dietary === "any" && guest.dietary === "") return false;
  if (filter.dietary !== "all" && filter.dietary !== "any" && guest.dietary !== filter.dietary) return false;
  const text = filter.text.trim().toLowerCase();
  if (text === "") return true;
  return [row.name, row.table, row.dietary, ...guest.tags].some((field) => field.toLowerCase().includes(text));
}

function byKey(key: SortKey): (a: GuestRow, b: GuestRow) => number {
  switch (key) {
    case "name":
      return (a, b) => compare(a.name, b.name);
    case "reply":
      return (a, b) => REPLY_ORDER[a.guest.rsvpStatus] - REPLY_ORDER[b.guest.rsvpStatus];
    case "side":
      return (a, b) => compare(a.guest.side, b.guest.side);
    case "dietary":
      return (a, b) => compare(a.dietary, b.dietary);
    case "table":
      return (a, b) => compare(a.table, b.table);
  }
}

/**
 * The rows the filter lets through, in the order asked for. Blanks — no table,
 * no requirement, no side — go last whichever way round, because the ones with
 * an answer are what a sort is for; ties fall back to the name.
 */
export function shownRows(rows: readonly GuestRow[], filter: ListFilter, sort: ListSort): GuestRow[] {
  const sign = sort.direction === "ascending" ? 1 : -1;
  const primary = byKey(sort.key);
  const blank = (row: GuestRow) =>
    sort.key === "table" ? row.table === "" : sort.key === "dietary" ? row.dietary === "" : sort.key === "side" ? row.guest.side === "" : false;
  return rows
    .filter((row) => matches(row, filter))
    .sort((a, b) => {
      const blanks = Number(blank(a)) - Number(blank(b));
      if (blanks !== 0) return blanks;
      return sign * primary(a, b) || compare(a.name, b.name);
    });
}
