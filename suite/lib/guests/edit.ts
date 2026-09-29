import { applyPatch } from "@/apps/tableaux/store/patch.js";
import { assignGuest, unassignGuest, updateGuest } from "@/apps/tableaux/store/actions.js";
import { normaliseDietary } from "@/lib/model/dietary";
import type { RsvpStatus, Side } from "@/lib/model/types";
import { removeGuests } from "@/lib/seating/removeGuests";

/**
 * Changes the Guests page makes, as Seating makes them.
 *
 * Seating already knows what moving somebody means — the guest's table and
 * the table's list change together, a seat-level table keeps its holes, the
 * occupant of a taken seat is moved off it — and saying it twice is how a
 * guest and a table come to disagree. So these run Seating's own commands,
 * over the slices as stored, and hand the slices back. Stored rather than
 * read through the suite's typed readers, which rebuild records from the
 * fields they know and would drop the ones only Seating uses.
 */

type Raw = Record<string, unknown>;

/** The two slices a guest lives in: the list, and the room they are seated in. */
export interface GuestSlices {
  guests: Raw;
  seating: Raw;
}

interface Command {
  payload: Raw;
}
type Action = (state: Raw) => Command | null;

function run(slices: GuestSlices, actions: Action[]): GuestSlices {
  // Seating's document is the room with the guests in it.
  let state: Raw = { ...slices.seating, guests: slices.guests };
  for (const action of actions) {
    const command = action(state);
    if (command) state = { ...state, ...applyPatch(state, command.payload) };
  }
  const { guests, ...seating } = state;
  return { guests: guests as Raw, seating };
}

/** What can be set on many guests at once, and on one. */
export type GuestChange =
  | { rsvpStatus: RsvpStatus }
  | { side: Side }
  /** In the guest's own words; the requirement is read from them, as Seating does. */
  | { dietaryRaw: string }
  | { addTag: string }
  | { removeTag: string };

function patchFor(change: GuestChange, guest: Raw): Raw {
  if ("dietaryRaw" in change) return { dietaryRaw: change.dietaryRaw, dietary: normaliseDietary(change.dietaryRaw) };
  const tags = Array.isArray(guest["tags"]) ? (guest["tags"] as string[]) : [];
  if ("addTag" in change) return { tags: tags.includes(change.addTag) ? tags : [...tags, change.addTag] };
  if ("removeTag" in change) return { tags: tags.filter((tag) => tag !== change.removeTag) };
  return change;
}

export function changeGuests(slices: GuestSlices, ids: readonly string[], change: GuestChange): GuestSlices {
  return run(
    slices,
    ids.map((id) => (state: Raw) => {
      const guest = (state["guests"] as Raw)[id];
      return guest ? updateGuest(id, patchFor(change, guest as Raw))(state) : null;
    }),
  );
}

/** Seat them at a table, or with `null` take them off whichever they are at. */
export function seatGuests(slices: GuestSlices, ids: readonly string[], tableId: string | null): GuestSlices {
  return run(
    slices,
    ids.map((id) => (tableId === null ? unassignGuest(id) : assignGuest(id, tableId))),
  );
}

/** Off the list, and out of everything that points at them. */
export function dropGuests(slices: GuestSlices, ids: readonly string[]): GuestSlices {
  return removeGuests(slices.guests, slices.seating, new Set(ids));
}
