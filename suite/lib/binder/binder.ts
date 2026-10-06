import type { Knotwork } from "@jfrusher/knotwork";
import { dayPlaces, guestName, isComing, readBoxes, readCast, readCeremony, readCrew, readGuests, readSeating, readTimeline, resolvedDay } from "@/lib/model/slices";
import { resolveMembers } from "@/lib/cast/resolve";
import { songName } from "@/lib/ceremony/music";
import { hiddenToolIds } from "@/lib/model/toolbox";
import { find, neededAt, whereBy } from "@/lib/boxes/view";

/**
 * The day itself, for a phone in a pocket: what is on now and next against
 * the venue's clock, the running order, who to ring, and where a guest sits.
 * Read-only — the Binder changes nothing in the wedding.
 */

export interface BinderBlock {
  id: string;
  label: string;
  lane: string;
  location: string;
  startMin: number;
  /** When it ends, before any buffer — what "until" means to a person reading it. */
  endMin: number;
}

/** The day's blocks, soonest first, with the times Timeline works out. */
export function runningOrder(doc: Knotwork): BinderBlock[] {
  const blocks = new Map(readTimeline(doc).blocks.map((block) => [block.id, block]));
  return resolvedDay(doc)
    .map((resolved) => {
      const block = blocks.get(resolved.id);
      return {
        id: resolved.id,
        label: block?.label ?? "",
        lane: resolved.lane,
        location: block?.location ?? "",
        startMin: resolved.startMin,
        endMin: resolved.contentEndMin,
      };
    })
    .sort((a, b) => a.startMin - b.startMin || a.lane.localeCompare(b.lane));
}

type Phase = "before" | "on" | "after";

interface DayClock {
  phase: Phase;
  /** Minutes from the wedding day's midnight at the venue; past midnight runs on (1500 is 01:00 +1). */
  minute: number;
  /** Whole days until the day, while it is still to come. */
  daysAway: number;
}

/**
 * Where the venue's clock is against the day. The wedding's own UTC offset
 * says what time it is there — a planner may be in another time zone — and
 * the device's is used only when the wedding has none.
 */
export function dayClock(doc: Knotwork, blocks: readonly BinderBlock[], nowMs: number): DayClock {
  const date = doc.event.date;
  if (!date) return { phase: "before", minute: 0, daysAway: 0 };
  const offset = doc.event.utcOffsetMin ?? -new Date(nowMs).getTimezoneOffset();
  const midnightUtc = Date.parse(`${date}T00:00:00Z`) - offset * 60_000;
  const minute = Math.floor((nowMs - midnightUtc) / 60_000);
  const last = blocks.reduce((latest, block) => Math.max(latest, block.endMin), 0);
  if (minute < 0) return { phase: "before", minute, daysAway: Math.ceil(-minute / 1440) };
  if (minute >= Math.max(last, 1440)) return { phase: "after", minute, daysAway: 0 };
  return { phase: "on", minute, daysAway: 0 };
}

/** What is happening at `minute`, and the next few things to start after it. */
export function nowAndNext(blocks: readonly BinderBlock[], minute: number, next = 3): { now: BinderBlock[]; next: BinderBlock[] } {
  return {
    now: blocks.filter((block) => block.startMin <= minute && minute < block.endMin),
    next: blocks.filter((block) => block.startMin > minute).slice(0, next),
  };
}

interface Contact {
  name: string;
  /** What they are on the day: a supplier's trade, a crew member's team. */
  role: string;
  phone: string;
}

/**
 * Everyone there is a number for: suppliers as the running order and the crew
 * name them, and the people in the crew. One entry per number, the first name
 * it is known by kept.
 */
