import { publishDay, readTimeline } from "@/lib/model/slices";
import { mayWrite, noteRead } from "@/lib/store/toolGeneration";
import { useTrousseauStore } from "@/lib/store/useTrousseauStore";
import type { TimelineDoc } from "../core/model/types";

/**
 * Where Cadence's autosave actually lands.
 *
 * Cadence was a standalone app that owned a localStorage key; here it is one
 * tool among four, and the day it plans is the same day the delegation board
 * hands out and the place cards are printed for. So its document lives in the
 * shared wedding's `timeline` slice instead.
 *
 * Nothing above this file knows. The store, the panels, the undo history, the
 * drag-to-move blocks are all Cadence's own code, unchanged — only the two
 * functions in `persist.ts` point somewhere new.
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
 *    belong to the wedding rather than to Cadence, which keeps an echo of them
 *    for its own resolver, and Timeline is where they are edited. The
 *    envelope's copy wins on read, so without this the Day panel would appear
 *    to accept an edit and then quietly revert on the next load.
 *
 * The date, the couple and the venue are not written back. They used to be —
 * Timeline had its own fields for them — and so did Seating, and each tool's
 * copy wrote itself over the others. They are edited in the Data panel only,
 * and Timeline shows them.
 */

/** The day as Cadence wants it, with the envelope's own fields already applied. */
export function readSlice(): TimelineDoc {
  noteRead("cadence");
  return readTimeline(useTrousseauStore.getState().doc);
}

export function writeSlice(next: TimelineDoc): void {
  // Refused when the document has been replaced since this was read.
  if (!mayWrite("cadence")) return;
  const store = useTrousseauStore.getState();
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
    { label: "the day", silent: true, by: "cadence" },
  );
}
