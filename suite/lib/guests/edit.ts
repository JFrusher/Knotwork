import { applyPatch } from "@/apps/tableaux/store/patch";
import { assignGuest, removeGuests, unassignGuest, updateGuest } from "@/apps/tableaux/store/actions";
import { emptyPlan, SEATING_KEYS } from "@/apps/tableaux/store/plan";
import type { Action, Guest, Plan } from "@/apps/tableaux/store/types";
import { normaliseDietary } from "@/lib/model/dietary";
import type { RsvpStatus, Side } from "@/lib/model/types";

/**
 * Changes the Guests page makes, as Seating makes them.
 *
 * Seating already knows what moving somebody means — the guest's table and
 * the table's list change together, a seat-level table keeps its holes, the
 * occupant of a taken seat is moved off it — and saying it twice is how a
 * guest and a table come to disagree. So these run Seating's own commands,
 * over the slices as stored, and hand the slices back.
 *
 * As stored, not as Seating reads them: this page changes what it means to
 * and nothing else. A room Seating would tidy on its next edit is left as it
 * is, and a guest nobody touched is not rewritten.
 */

type Raw = Record<string, unknown>;

/** The two slices a guest lives in: the list, and the room they are seated in. */
export interface GuestSlices {
  guests: Raw;
  seating: Raw;
}

function run(slices: GuestSlices, actions: Action[]): GuestSlices {
  // Seating's plan is the room with the guests in it: whatever the room is
  // missing reads as empty, and nothing it has is rebuilt.
  const before: Plan = { ...emptyPlan(), ...(slices.seating as Partial<Plan>), guests: slices.guests as Record<string, Guest> };
  let plan = before;
  for (const action of actions) {
    const command = action(plan);
    if (command) plan = { ...plan, ...applyPatch(plan, command.payload) };
  }
  // Only the parts a command changed go back; every other one is as stored.
  const seating: Raw = { ...slices.seating };
  for (const key of SEATING_KEYS) if (plan[key] !== before[key]) seating[key] = plan[key];
  return { guests: plan.guests, seating };
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
    ids.map((id): Action => (plan) => {
      const guest = plan.guests[id];
      return guest ? updateGuest(id, patchFor(change, guest as unknown as Raw) as Partial<Guest>)(plan) : null;
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
  return run(slices, [removeGuests(ids)]);
}
