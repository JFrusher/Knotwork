/**
 * Where helpers' links live: one real implementation over the helper-link
 * migration's functions, and an in-memory one for the routes' tests. The
 * rules — members publish; a token and key that never change once published;
 * a link that ends the day after the wedding — are the database's, proved in
 * migrations.test.ts.
 */

export interface HelperLink {
  personId: string;
  token: string;
  /** The link's key, as it travels after the `#`. Members only. */
  key: string;
  /** Of what the helper sees — see `lib/helpers/helperSheet`. */
  fingerprint: string;
  publishedAt: string;
}

export interface PublishSheet {
  personId: string;
  key: string;
  ciphertext: string;
  iv: string;
  fingerprint: string;
}

/** What a helper's link fetches: the sealed sheet, and when it was published. */
export interface SealedSheet {
  ciphertext: string;
  iv: string;
  publishedAt: string;
}

export interface HelperStore {
  linksOf(weddingId: string): Promise<HelperLink[]>;
  /** Null when this helper's link is already published under a different key. */
  publish(weddingId: string, input: PublishSheet): Promise<{ token: string; publishedAt: string } | null>;
  takeDown(weddingId: string, personId: string): Promise<void>;
  /** Null for no such link, or one that has run out. */
  read(token: string): Promise<SealedSheet | null>;
}

export function memoryStore(): HelperStore {
  const links = new Map<string, HelperLink & { weddingId: string; ciphertext: string; iv: string }>();
  const id = (weddingId: string, personId: string) => `${weddingId}/${personId}`;
  return {
    async linksOf(weddingId) {
      return [...links.values()]
        .filter((link) => link.weddingId === weddingId)
        .map(({ personId, token, key, fingerprint, publishedAt }) => ({ personId, token, key, fingerprint, publishedAt }));
    },
    async publish(weddingId, input) {
      const held = links.get(id(weddingId, input.personId));
      if (held && held.key !== input.key) return null;
      const publishedAt = new Date().toISOString();
      const token = held?.token ?? crypto.randomUUID().replace(/-/g, "");
      links.set(id(weddingId, input.personId), { weddingId, token, publishedAt, ...input });
      return { token, publishedAt };
    },
    async takeDown(weddingId, personId) {
      links.delete(id(weddingId, personId));
    },
    async read(token) {
      const link = [...links.values()].find((entry) => entry.token === token);
      return link ? { ciphertext: link.ciphertext, iv: link.iv, publishedAt: link.publishedAt } : null;
    },
  };
}
