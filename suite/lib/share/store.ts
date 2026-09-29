/**
 * Where a wedding's guest link lives: one real implementation over the
 * guest-link migration's functions, and one in-memory fake for the routes'
 * tests. The rules — members only; a token and key that never change once
 * published — are the database's, and proved against it in migrations.test.ts.
 */

export interface GuestLinkRecord {
  token: string;
  /** The link's key, as it travels after the `#`. Members only. */
  key: string;
  showPlan: boolean;
  /** Of what guests see, not of the ciphertext — see `lib/share/guestLink`. */
  fingerprint: string;
  publishedAt: string;
}

export interface Publish {
  key: string;
  showPlan: boolean;
  ciphertext: string;
  iv: string;
  fingerprint: string;
}

export interface ShareStore {
  linkOf(weddingId: string): Promise<GuestLinkRecord | null>;
  /** Null when the link is already published under a different key. */
  publish(weddingId: string, input: Publish): Promise<{ token: string; publishedAt: string } | null>;
  takeDown(weddingId: string): Promise<void>;
  /** What a guest's link fetches: the sealed snapshot, nothing else. */
  read(token: string): Promise<{ ciphertext: string; iv: string } | null>;
}

export function memoryStore(): ShareStore {
  const links = new Map<string, GuestLinkRecord & { ciphertext: string; iv: string }>();
  return {
    async linkOf(weddingId) {
      const link = links.get(weddingId);
      if (!link) return null;
      const { ciphertext: _c, iv: _i, ...record } = link;
      return record;
    },
    async publish(weddingId, input) {
      const held = links.get(weddingId);
      if (held && held.key !== input.key) return null;
      const publishedAt = new Date().toISOString();
      const token = held?.token ?? crypto.randomUUID().replace(/-/g, "");
      links.set(weddingId, { token, publishedAt, ...input });
      return { token, publishedAt };
    },
    async takeDown(weddingId) {
      links.delete(weddingId);
    },
    async read(token) {
      const link = [...links.values()].find((l) => l.token === token);
      return link ? { ciphertext: link.ciphertext, iv: link.iv } : null;
    },
  };
}
