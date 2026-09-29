import { create } from "zustand";
import type { Event as WeddingEvent } from "@jfrusher/trousseau";
import { readGuests } from "@/lib/model/slices";
import type { Guest } from "@/lib/model/types";
import { useTrousseauStore } from "@/lib/store/useTrousseauStore";

/**
 * Where an import reads the wedding from and writes it back to.
 *
 * Read when needed, not when the importer opens: the list may change while it
 * is open.
 */
export interface ImportTarget {
  read: () => { event: WeddingEvent; guests: Record<string, Guest>; seating: unknown };
  commit: (written: { guests: Record<string, unknown>; seating: Record<string, unknown> | null }) => void;
}

/** The wedding itself, as one undo step. */
export const liveWedding: ImportTarget = {
  read: () => {
    const { doc, raw } = useTrousseauStore.getState();
    return { event: doc.event, guests: readGuests(doc), seating: raw["seating"] };
  },
  commit: ({ guests, seating }) =>
    useTrousseauStore
      .getState()
      .setSlices(seating ? [["guests", guests], ["seating", seating]] : [["guests", guests]], {
        label: "the guest import",
      }),
};

/**
 * Whether the guest import is open, and for what. The Data panel and Seating
 * import into the wedding; setup imports into its draft, committed with the
 * rest of it. One importer, one set of rules, for all of them.
 */
interface GuestImportPanel {
  open: boolean;
  target: ImportTarget;
  /**
   * Into the wedding. Takes nothing on purpose: it is handed straight to
   * `onClick`, and an optional target would receive the click event.
   */
  show: () => void;
  /** Into something else — setup's draft. */
  showInto: (target: ImportTarget) => void;
  hide: () => void;
}

export const useGuestImport = create<GuestImportPanel>()((set) => ({
  open: false,
  target: liveWedding,
  show: () => set({ open: true, target: liveWedding }),
  showInto: (target) => set({ open: true, target }),
  hide: () => set({ open: false }),
}));
