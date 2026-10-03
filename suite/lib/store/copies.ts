import { get as idbGet, set as idbSet } from "idb-keyval";
import { create } from "zustand";

/**
 * Whole weddings kept on this device because something replaced them.
 *
 * The rule they serve: nothing is replaced without a restorable copy. Choosing
 * the account's wedding over this device's, the device's over the account's,
 * or the example over either — the side that loses is written here first, and
 * the Data panel can put it back.
 */
export interface KeptCopy {
  id: string;
  keptAt: string;
  /** Why it was kept, in the words the Data panel shows. */
  why: string;
  document: Record<string, unknown>;
}

export const COPIES_KEY = "knotwork.copies";

async function read(): Promise<KeptCopy[]> {
  return ((await idbGet(COPIES_KEY)) as KeptCopy[] | undefined) ?? [];
}

interface CopiesState {
  copies: KeptCopy[];
  load: () => Promise<void>;
  keep: (document: Record<string, unknown>, why: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useCopies = create<CopiesState>()((set) => ({
  copies: [],
  load: async () => set({ copies: await read() }),
  keep: async (document, why) => {
    const copy: KeptCopy = { id: crypto.randomUUID(), keptAt: new Date().toISOString(), why, document };
    // Newest first, and awaited: a caller replaces the wedding only once its
    // copy is stored.
    const copies = [copy, ...(await read())];
    await idbSet(COPIES_KEY, copies);
    set({ copies });
  },
  remove: async (id) => {
    const copies = (await read()).filter((copy) => copy.id !== id);
    await idbSet(COPIES_KEY, copies);
    set({ copies });
  },
}));
