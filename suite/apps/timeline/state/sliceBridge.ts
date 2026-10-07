import { publishDay } from "@/lib/model/slices";
import { useKnotworkStore, type WriteOptions } from "@/lib/store/useKnotworkStore";
import type { TimelineDoc } from "../core/model/types";

/**
 * Where Timeline's edits land.
 *
 * Timeline started as Cadence, a standalone app that owned a localStorage key; here it is one
 * tool among four, and the day it plans is the same day the delegation board
 * hands out and the place cards are printed for. So its document lives in the
 * shared wedding's `timeline` slice instead.
 *
 * Timeline keeps no copy of it: its store reads the day from the wedding, and
 * every edit is written here at once, on the wedding's one history.
 *
 * Two things happen on every write that did not happen in standalone Cadence,
 * both because other tools are now reading:
 *
 *  - The resolved day is republished. `timeline` holds the *source* — anchors,
 *    gaps, squeeze floors — and `day` holds what those work out to. The
 *    delegation board reads the second, so leaving it stale would have it
 *    handing out yesterday's times.
 *
 *  - The curfew and the UTC offset are mirrored back into `event`. They
 *    belong to the wedding rather than to Timeline, which keeps an echo of them
 *    for its own resolver, and Timeline is where they are edited. The
 *    envelope's copy wins on read, so without this the Day panel would appear
 *    to accept an edit and then quietly revert on the next load.
 *
 * The date, the couple and the venue are not written back. They used to be —
 * Timeline had its own fields for them — and so did Seating, and each tool's
 * copy wrote itself over the others. They are edited in the Data panel only,
 * and Timeline shows them.
 */

export function writeSlice(next: TimelineDoc, options: WriteOptions): void {
  const store = useKnotworkStore.getState();
  const { doc } = store;

  store.setSlices(
    [
      ["timeline", next],
      ["day", publishDay(doc, next)],
      [
        "event",
        {
          ...doc.event,
          curfewMin: next.day.curfewMin,
          utcOffsetMin: next.day.utcOffsetMin,
        },
      ],
    ],
    options,
  );
}
