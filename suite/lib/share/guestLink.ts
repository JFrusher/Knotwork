import { create } from "zustand";
import type { Trousseau } from "@jfrusher/trousseau";
import { fingerprint } from "@/lib/documents/fingerprint";
import { readGuests, readSeating } from "@/lib/model/slices";
import { useTrousseauStore } from "@/lib/store/useTrousseauStore";
import { importShareKey, newShareKey, seal } from "./crypto";
import { shareSnapshot, type ShareSnapshot } from "./snapshot";
import type { GuestLinkRecord } from "./store";

export type GuestLink = GuestLinkRecord;

/**
 * What guests would see, fingerprinted — without `publishedAt`, which is
 * different every time and would make every check a change.
 */
export function guestView(doc: Trousseau, showPlan: boolean): { snapshot: ShareSnapshot; fingerprint: string } {
  const snapshot = shareSnapshot(readGuests(doc), readSeating(doc), doc.event, { showPlan });
  const { publishedAt: _, ...seen } = snapshot;
  return { snapshot, fingerprint: fingerprint(seen) };
}

export function linkUrl(link: GuestLink, origin: string): string {
  return `${origin}/seat/${link.token}#k=${link.key}`;
}

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok || body === null) throw new Error(body?.error ?? "The guest link could not be reached.");
  return body;
}

async function fetchLink(weddingId: string): Promise<GuestLink | null> {
  return (await readJson<{ link: GuestLink | null }>(await fetch(`/api/share?wedding=${encodeURIComponent(weddingId)}`))).link;
}

/** Seal what guests see now and publish it — under the link's own key, once it has one. */
async function publishNow(weddingId: string, doc: Trousseau, key: string | null, showPlan: boolean): Promise<GuestLink> {
  const encoded = key ?? (await newShareKey()).encoded;
  const { snapshot, fingerprint } = guestView(doc, showPlan);
  const sealed = await seal(await importShareKey(encoded), snapshot);
  const response = await fetch("/api/share", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ weddingId, key: encoded, showPlan, fingerprint, ...sealed }),
  });
  if (response.status === 409) {
    // Published first from another device, under its key: use that one.
    const published = await fetchLink(weddingId);
    if (!published) throw new Error("The guest link could not be published.");
    return publishNow(weddingId, doc, published.key, showPlan);
  }
  const { token, publishedAt } = await readJson<{ token: string; publishedAt: string }>(response);
  return { token, key: encoded, showPlan, fingerprint, publishedAt };
}

/**
 * The wedding's guest link, kept current.
 *
 * Published once, it republishes itself whenever what guests see changes —
 * a seat moved, a name corrected — so a guest is never sent to the table
 * someone used to be at. A stale seat link is worse than none.
 */
interface GuestLinkState {
  weddingId: string | null;
  /** Undefined until read; null when there is none. */
  link: GuestLink | null | undefined;
  problem: string | null;
  load: (weddingId: string) => Promise<void>;
  publish: (showPlan: boolean) => Promise<void>;
  takeDown: () => Promise<void>;
  /** Republish if what guests see has changed since the last publish. */
  keepCurrent: () => Promise<void>;
}

export const useGuestLink = create<GuestLinkState>()((set, get) => {
  const attempt = async (work: () => Promise<Partial<GuestLinkState>>) => {
    try {
      set({ ...(await work()), problem: null });
    } catch (cause) {
      set({ problem: cause instanceof Error ? cause.message : String(cause) });
    }
  };
  const wedding = () => {
    const { weddingId } = get();
    if (!weddingId) throw new Error("This wedding is not on an account yet.");
    return weddingId;
  };

  return {
    weddingId: null,
    link: undefined,
    problem: null,
    load: (weddingId) => attempt(async () => ({ weddingId, link: await fetchLink(weddingId) })),
    publish: (showPlan) =>
      attempt(async () => ({
        link: await publishNow(wedding(), useTrousseauStore.getState().doc, get().link?.key ?? null, showPlan),
      })),
    takeDown: () =>
      attempt(async () => {
        await readJson(
          await fetch("/api/share", {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ weddingId: wedding() }),
          }),
        );
        return { link: null };
      }),
    keepCurrent: () =>
      attempt(async () => {
        // Read again first: a partner's device may already have republished
        // this very change.
        const current = await fetchLink(wedding());
        if (!current) return { link: null };
        const { doc } = useTrousseauStore.getState();
        if (guestView(doc, current.showPlan).fingerprint === current.fingerprint) return { link: current };
        return { link: await publishNow(wedding(), doc, current.key, current.showPlan) };
      }),
  };
});
