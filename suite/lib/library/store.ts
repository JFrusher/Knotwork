import type { Kind } from "./items";

/** One item in a planner's library, as listed: what it is, not what is in it. */
export interface LibraryListing {
  id: string;
  kind: Kind;
  name: string;
  createdAt: string;
}

/**
 * A planner's library, behind an interface as the other stores are: the
 * Supabase one, whose row-level security keeps each account to its own, and
 * an in-memory one for the handlers' tests.
 */
export interface LibraryStore {
  list(owner: string): Promise<LibraryListing[]>;
  /** The item's content, or null if the owner has no such item. */
  get(owner: string, id: string): Promise<unknown | null>;
  save(owner: string, kind: Kind, name: string, content: unknown): Promise<LibraryListing>;
  /** False when the owner had no such item. */
  remove(owner: string, id: string): Promise<boolean>;
}

export function memoryStore(): LibraryStore {
  const items: Array<LibraryListing & { owner: string; content: unknown }> = [];
  return {
    async list(owner) {
      return items
        .filter((item) => item.owner === owner)
        .reverse()
        .map(({ id, kind, name, createdAt }) => ({ id, kind, name, createdAt }));
    },
    async get(owner, id) {
      return items.find((item) => item.owner === owner && item.id === id)?.content ?? null;
    },
    async save(owner, kind, name, content) {
      const item = { id: `i${items.length + 1}`, owner, kind, name, content, createdAt: new Date().toISOString() };
      items.push(item);
      return { id: item.id, kind, name, createdAt: item.createdAt };
    },
    async remove(owner, id) {
      const index = items.findIndex((item) => item.owner === owner && item.id === id);
      if (index === -1) return false;
      items.splice(index, 1);
      return true;
    },
  };
}
