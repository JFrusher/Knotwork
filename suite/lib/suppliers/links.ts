import { create } from "zustand";
import type { Knotwork } from "@jfrusher/knotwork";
import { localDay } from "@/lib/dates";
import { fingerprint } from "@/lib/documents/fingerprint";
import { importShareKey, newShareKey, seal } from "@/lib/share/crypto";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import { callSheet } from "./callSheet";
import type { SupplierLink } from "./store";

type Raw = Record<string, unknown>;

export function supplierUrl(link: SupplierLink, origin: string): string {
  return `${origin}/supplier/${link.token}#k=${link.key}`;
}

/** Whether the sheet has changed since the supplier confirmed it. */
export function changedSinceConfirmed(link: SupplierLink): boolean {
  return link.confirmedAt !== null && Date.parse(link.publishedAt) > Date.parse(link.confirmedAt);
}

/**
 * The crew slice as stored, with each supplier's confirmation through their
 * link carried into `confirmedOn` — the day it happened, where the user is.
 * Only ever later: a date typed in by hand that is newer stays. Null when
 * nothing changes, so nothing is written.
 */
function withConfirmations(crew: Raw, links: SupplierLink[]): Raw | null {
  const teams = Array.isArray(crew["teams"]) ? (crew["teams"] as Raw[]) : [];
  let changed = false;
  const next = teams.map((team) => {
    const confirmedAt = links.find((link) => link.teamId === team["id"])?.confirmedAt;
    if (!confirmedAt) return team;
    const on = localDay(new Date(confirmedAt));
    const held = typeof team["confirmedOn"] === "string" ? team["confirmedOn"] : "";
    if (held >= on) return team;
    changed = true;
    return { ...team, confirmedOn: on };
  });
  return changed ? { ...crew, teams: next } : null;
}

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok || body === null) throw new Error(body?.error ?? "Suppliers' links could not be reached.");
  return body;
}

async function fetchLinks(weddingId: string): Promise<SupplierLink[]> {
  return (await readJson<{ links: SupplierLink[] }>(await fetch(`/api/suppliers?wedding=${encodeURIComponent(weddingId)}`))).links;
}

/** Seal this supplier's sheet as it is now and publish it — under their link's own key, once it has one. */
async function publishNow(weddingId: string, doc: Knotwork, teamId: string, held: SupplierLink | null): Promise<SupplierLink> {
  const sheet = callSheet(doc, teamId);
  if (!sheet) throw new Error("That supplier is no longer on the wedding.");
  const key = held?.key ?? (await newShareKey()).encoded;
  const seen = fingerprint(sheet);
  const sealed = await seal(await importShareKey(key), sheet);
  const response = await fetch("/api/suppliers", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ weddingId, teamId, key, fingerprint: seen, ...sealed }),
  });
  if (response.status === 409) {
    // Published first from another device, under its key: use that one.
    const published = (await fetchLinks(weddingId)).find((link) => link.teamId === teamId);
    if (!published) throw new Error("The supplier's link could not be published.");
    return publishNow(weddingId, doc, teamId, published);
  }
  const { token, publishedAt } = await readJson<{ token: string; publishedAt: string }>(response);
  return { teamId, token, key, fingerprint: seen, publishedAt, confirmedAt: held?.confirmedAt ?? null };
}

async function takeDownNow(weddingId: string, teamId: string): Promise<void> {
  await readJson(
    await fetch("/api/suppliers", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ weddingId, teamId }),
    }),
  );
}

/** Suppliers' confirmations into the wedding — written as nobody's edit, since nobody here made it. */
function applyConfirmations(links: SupplierLink[]): void {
  const store = useKnotworkStore.getState();
  const crew = store.raw["crew"];
  if (!crew || typeof crew !== "object") return;
  const next = withConfirmations(crew as Raw, links);
  if (next) store.setSlice("crew", next, { label: "suppliers' confirmations", silent: true });
}

/**
 * Each supplier's link to their own call sheet, kept current.
 *
 * Published once, a link republishes itself whenever what that supplier sees
 * changes — a job moved, a time changed — so nobody arrives for the time on
 * an old sheet. A supplier removed from the wedding has their link taken
 * down: nothing here could reach it any more, and it would go stale.
 */
interface SupplierLinksState {
  weddingId: string | null;
  /** Undefined until read. */
  links: SupplierLink[] | undefined;
  problem: string | null;
  load: (weddingId: string) => Promise<void>;
  publish: (teamId: string) => Promise<void>;
  takeDown: (teamId: string) => Promise<void>;
  /** Republish each link whose sheet has changed since it was published. */
  keepCurrent: () => Promise<void>;
}

export const useSupplierLinks = create<SupplierLinksState>()((set, get) => {
  const attempt = async (work: () => Promise<Partial<SupplierLinksState>>) => {
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
  const others = (teamId: string) => (get().links ?? []).filter((link) => link.teamId !== teamId);

  return {
    weddingId: null,
    links: undefined,
    problem: null,
    load: (weddingId) =>
      attempt(async () => {
        const links = await fetchLinks(weddingId);
        applyConfirmations(links);
        return { weddingId, links };
      }),
    publish: (teamId) =>
      attempt(async () => {
        const held = get().links?.find((link) => link.teamId === teamId) ?? null;
        const published = await publishNow(wedding(), useKnotworkStore.getState().doc, teamId, held);
        return { links: [...others(teamId), published] };
      }),
    takeDown: (teamId) =>
      attempt(async () => {
        await takeDownNow(wedding(), teamId);
        return { links: others(teamId) };
      }),
    keepCurrent: () =>
      attempt(async () => {
        // Read again first: a partner's device may already have republished
        // this very change, and a supplier may have confirmed since.
        const weddingId = wedding();
        const current = await fetchLinks(weddingId);
        applyConfirmations(current);
        const { doc } = useKnotworkStore.getState();
        const links: SupplierLink[] = [];
        for (const link of current) {
          const sheet = callSheet(doc, link.teamId);
          if (!sheet) await takeDownNow(weddingId, link.teamId);
          else if (fingerprint(sheet) === link.fingerprint) links.push(link);
          else links.push(await publishNow(weddingId, doc, link.teamId, link));
        }
        return { links };
      }),
  };
});
