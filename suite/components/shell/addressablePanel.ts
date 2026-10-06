import { create } from "zustand";

/**
 * Whether a slide-over is open. Addressable, as the design's slide-overs are:
 * `?panel=<name>` opens it, and opening it puts that in the address, so a link
 * to it — or a reload — lands with it open.
 */
interface AddressablePanel {
  open: boolean;
  show: () => void;
  hide: () => void;
  /** Open it if the address asks for it. Called once, as the page loads. */
  fromAddress: () => void;
}

const PARAM = "panel";

export function addressablePanel(name: string) {
  const address = (open: boolean) => {
    const url = new URL(window.location.href);
    if (open) url.searchParams.set(PARAM, name);
    else url.searchParams.delete(PARAM);
    window.history.replaceState(window.history.state, "", url);
  };

  return create<AddressablePanel>()((set) => ({
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
      if (new URLSearchParams(window.location.search).get(PARAM) === name) set({ open: true });
    },
  }));
}
