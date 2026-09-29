import { create } from "zustand";

/**
 * Whether the Data panel is open, for anything that needs to open it.
 *
 * It lived in the header's own state, which was fine while the header's button
 * was the only way in. The wedding's names, date and venue are edited there
 * and nowhere else now, so Timeline and the front page point at it too.
 */
interface DataPanel {
  open: boolean;
  show: () => void;
  hide: () => void;
}

export const useDataPanel = create<DataPanel>()((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));
