import { del, get, keys, set } from "idb-keyval";

/**
 * Moving stored data to the keys the app uses now that it is called Knotwork.
 *
 * It was called Trousseau, and before that, briefly, Tableaux Suite — a name it
 * shared with one of the four apps it replaced. Renaming the storage keys
 * without this would not lose the data, which is the mercy: the old entries
 * stay where they were. But nothing would look at them, so the app would open
 * to an empty wedding, which a person cannot tell apart from having lost
 * everything.
 *
 * Every key the app writes sits under one prefix, so a rename is a prefix
 * move: the document, each uploaded font and artwork, the cloud link and the
 * saved copies in IndexedDB; the tour and binder flags in localStorage.
 *
 * Runs once, before the first read. Copies rather than moves until the write
 * has succeeded, so an interrupted migration leaves the old copy intact.
 */

/** Newest name first: if a device somehow holds both, the newer data wins. */
const PREFIX_MOVES: Array<[from: string, to: string]> = [
  ["trousseau.", "knotwork."],
  ["tableaux.suite.", "knotwork."],
];

export interface MigrationResult {
  moved: string[];
}

export async function migrateLegacyKeys(): Promise<MigrationResult> {
  const moved: string[] = [];

  for (const [from, to] of PREFIX_MOVES) {
    for (const key of await keys()) {
      if (typeof key !== "string" || !key.startsWith(from)) continue;
      const target = to + key.slice(from.length);
      // Never overwrite: if the new key already holds something, this device
      // has already migrated, and the stale old copy is not the truth.
      if ((await get(target)) !== undefined) {
        await del(key);
        continue;
      }
      const value: unknown = await get(key);
      if (value === undefined) continue;

      await set(target, value);
      await del(key);
      moved.push(target);
    }

    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(from)) continue;
      const target = to + key.slice(from.length);
      const value = localStorage.getItem(key);
      if (localStorage.getItem(target) === null && value !== null) {
        localStorage.setItem(target, value);
        moved.push(target);
      }
      localStorage.removeItem(key);
    }
  }

  return { moved };
}
