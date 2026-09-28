/**
 * Take people off the guest list, and out of everything that points at them.
 *
 * A guest is named in more places than the list: a table's seats, a group's or
 * a family's members, a seating rule, another guest's plus-one. Removing the
 * guest and leaving those is how a table ends up holding someone who does not
 * exist — an error the cross-slice validator refuses a save over.
 *
 * Works on the slices as stored rather than through the suite's typed readers,
 * which rebuild a table from the fields they know and would drop the ones only
 * Seating uses. The same rule as the document itself: change what you mean to,
 * copy everything else.
 *
 * Seating's own removal cleaned the first four and left seating rules naming
 * the removed guest; this drops them.
 */

type Raw = Record<string, unknown>;

const isRecord = (value: unknown): value is Raw =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function removeGuests(
  guests: Record<string, unknown>,
  seating: unknown,
  ids: ReadonlySet<string>,
): { guests: Record<string, unknown>; seating: Raw } {
  const keptGuests: Record<string, unknown> = {};
  for (const [id, guest] of Object.entries(guests)) {
    if (ids.has(id)) continue;
    keptGuests[id] =
      isRecord(guest) && typeof guest["plusOneOf"] === "string" && ids.has(guest["plusOneOf"])
        ? { ...guest, plusOneOf: null }
        : guest;
  }

  const raw: Raw = isRecord(seating) ? seating : {};
  const next: Raw = { ...raw };

  if (isRecord(raw["tables"])) {
    const tables: Raw = {};
    for (const [id, table] of Object.entries(raw["tables"])) {
      if (!isRecord(table) || !Array.isArray(table["assignedGuestIds"])) {
        tables[id] = table;
        continue;
      }
      const seats = table["assignedGuestIds"] as unknown[];
      tables[id] = {
        ...table,
        // Seat-mode tables keep the hole, so seat 5 stays seat 5; table-mode
        // ones close up, because their order means nothing.
        assignedGuestIds:
          table["seatMode"] === "seat"
            ? seats.map((seat) => (typeof seat === "string" && ids.has(seat) ? null : seat))
            : seats.filter((seat) => !(typeof seat === "string" && ids.has(seat))),
      };
    }
    next["tables"] = tables;
  }

  for (const collection of ["groups", "subgroups", "families"] as const) {
    if (!isRecord(raw[collection])) continue;
    const kept: Raw = {};
    for (const [id, entry] of Object.entries(raw[collection])) {
      kept[id] =
        isRecord(entry) && Array.isArray(entry["memberIds"])
          ? { ...entry, memberIds: (entry["memberIds"] as unknown[]).filter((m) => !(typeof m === "string" && ids.has(m))) }
          : entry;
    }
    next[collection] = kept;
  }

  if (Array.isArray(raw["constraints"])) {
    next["constraints"] = (raw["constraints"] as unknown[]).filter(
      (rule) =>
        !(
          isRecord(rule) &&
          Array.isArray(rule["guestIds"]) &&
          (rule["guestIds"] as unknown[]).some((id) => typeof id === "string" && ids.has(id))
        ),
    );
  }

  return { guests: keptGuests, seating: next };
}
