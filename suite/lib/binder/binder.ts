import type { Trousseau } from "@jfrusher/trousseau";
import { guestName, isComing, readCrew, readGuests, readSeating, readTimeline, resolvedDay } from "@/lib/model/slices";

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
export function runningOrder(doc: Trousseau): BinderBlock[] {
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

export type Phase = "before" | "on" | "after";

export interface DayClock {
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
export function dayClock(doc: Trousseau, blocks: readonly BinderBlock[], nowMs: number): DayClock {
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

export interface Contact {
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
export function contacts(doc: Trousseau): Contact[] {
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

export interface FoundGuest {
  id: string;
  name: string;
  table: string;
}

/** Guests who are coming whose name has every word asked for, with where they sit. */
export function findGuests(doc: Trousseau, query: string, limit = 20): FoundGuest[] {
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
