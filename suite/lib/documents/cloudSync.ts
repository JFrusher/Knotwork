import { del as idbDel, get as idbGet, set as idbSet } from "idb-keyval";
import type { Agreed } from "./mergeCloudDocument";
import type { WeddingListing } from "@/lib/accounts/handlers";

/**
 * The cloud transport, and what this device remembers about the wedding it
 * syncs with — kept separate from `useKnotworkStore` so both can be tested
 * with a fake `fetch` and a mocked `idb-keyval`.
 */

const LINK_KEY = "knotwork.cloud.link";

/**
 * Which account wedding this device's document belongs to, and what the two
 * last agreed on.
 *
 * Stored, not just held in memory, because a reload has to tell three things
 * apart: the same wedding with edits made while the account was out of reach
 * (merge them), a different wedding (ask), and a device that has never synced
 * (ask, if both sides have work in them). Held only in memory, every start
 * looked like the first, and replaced this device's document with the
 * account's — edits and all.
 */
export interface CloudLink {
  weddingId: string;
  version: number;
  /** Part by part — see `lib/documents/parts`. */
  agreed: Agreed;
}

export async function readLink(): Promise<CloudLink | null> {
  return ((await idbGet(LINK_KEY)) as CloudLink | undefined) ?? null;
}

export async function writeLink(link: CloudLink): Promise<void> {
  await idbSet(LINK_KEY, link);
}

export async function forgetLink(): Promise<void> {
  await idbDel(LINK_KEY);
}

export type WeddingsResult =
  | { ok: true; weddings: WeddingListing[] }
  | { ok: false; reason: "unreachable" | "unavailable" };

/** Every wedding the signed-in account is on. Never throws. */
export async function fetchWeddings(): Promise<WeddingsResult> {
  let response: Response;
  try {
    response = await fetch("/api/accounts/weddings");
  } catch {
    return { ok: false, reason: "unreachable" };
  }
  if (!response.ok) return { ok: false, reason: "unavailable" };
  const body = (await response.json()) as { weddings: WeddingListing[] };
  return { ok: true, weddings: body.weddings };
}

export type FetchResult =
  | { ok: true; weddingId: string; document: unknown; version: number }
  | { ok: false; reason: "unreachable" | "unavailable" };

/** Reads one wedding's document from the account. Never throws. */
export async function fetchCloudDocument(weddingId: string): Promise<FetchResult> {
  let response: Response;
  try {
    response = await fetch(`/api/documents?wedding=${encodeURIComponent(weddingId)}`, { method: "GET" });
  } catch {
    return { ok: false, reason: "unreachable" };
  }
  if (!response.ok) return { ok: false, reason: "unavailable" };
  const body = (await response.json()) as { weddingId: string; document: unknown; version: number };
  return { ok: true, weddingId: body.weddingId, document: body.document, version: body.version };
}

export type PushResult =
  | { ok: true; version: number; warnings: string[] }
  | { ok: false; reason: "queued" }
  | { ok: false; reason: "conflict"; version: number; document: unknown }
  | { ok: false; reason: "invalid"; errors: string[] }
  | { ok: false; reason: "unavailable" };

/**
 * Attempt a write immediately. A network failure is "queued": the change waits
 * in the local document, and the next push — on reconnect, or the next start,
 * which merges against the stored link — carries it. Everything else (a
 * conflict, a validation failure, the deployment not being configured) is a
 * real answer from the server and is surfaced as-is: retrying a rejected write
 * without the user reapplying anything would just be rejected again.
 */
export async function pushDocument(weddingId: string, document: unknown, expectedVersion: number): Promise<PushResult> {
  let response: Response;
  try {
    response = await fetch(`/api/documents?wedding=${encodeURIComponent(weddingId)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ document, expectedVersion }),
    });
  } catch {
    return { ok: false, reason: "queued" };
  }

  if (response.status === 200) {
    const body = (await response.json()) as { version: number; warnings: string[] };
    return { ok: true, version: body.version, warnings: body.warnings };
  }
  if (response.status === 409) {
    const body = (await response.json()) as { version: number; document: unknown };
    return { ok: false, reason: "conflict", version: body.version, document: body.document };
  }
  if (response.status === 422) {
    const body = (await response.json()) as { errors: string[] };
    return { ok: false, reason: "invalid", errors: body.errors };
  }
  return { ok: false, reason: "unavailable" };
}

/** One saved version in the account's history. */
export interface HistoryListing {
  id: string;
  savedAt: string;
  /** The email of whoever saved it, or null once they have left the wedding. */
  savedBy: string | null;
  yours: boolean;
}

export async function fetchHistory(weddingId: string): Promise<HistoryListing[]> {
  const response = await fetch(`/api/documents/history?wedding=${encodeURIComponent(weddingId)}`);
  const body = (await response.json().catch(() => null)) as { entries?: HistoryListing[]; error?: string } | null;
  if (!response.ok || !body?.entries) throw new Error(body?.error ?? "The history could not be loaded.");
  return body.entries;
}

export async function fetchHistoryDocument(weddingId: string, id: string): Promise<Record<string, unknown>> {
  const response = await fetch(`/api/documents/history/${encodeURIComponent(id)}?wedding=${encodeURIComponent(weddingId)}`);
  const body = (await response.json().catch(() => null)) as { document?: Record<string, unknown>; error?: string } | null;
  if (!response.ok || !body?.document) throw new Error(body?.error ?? "That version could not be loaded.");
  return body.document;
}
