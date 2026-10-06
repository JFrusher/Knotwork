/**
 * The stationery slice's stored shape, and nothing else.
 *
 * Several named pieces — place cards, table numbers, the seating board — each a
 * whole design of its own, plus what they share: the names of uploaded assets,
 * uploaded icons and two workspace preferences. Kept free of any import so the
 * suite's own readers (readiness, the overview, the library) can read the slice
 * without pulling Place cards in behind them.
 *
 * Versions 1 and 2 stored a single flat design. That design is the one piece
 * it always was, under the id and name every wedding's first piece gets — so a
 * reader never has to care which version wrote the slice.
 */

export const SUITE_VERSION = 3;

/** The piece every wedding starts with, and what an older single design becomes. */
export const FIRST_PIECE = { id: "place-cards", name: "Place cards" } as const;

type Raw = Record<string, unknown>;

export function isRecord(value: unknown): value is Raw {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** True when Place cards wrote this slice — any version — rather than an empty envelope. */
function isStationery(slice: unknown): slice is Raw {
  return isRecord(slice) && "version" in slice;
}

/**
 * The pieces as stored, in order, whatever version wrote them. Untyped on
 * purpose: callers outside Place cards read them defensively, and Place cards
 * itself validates each one in `persist`.
 */
export function storedPieces(slice: unknown): Raw[] {
  if (!isStationery(slice)) return [];
  if (slice["version"] === 1 || slice["version"] === 2) {
    return [{ ...slice, ...FIRST_PIECE }];
  }
  const pieces = slice["pieces"];
  return Array.isArray(pieces) ? pieces.filter(isRecord) : [];
}
