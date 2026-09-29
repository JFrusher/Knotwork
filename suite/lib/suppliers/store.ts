/**
 * Where suppliers' links live: one real implementation over the supplier-link
 * migration's functions, and an in-memory one for the routes' tests. The
 * rules — members publish; a token and key that never change once published;
 * a supplier can only confirm — are the database's, proved in
 * migrations.test.ts.
 */

export interface SupplierLink {
  teamId: string;
  token: string;
  /** The link's key, as it travels after the `#`. Members only. */
  key: string;
  /** Of what the supplier sees — see `lib/suppliers/callSheet`. */
  fingerprint: string;
  publishedAt: string;
  /** When the supplier confirmed through their link, or null. */
  confirmedAt: string | null;
}

export interface PublishSheet {
  teamId: string;
  key: string;
  ciphertext: string;
  iv: string;
  fingerprint: string;
}

/** What a supplier's link fetches: the sealed sheet, and when it was published and confirmed. */
export interface SealedSheet {
  ciphertext: string;
  iv: string;
  publishedAt: string;
  confirmedAt: string | null;
}

export interface SupplierStore {
  linksOf(weddingId: string): Promise<SupplierLink[]>;
  /** Null when this supplier's link is already published under a different key. */
  publish(weddingId: string, input: PublishSheet): Promise<{ token: string; publishedAt: string } | null>;
  takeDown(weddingId: string, teamId: string): Promise<void>;
  read(token: string): Promise<SealedSheet | null>;
  /** When they confirmed, or null for no such link. */
  confirm(token: string): Promise<string | null>;
}

export function memoryStore(): SupplierStore {
  const links = new Map<string, SupplierLink & { weddingId: string; ciphertext: string; iv: string }>();
  const id = (weddingId: string, teamId: string) => `${weddingId}/${teamId}`;
  return {
    async linksOf(weddingId) {
      return [...links.values()]
        .filter((link) => link.weddingId === weddingId)
        .map(({ teamId, token, key, fingerprint, publishedAt, confirmedAt }) => ({ teamId, token, key, fingerprint, publishedAt, confirmedAt }));
    },
    async publish(weddingId, input) {
      const held = links.get(id(weddingId, input.teamId));
      if (held && held.key !== input.key) return null;
      const publishedAt = new Date().toISOString();
      const token = held?.token ?? crypto.randomUUID().replace(/-/g, "");
      links.set(id(weddingId, input.teamId), { weddingId, token, publishedAt, confirmedAt: held?.confirmedAt ?? null, ...input });
      return { token, publishedAt };
    },
    async takeDown(weddingId, teamId) {
      links.delete(id(weddingId, teamId));
    },
    async read(token) {
      const link = [...links.values()].find((entry) => entry.token === token);
      return link ? { ciphertext: link.ciphertext, iv: link.iv, publishedAt: link.publishedAt, confirmedAt: link.confirmedAt } : null;
    },
    async confirm(token) {
      const link = [...links.values()].find((entry) => entry.token === token);
      if (!link) return null;
      link.confirmedAt = new Date().toISOString();
      return link.confirmedAt;
    },
  };
}
