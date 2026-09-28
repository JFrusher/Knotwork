/**
 * Where a wedding's cloud document lives, behind an interface — the same
 * `lib/sync/store.ts` / `lib/accounts/store.ts` pattern: one real
 * implementation (Postgres, via save_wedding_document()) and one in-memory
 * fake, so the CAS and validation rules in handlers.ts can be tested without
 * a database.
 */

export interface DocumentRecord {
  weddingId: string;
  document: unknown;
  version: number;
  updatedAt: string;
}

/** One saved version, newest first in a listing. */
export interface HistoryEntry {
  id: string;
  savedAt: string;
  /** The account that saved it, or null once that account has gone. */
  savedBy: string | null;
}

export interface SaveResult {
  accepted: boolean;
  record: DocumentRecord;
}

export interface DocumentStore {
  /** Null if the wedding has never had a document saved for it. */
  getDocument(weddingId: string): Promise<DocumentRecord | null>;
  /**
   * Compare-and-set write. Always returns the true current record either
   * way — accepted or not — so a rejected write can show what it lost to.
   */
  /**
   * `savedBy` is for the in-memory store alone: the real one records the
   * signed-in account itself, in `save_wedding_document`, from the session.
   */
  saveDocument(weddingId: string, document: unknown, expectedVersion: number, savedBy?: string): Promise<SaveResult>;
  /** The versions saved, newest first — every accepted save keeps one. */
  history(weddingId: string, limit: number): Promise<HistoryEntry[]>;
  /** One saved version's document, or null if the wedding has no such version. */
  historyDocument(weddingId: string, id: string): Promise<unknown | null>;
  /**
   * Weddings stale as of `before`, oldest first: either a document last saved
   * before that time, or (the Supabase-backed implementation only) a wedding
   * old enough to count but that has never had a document saved at all.
   */
  staleWeddings(before: string): Promise<string[]>;
  /**
   * Delete a wedding outright, not just its document — used only by the
   * retention sweep. The Supabase-backed implementation deletes the whole
   * `account_weddings` row, cascading to its document, history, members, and
   * invites.
   */
  deleteWedding(weddingId: string): Promise<void>;
}

export function memoryStore(): DocumentStore {
  const documents = new Map<string, DocumentRecord>();
  const versions: Array<HistoryEntry & { weddingId: string; document: unknown }> = [];

  return {
    async getDocument(weddingId) {
      return documents.get(weddingId) ?? null;
    },

    async saveDocument(weddingId, document, expectedVersion, savedBy) {
      const current = documents.get(weddingId);
      const currentVersion = current?.version ?? 0;

      if (currentVersion !== expectedVersion) {
        return {
          accepted: false,
          record: current ?? { weddingId, document: null, version: 0, updatedAt: new Date(0).toISOString() },
        };
      }

      const record: DocumentRecord = {
        weddingId,
        document,
        version: currentVersion + 1,
        updatedAt: new Date().toISOString(),
      };
      documents.set(weddingId, record);
      versions.push({ id: `v${versions.length + 1}`, weddingId, document, savedAt: record.updatedAt, savedBy: savedBy ?? null });
      return { accepted: true, record };
    },

    async history(weddingId, limit) {
      return versions
        .filter((version) => version.weddingId === weddingId)
        .reverse()
        .slice(0, limit)
        .map(({ id, savedAt, savedBy }) => ({ id, savedAt, savedBy }));
    },

    async historyDocument(weddingId, id) {
      return versions.find((version) => version.weddingId === weddingId && version.id === id)?.document ?? null;
    },

    async staleWeddings(before) {
      return [...documents.values()]
        .filter((record) => record.updatedAt < before)
        .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
        .map((record) => record.weddingId);
    },

    async deleteWedding(weddingId) {
      documents.delete(weddingId);
    },
  };
}
