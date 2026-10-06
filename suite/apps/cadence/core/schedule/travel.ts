import { tagLabel } from "../model/tags";
import { formatClock } from "../time/minutes";
import type { Journey, TimelineDoc } from "../model/types";
import type { Conflict } from "./conflicts";
import { blocksById, byId, type ResolvedBlock } from "./resolve";

/**
 * Who has to get from one place to another during the day, and whether the
 * day leaves them long enough to.
 *
 * Somebody is a tag — the photographer, the band, the two of you once your own
 * blocks carry "couple" — as the double-booking check already reads it. Not a
 * lane: the Suppliers lane holds the florist and then the caterer, and nobody
 * travels from one to the other.
 */

/** A place as the couple would match it: trimmed, whatever the case. */
const placeKey = (place: string): string => place.trim().toLowerCase();

/** Two places, either way round, as one key. */
export function pairKey(a: string, b: string): string {
  return [placeKey(a), placeKey(b)].sort().join("\u0000");
}

interface Move {
  tag: string;
  from: ResolvedBlock;
  to: ResolvedBlock;
  fromPlace: string;
  toPlace: string;
}

/**
 * Every move the day makes: for each tag, in time order, a block somewhere
 * other than where that tag last was. A block with no location moves nobody,
 * so where they last were carries across it.
 */
export function moves(resolved: ResolvedBlock[], doc: TimelineDoc): Move[] {
  const positions = byId(resolved);
  const stopsByTag = new Map<string, Array<{ entry: ResolvedBlock; place: string }>>();
  for (const block of doc.blocks) {
    const entry = positions.get(block.id);
    const place = block.location.trim();
    if (!entry || !place) continue;
    for (const tag of block.tags) {
      const stops = stopsByTag.get(tag);
      if (stops) stops.push({ entry, place });
      else stopsByTag.set(tag, [{ entry, place }]);
    }
  }

  const found: Move[] = [];
  for (const [tag, stops] of stopsByTag) {
    stops.sort((a, b) => a.entry.startMin - b.entry.startMin || a.entry.contentEndMin - b.entry.contentEndMin);
    for (let i = 1; i < stops.length; i += 1) {
      const from = stops[i - 1]!;
      const to = stops[i]!;
      if (placeKey(from.place) === placeKey(to.place)) continue;
      found.push({ tag, from: from.entry, to: to.entry, fromPlace: from.place, toPlace: to.place });
    }
  }
  return found;
}

/** The typed time between two places, or null: never a guess. */
export function journeyMinutes(doc: TimelineDoc, a: string, b: string): number | null {
  const key = pairKey(a, b);
  return doc.travel.find((journey) => pairKey(...journey.between) === key)?.minutes ?? null;
}

interface TravelPair {
  between: [string, string];
  /** The typed time, or null: not checked. */
  minutes: number | null;
  /** Who makes this journey, by name. */
  who: string[];
}

/**
 * The pairs of places the day moves between, in the order it first does, each
 * with its typed time; and the journeys typed that the day no longer makes. The
 * same walk the advisory uses, so what is listed is exactly what is checked.
 */
export function travelPairs(resolved: ResolvedBlock[], doc: TimelineDoc): { used: TravelPair[]; unused: Journey[] } {
  const pairs = new Map<string, TravelPair>();
  const inOrder = [...moves(resolved, doc)].sort((a, b) => a.to.startMin - b.to.startMin);
  for (const move of inOrder) {
    const key = pairKey(move.fromPlace, move.toPlace);
    const who = tagLabel(doc, move.tag);
    const pair = pairs.get(key);
    if (!pair) {
      pairs.set(key, { between: [move.fromPlace, move.toPlace], minutes: journeyMinutes(doc, move.fromPlace, move.toPlace), who: [who] });
    } else if (!pair.who.includes(who)) {
      pair.who.push(who);
    }
  }
  return {
    used: [...pairs.values()],
    unused: doc.travel.filter((journey) => !pairs.has(pairKey(...journey.between))),
  };
}

/**
 * The travel list with one journey's time set, or taken away when there is
 * none. The same list back when nothing changed, so no empty step lands on the
 * history.
 */
export function withJourney(travel: Journey[], between: [string, string], minutes: number | null): Journey[] {
  const key = pairKey(...between);
  const existing = travel.find((journey) => pairKey(...journey.between) === key);
  if (minutes === null || minutes <= 0) return existing ? travel.filter((journey) => journey !== existing) : travel;
  if (existing?.minutes === minutes) return travel;
  return existing
    ? travel.map((journey) => (journey === existing ? { ...journey, minutes } : journey))
    : [...travel, { between, minutes }];
}

const listOf = (names: string[]): string =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/**
 * Somebody due somewhere before they could get there. Measured from where the
 * run sheet says a block ends — before its contingency buffer, which is for
 * overrunning, not for travelling. One advisory per pair of blocks, naming
 * everybody making that move. An overlap is not travel's to report: somebody
 * in two places at once is a double booking already.
 */
export function travelShortfalls(resolved: ResolvedBlock[], doc: TimelineDoc): Conflict[] {
  const blocks = blocksById(doc);
  const label = (id: string) => blocks.get(id)?.label ?? id;
  const short = new Map<string, { move: Move; minutes: number; who: string[] }>();

  for (const move of moves(resolved, doc)) {
    const minutes = journeyMinutes(doc, move.fromPlace, move.toPlace);
    if (minutes === null) continue;
    const gap = move.to.startMin - move.from.contentEndMin;
    if (gap < 0 || gap >= minutes) continue;
    const key = `${move.from.id}>${move.to.id}`;
    const who = tagLabel(doc, move.tag);
    const seen = short.get(key);
    if (seen) seen.who.push(who);
    else short.set(key, { move, minutes, who: [who] });
  }

  return [...short.values()].map(({ move, minutes, who }) => {
    const one = who.length === 1;
    const gap = move.to.startMin - move.from.contentEndMin;
    return {
      kind: "no-travel-time" as const,
      severity: "advisory" as const,
      blockIds: [move.from.id, move.to.id],
      message:
        `${listOf(who)} ${one ? "finishes" : "finish"} ${label(move.from.id)} at ${formatClock(move.from.contentEndMin)} ` +
        `at ${move.fromPlace}, and ${one ? "is" : "are"} due at ${label(move.to.id)} at ${formatClock(move.to.startMin)} ` +
        `at ${move.toPlace}, ${minutes} minutes away: ${minutes - gap} minutes short.`,
    };
  });
}
