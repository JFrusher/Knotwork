import { del as idbDel, get as idbGet, set as idbSet } from "idb-keyval";
import { forgetLink, readLink, writeLink, type CloudLink } from "@/lib/documents/cloudSync";
import { STORAGE_KEY } from "./useKnotworkStore";

/** The wedding this device was last asked to open — read by the next start. */
const OPEN_KEY = "knotwork.cloud.open";
const stashKey = (weddingId: string) => `knotwork.wedding.${weddingId}`;

interface Stash {
  document: unknown;
  link: CloudLink;
}

export async function readOpenChoice(): Promise<string | null> {
  return ((await idbGet(OPEN_KEY)) as string | undefined) ?? null;
}

/**
 * Open one of the account's weddings on this device: a swap, never a merge.
 *
 * Storage only — run where neither the store nor a tool is loaded (`/open`),
 * so no late write from the page being left can land on the wedding being
 * opened. The one open now is put aside under its own id with its link, and
 * comes back exactly as it was when it is opened again.
 *
 * A wedding on this device that no account holds is not put aside: it stays
 * where it is, and the start asks how it and the opened one meet — the same
 * question as any first sign-in, since both may have work in them.
 */
export async function openWedding(weddingId: string): Promise<void> {
  const link = await readLink();
  if (link && link.weddingId !== weddingId) {
    const current: unknown = await idbGet(STORAGE_KEY);
    if (current !== undefined) await idbSet(stashKey(link.weddingId), { document: current, link } satisfies Stash);
    const stash = (await idbGet(stashKey(weddingId))) as Stash | undefined;
    if (stash) {
      await idbSet(STORAGE_KEY, stash.document);
      await writeLink(stash.link);
      await idbDel(stashKey(weddingId));
    } else {
      await idbDel(STORAGE_KEY);
      await forgetLink();
    }
  }
  await idbSet(OPEN_KEY, weddingId);
}

/**
 * After leaving a wedding: its copy goes from this device too. Leaving is
 * choosing not to have it; a planner in particular should not keep a client's
 * plans after walking away from them.
 */
export async function closeWedding(): Promise<void> {
  await idbDel(STORAGE_KEY);
  await forgetLink();
  await idbDel(OPEN_KEY);
}
