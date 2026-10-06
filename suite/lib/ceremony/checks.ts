import type { Place } from "@/lib/model/slices";
import type { Ceremony, Moment } from "@/lib/model/types";

/** A civil or religious ceremony is a legal one in England and Wales, and its register is signed by two witnesses. */
const WITNESSES_NEEDED = 2;

const isLegal = (ceremony: Ceremony) => ceremony.kind === "civil" || ceremony.kind === "religious";

/** Its length: the minutes of every moment that has one. Music as guests arrive has none. */
export function lengthOf(order: Moment[]): number {
  return order.reduce((sum, moment) => sum + (moment.minutes ?? 0), 0);
}

/**
 * When each moment starts, in minutes of the day, from the block's start: or
 * null for a moment before the ceremony begins — music as guests arrive,
 * untimed, at the head of the order.
 */
export function startTimes(order: Moment[], blockStart: number): Array<number | null> {
  let clock = blockStart;
  let begun = false;
  return order.map((moment) => {
    if (!begun && moment.minutes === null && moment.kind === "music") return null;
    begun = true;
    const at = clock;
    clock += moment.minutes ?? 0;
    return at;
  });
}

/** Where and when the ceremony is: its block's, or nothing chosen yet, or `lost` when the block has gone. */
export function ceremonyPlace(ceremony: Ceremony, known: ReadonlyMap<string, Place>): { place: Place | null; lost: boolean } {
  if (ceremony.blockId === null) return { place: null, lost: false };
  const place = known.get(ceremony.blockId) ?? null;
  return { place, lost: place === null };
}

/** Minutes the order runs past its block, or 0. */
export function overrun(ceremony: Ceremony, place: Place | null): number {
  return place ? Math.max(0, lengthOf(ceremony.order) - (place.endMin - place.startMin)) : 0;
}

/**
 * The moments a registrar approves in a civil ceremony: every reading, and
 * anything with music — the processional's included, whose music is its
 * groups'.
 */
export function needsApproval(ceremony: Ceremony): Moment[] {
  if (ceremony.kind !== "civil") return [];
  const walkingToMusic = ceremony.processional.some((group) => group.song !== null);
  return ceremony.order.filter(
    (moment) =>
      moment.kind === "reading" || moment.kind === "song" || moment.song !== null || (moment.kind === "processional" && walkingToMusic),
  );
}

/** What the page says is still to do in the ceremony itself: each is its own problem, seen only there. */
interface CeremonyChecks {
  /** In a civil ceremony, readings and music the registrar has not yet approved. */
  unapproved: number;
  /** Witnesses still to name at a legal ceremony. */
  witnessesShort: number;
  /** Groups walking with no processional in the order. */
  processionalMissing: boolean;
}

export function ceremonyChecks(ceremony: Ceremony): CeremonyChecks {
  return {
    unapproved: needsApproval(ceremony).filter((moment) => !moment.approved).length,
    witnessesShort: isLegal(ceremony) ? Math.max(0, WITNESSES_NEEDED - ceremony.witnesses.length) : 0,
    processionalMissing: ceremony.processional.length > 0 && !ceremony.order.some((moment) => moment.kind === "processional"),
  };
}
