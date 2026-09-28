import { create } from "zustand";

/**
 * Whether the guest import is open. The Data panel and Seating's own import
 * buttons both open this one — there used to be two importers with two sets
 * of rules — and later the setup flow and the Guests page will too.
 */
interface GuestImportPanel {
  open: boolean;
  show: () => void;
  hide: () => void;
}

export const useGuestImport = create<GuestImportPanel>()((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));
