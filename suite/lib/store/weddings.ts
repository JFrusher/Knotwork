import { create } from "zustand";
import type { WeddingListing } from "@/lib/accounts/handlers";

/**
 * The account's weddings, as the last start listed them — for the switcher.
 * Null until a start has reached the account.
 */
interface Weddings {
  weddings: WeddingListing[] | null;
  listed: (weddings: WeddingListing[]) => void;
}

export const useWeddings = create<Weddings>()((set) => ({
  weddings: null,
  listed: (weddings) => set({ weddings }),
}));
