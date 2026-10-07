import { create } from "zustand";
import type { Knotwork } from "@jfrusher/knotwork";
import { fingerprint } from "@/lib/documents/fingerprint";
import { importShareKey, newShareKey, seal } from "@/lib/share/crypto";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import { helperSheet } from "./helperSheet";
import type { HelperLink } from "./store";

export function helperUrl(link: HelperLink, origin: string): string {
  return `${origin}/helper/${link.token}#k=${link.key}`;
}

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok || body === null) throw new Error(body?.error ?? "Helpers' links could not be reached.");
  return body;
}

async function fetchLinks(weddingId: string): Promise<HelperLink[]> {
  return (await readJson<{ links: HelperLink[] }>(await fetch(`/api/helpers?wedding=${encodeURIComponent(weddingId)}`))).links;
}

/** Seal this helper's sheet as it is now and publish it — under their link's own key, once it has one. */
async function publishNow(weddingId: string, doc: Knotwork, personId: string, held: HelperLink | null, assertCurrent: () => void, retry = false): Promise<HelperLink> {
  const sheet = helperSheet(doc, personId);
  if (!sheet) throw new Error("That person is no longer in the crew.");
  const key = held?.key ?? (await newShareKey()).encoded;
  const seen = fingerprint(sheet);
  const sealed = await seal(await importShareKey(key), sheet);
  assertCurrent();
  const response = await fetch("/api/helpers", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ weddingId, personId, key, fingerprint: seen, ...sealed }),
  });
  if (response.status === 409) {
    assertCurrent();
    if (retry) throw new Error("The helper's link could not be published.");
    // Published first from another device, under its key: use that one.
    const published = (await fetchLinks(weddingId)).find((link) => link.personId === personId);
    if (!published) throw new Error("The helper's link could not be published.");
    assertCurrent();
    return publishNow(weddingId, doc, personId, published, assertCurrent, true);
  }
  const { token, publishedAt } = await readJson<{ token: string; publishedAt: string }>(response);
  return { personId, token, key, fingerprint: seen, publishedAt };
}

async function takeDownNow(weddingId: string, personId: string): Promise<void> {
  await readJson(
    await fetch("/api/helpers", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ weddingId, personId }),
    }),
  );
}

/**
 * Each day-of helper's link to their own sheet, kept current.
 *
 * Published once, a link republishes itself whenever what that helper sees
 * changes — the day, their jobs, the boxes, the shots, a number — so nobody
 * works from an old sheet. Someone removed from the crew has their link taken
 * down.
 */
interface HelperLinksState {
  weddingId: string | null;
  /** Undefined until read. */
  links: HelperLink[] | undefined;
  problem: string | null;
  load: (weddingId: string) => Promise<void>;
  publish: (personId: string) => Promise<void>;
  takeDown: (personId: string) => Promise<void>;
  /** Republish each link whose sheet has changed since it was published. */
  keepCurrent: () => Promise<void>;
}

export const useHelperLinks = create<HelperLinksState>()((set, get) => {
  let generation = 0;
  let loadRequest = 0;
  let pending = Promise.resolve();

  // Invalidate immediately, including switches away and back before a request finishes.
  useKnotworkStore.subscribe((state, previous) => {
    if (state.weddingId === previous.weddingId) return;
    generation++;
    set({ weddingId: null, links: undefined, problem: null });
  });

  const attempt = (
    work: (weddingId: string, assertCurrent: () => void) => Promise<Partial<HelperLinksState>>,
    isLatest = () => true,
  ) => {
    const weddingId = get().weddingId;
    const started = generation;
    const current = () => isLatest() && started === generation && get().weddingId === weddingId && useKnotworkStore.getState().weddingId === weddingId;
    const assertCurrent = () => {
      if (!current()) throw new Error("The wedding has changed.");
    };
    // All reads and writes share the queue: a refresh cannot restore a link
    // removed by a later action, or overwrite a newly published token/key.
    pending = pending.then(async () => {
      if (!current()) return;
      try {
        if (!weddingId) throw new Error("This wedding is not on an account yet.");
        const result = await work(weddingId, assertCurrent);
        if (current()) set({ ...result, problem: null });
      } catch (cause) {
        if (current()) set({ problem: cause instanceof Error ? cause.message : String(cause) });
      }
    });
    return pending;
  };
  const others = (personId: string) => (get().links ?? []).filter((link) => link.personId !== personId);

  return {
    weddingId: null,
    links: undefined,
    problem: null,
    load: (weddingId) => {
      const request = ++loadRequest;
      if (get().weddingId !== weddingId) {
        generation++;
        set({ weddingId, links: undefined, problem: null });
      }
      return attempt(async () => ({ links: await fetchLinks(weddingId) }), () => request === loadRequest);
    },
    publish: (personId) =>
      attempt(async (weddingId, assertCurrent) => {
        const held = get().links?.find((link) => link.personId === personId) ?? null;
        const published = await publishNow(weddingId, useKnotworkStore.getState().doc, personId, held, assertCurrent);
        return { links: [...others(personId), published] };
      }),
    takeDown: (personId) =>
      attempt(async (weddingId) => {
        await takeDownNow(weddingId, personId);
        return { links: others(personId) };
      }),
    keepCurrent: () =>
      attempt(async (weddingId, assertCurrent) => {
        // Read again first: a partner's device may already have republished this very change.
        const current = await fetchLinks(weddingId);
        assertCurrent();
        const { doc } = useKnotworkStore.getState();
        const links: HelperLink[] = [];
        for (const link of current) {
          assertCurrent();
          const sheet = helperSheet(doc, link.personId);
          if (!sheet) await takeDownNow(weddingId, link.personId);
          else if (fingerprint(sheet) === link.fingerprint) links.push(link);
          else links.push(await publishNow(weddingId, doc, link.personId, link, assertCurrent));
        }
        return { links };
      }),
  };
});
