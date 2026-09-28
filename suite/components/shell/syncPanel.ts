import { create } from "zustand";

/**
 * Whether Sync & history is open. Addressable, as the design's slide-overs
 * are: `?panel=sync` opens it, and opening it puts that in the address, so a
 * link to it — or a reload — lands with it open.
 */
interface SyncPanel {
  open: boolean;
  show: () => void;
  hide: () => void;
  /** Open it if the address asks for it. Called once, as the page loads. */
  fromAddress: () => void;
}

const PARAM = "panel";
const VALUE = "sync";

function address(open: boolean) {
  const url = new URL(window.location.href);
  if (open) url.searchParams.set(PARAM, VALUE);
  else url.searchParams.delete(PARAM);
  window.history.replaceState(window.history.state, "", url);
}

export const useSyncPanel = create<SyncPanel>()((set) => ({
  open: false,
  show: () => {
    address(true);
    set({ open: true });
  },
  hide: () => {
    address(false);
    set({ open: false });
  },
  fromAddress: () => {
    if (new URLSearchParams(window.location.search).get(PARAM) === VALUE) set({ open: true });
  },
}));