export function contacts(doc: Knotwork): Contact[] {
  const crew = readCrew(doc);
  const teamName = new Map(crew.teams.map((team) => [team.id, team.name]));
  const all: Contact[] = [
    ...readTimeline(doc).tagDetails.map((detail) => ({ name: detail.displayName || detail.tag, role: detail.tag, phone: detail.phone ?? "" })),
    ...crew.teams.map((team) => ({ name: team.name, role: team.tag ?? "Supplier", phone: team.phone })),
    ...crew.people.map((person) => ({
      name: person.name,
      role: (person.teamId && teamName.get(person.teamId)) || "Crew",
      phone: person.phone,
    })),
  ];
  const seen = new Set<string>();
  return all.filter((contact) => {
    const number = contact.phone.replace(/\D/g, "");
    if (number === "" || seen.has(number)) return false;
    seen.add(number);
    return true;
  });
}

interface FoundGuest {
  id: string;
  name: string;
  table: string;
}

/** Guests who are coming whose name has every word asked for, with where they sit. */
export function findGuests(doc: Knotwork, query: string, limit = 20): FoundGuest[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const tables = readSeating(doc).tables;
  return Object.values(readGuests(doc))
    .filter(isComing)
    .map((guest) => ({
      id: guest.id,
      name: guestName(guest),
      table: guest.assignedTableId ? (tables[guest.assignedTableId]?.label ?? "No table yet") : "No table yet",
    }))
    .filter((guest) => words.every((word) => guest.name.toLowerCase().includes(word)))
    .sort((a, b) => a.name.localeCompare(b.name, "en"))
    .slice(0, limit);
}

interface FoundBox {
  key: string;
  box: string;
  /** The thing in it that matched, or null when it was the box's own name. */
  item: string | null;
  /** "The suite, by 08:00". */
  where: string;
}

/** Boxes, and things packed in them, with every word asked for, and where each is going. Nothing when Boxes is hidden. */
export function findBoxes(doc: Knotwork, query: string): FoundBox[] {
  if (hiddenToolIds(doc).has("boxes")) return [];
  const known = dayPlaces(doc);
  return find(readBoxes(doc), query).map(({ box, item }) => {
    const { place, lost } = neededAt(box, known);
    return { key: item ? `${box.id}:${item.id}` : box.id, box: box.name, item: item?.label ?? null, where: whereBy(place, lost) };
  });
}

interface WalkingGroup {
  id: string;
  label: string;
  names: string[];
  /** When they set off: "As the quartet begins". */
  cue: string;
  /** The piece that starts as they walk, or null when the one playing carries on. */
  song: string | null;
}

/**
 * Who walks, in order, with their music, for whoever is lining people up: the
 * processional as Ceremony plans it, read-only, under the ceremony's block in
 * the day. Nothing while Ceremony is hidden or the processional is empty.
 */
export function walkingOrder(doc: Knotwork): { blockId: string | null; groups: WalkingGroup[] } | null {
  const ceremony = readCeremony(doc);
  if (hiddenToolIds(doc).has("ceremony") || ceremony.processional.length === 0) return null;
  const guests = readGuests(doc);
  const seating = readSeating(doc);
  const cast = readCast(doc);
  // Only a block the day still has can hold it; otherwise it stands on its own.
  const onTheDay = ceremony.blockId !== null && readTimeline(doc).blocks.some((block) => block.id === ceremony.blockId);
  return {
    blockId: onTheDay ? ceremony.blockId : null,
    groups: ceremony.processional.map((group) => {
      const resolved = resolveMembers(group, guests, seating, cast.roles, cast.customRoles, doc.event);
      return {
        id: group.id,
        label: resolved.label,
        names: resolved.people.map((person) => person.name),
        cue: group.cue.trim(),
        song: group.song ? songName(group.song) : null,
      };
    }),
  };
}

/** Where a phone keeps which shots it has ticked off, one wedding per key. */
export const TAKEN_PREFIX = "knotwork.binder.taken.";

/** Shots taken, on this phone only, per wedding. */
export function takenKey(weddingId: string | null): string {
  return `${TAKEN_PREFIX}${weddingId ?? "this-device"}`;
}
