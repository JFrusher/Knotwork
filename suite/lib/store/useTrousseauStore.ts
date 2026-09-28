import { get as idbGet, set as idbSet } from "idb-keyval";
import { promoteSources } from "@/lib/model/promote";
import { migrateLegacyKeys } from "./migrateKeys";
import { create } from "zustand";
import {
  emptyTrousseau,
  mergeSlice,
  migrate,
  type SliceName,
  type Trousseau,
} from "@jfrusher/trousseau";
import {
  fetchCloudDocument,
  fetchWeddings,
  pushDocument,
  readLink,
  writeLink,
  type CloudLink,
  type PushResult,
} from "@/lib/documents/cloudSync";
import type { WeddingListing } from "@/lib/accounts/handlers";
import { fingerprintParts, mergeCloudDocument, type Agreed, type PartConflict } from "@/lib/documents/mergeCloudDocument";
import { partInfo, partsOf, withPart } from "@/lib/documents/parts";
import { publishDay, readTimeline } from "@/lib/model/slices";
import { fingerprint } from "@/lib/documents/fingerprint";
import { syncAssets } from "@/lib/documents/assets";
import { hasContent, summarise } from "@/lib/model/content";
import { useCopies } from "./copies";
import { useWeddings } from "./weddings";
import { readOpenChoice } from "./openWedding";
import type { ToolId } from "./toolGeneration";

/**
 * The one store the whole suite reads.
 *
 * Its shape is the Trousseau envelope — `event`, `guests`, `seating`, `day`,
 * `crew`, `stationery` — rather than a flat bag of guests and tables, because
 * that envelope already exists, is validated by zod, and encodes the rule the
 * four apps were built around: one owner per slice, and every other key copied
 * byte-for-byte. A flat model would have to invent a fifth version of what a
 * guest is, and would drop any key belonging to a tool not yet written.
 *
 * Two copies of the document are held on purpose:
 *
 * - `raw` is what was stored, untouched. Every write goes through `mergeSlice`
 *   on `raw`, so a wrong schema can at worst refuse a read — it can never
 *   destroy a write.
 * - `doc` is `raw` parsed, for reading. Parsed once per mutation rather than
 *   once per render, because zod over a 100 KB document is not free.
 */

/** IndexedDB, via idb-keyval — the same engine the four tools already use. */
export const STORAGE_KEY = "trousseau.document";

/**
 * Trailing delay before a local write is pushed to the cloud. Bursts of edits
 * become one request. The local write itself is never delayed — see `persist`.
 */
const CLOUD_PUSH_DELAY_MS = 250;

export type StoreStatus = "idle" | "loading" | "ready" | "error";

/** How deep undo goes. Fifty documents of a wedding is a few megabytes at most. */
const HISTORY_LIMIT = 50;

/**
 * Two edits carrying the same label within this window become one undo step.
 *
 * Without it, typing "Table 7" into a name field is seven separate undos, and
 * dragging a table across the room is one per frame.
 */
const COALESCE_MS = 700;

export interface HistoryEntry {
  raw: Record<string, unknown>;
  /** What the user did, for the undo tooltip. Also the coalescing key. */
  label: string;
  at: number;
}

export interface WriteOptions {
  /** Shown as "Undo <label>". Edits sharing a label coalesce while typing. */
  label?: string;
  /**
   * Keep this change out of the undo stack entirely. For writes the user did
   * not make — reconciling a restored document, republishing the resolved day.
   */
  silent?: boolean;
  /**
   * The tool making this write, when it is one. Its own write is not news to
   * the copy it holds; a write to that slice from anywhere else is — see `held`.
   */
  by?: ToolId;
}

export interface TrousseauState {
  /**
   * Bumped whenever the whole document is swapped rather than edited — a
   * restore from file, or a shared wedding opened from another machine — and
   * whenever a slice an open tool holds is written by something else.
   *
   * The tools each keep a store of their own, seeded once when they mount, so
   * replacing the document underneath a tool leaves it holding the previous
   * wedding with no idea anything happened. It shows the old guest list, and
   * then autosaves it over the new one. This is how anything that read the
   * document can tell that what it read has been thrown away.
   */
  generation: number;

  /**
   * The slices each open tool has copied into a store of its own.
   *
   * A write to one of them from anywhere but that tool starts a new
   * `generation`, for the same reason a restore does: the tool's copy is now
   * older than the document, and its next save would write the old one back.
   * The Data panel is where that happened — it opens over the tool on screen.
   */
  held: Partial<Record<ToolId, readonly SliceName[]>>;
  /** Called by `WhenDocumentReady` as a tool opens, and `release` as it closes. */
  hold: (tool: ToolId, slices: readonly SliceName[]) => void;
  release: (tool: ToolId) => void;

  status: StoreStatus;
  /** Set when the stored bytes could not be read. Writes are refused while it is. */
  error: string | null;
  /**
   * Set when the last write to this device failed — a full disk, a browser
   * that stopped allowing storage — and cleared by the next one that lands.
   * Kept apart from `error`: that one means the wedding could not be read and
   * every write is refused; this one means the edit on screen is not stored.
   */
  saveError: string | null;
  /** ISO time of the last successful write. Drives the "saved 13:42" notice. */
  savedAt: string | null;
  /** The stored document, exactly as stored. Never the parsed one. */
  raw: Record<string, unknown>;
  /** The stored document, parsed. Read from this. */
  doc: Trousseau;

  /** Whole documents, oldest first. Undo pops the last. */
  past: HistoryEntry[];
  future: HistoryEntry[];

  /** Read the document from IndexedDB. Safe to call more than once. */
  hydrate: () => Promise<void>;
  /** Publish one slice. Every other key survives untouched. */
  setSlice: (slice: SliceName, value: unknown, options?: WriteOptions) => void;
  /**
   * Publish several slices as one change. Editing the timeline also republishes
   * the resolved day, and the two must never be separately observable — a
   * render between them would show a day that disagrees with the blocks it came
   * from.
   */
  setSlices: (entries: Array<[SliceName, unknown]>, options?: WriteOptions) => void;
  /** Replace the whole document — a JSON restore, or a fresh start. */
  replaceDocument: (next: unknown, options?: WriteOptions) => void;
  undo: () => void;
  redo: () => void;

  /**
   * `"disabled"` until `startCloudSync()` runs (accounts configured and the
   * caller has a wedding) — every other state is only reachable after that.
   */
  cloudStatus: "disabled" | "idle" | "syncing" | "queued" | "conflict" | "choosing" | "error";
  cloudError: string | null;
  /** The version this device last confirmed the cloud holds, or null before the first sync. */
  cloudVersion: number | null;
  /** Fingerprint of each part as last agreed with the server — the merge baseline. See `lib/documents/parts`. */
  cloudAgreed: Agreed;
  /** Parts changed on both sides since the last agreement. Surfaced, never auto-merged. */
  cloudConflicts: PartConflict[];
  /**
   * The account wedding this device's document is synced with, once settled.
   * Also asset sync's Storage path. Stored with `cloudVersion` and
   * `cloudAgreed` as the link — see `CloudLink`.
   */
  weddingId: string | null;
  /**
   * While `choosing`: the account's wedding, held until the person picks
   * between it and the different one on this device. Nothing syncs meanwhile.
   */
  cloudChoice: { weddingId: string; version: number; document: Record<string, unknown> } | null;

  /** Called once, after local hydration. Decides how this device and the account's wedding meet. */
  startCloudSync: () => Promise<void>;
  /** Settle `choosing`: keep one wedding, and keep the other as a copy on this device. */
  chooseWedding: (keep: "device" | "account") => Promise<void>;
  /** Push the current document now. Called after every local write, and on reconnect for the queue. */
  syncToCloud: () => Promise<void>;
  /** Pull the server's current document and merge it in, part by part. Called on an interval and on focus. */
  pullFromCloud: () => Promise<void>;
  /** Settle one part's conflict: take the server's value, or keep the local one. */
  resolveConflict: (key: string, choice: "theirs" | "mine") => void;
}

/** The day as published from a document's own timeline and event. */
function dayOf(raw: Record<string, unknown>): Record<string, unknown> {
  const doc = migrate(raw);
  return publishDay(doc, readTimeline(doc));
}

function freshDoc(): { raw: Record<string, unknown>; doc: Trousseau } {
  const doc = emptyTrousseau();
  return { raw: doc as unknown as Record<string, unknown>, doc };
}

export const useTrousseauStore = create<TrousseauState>()((set, get) => ({
  generation: 0,
  held: {},
  hold: (tool, slices) => set((state) => ({ held: { ...state.held, [tool]: slices } })),
  release: (tool) =>
    set((state) => {
      const held = { ...state.held };
      delete held[tool];
      return { held };
    }),
  status: "idle",
  error: null,
  saveError: null,
  savedAt: null,
  ...freshDoc(),

  hydrate: async () => {
    if (get().status !== "idle") return;
    set({ status: "loading" });

    // Data written when the app was briefly called something else lives under
    // the old keys, and is moved before the first read or this opens empty.
    //
    // Deliberately outside the read's own try: a rename is housekeeping, and a
    // failure here must not put the store into its "cannot read the document"
    // state and refuse every write. Worst case the old copy stays where it is
    // and the app opens on whatever the current key holds.
    try {
      await migrateLegacyKeys();
    } catch {
      // Nothing to tell the user. The read below is what actually matters.
    }

    let stored: unknown;
    try {
      stored = await idbGet(STORAGE_KEY);
    } catch (cause) {
      set({ status: "error", error: `Local storage could not be read: ${message(cause)}` });
      return;
    }

    if (stored === undefined) {
      set({ status: "ready", error: null, past: [], future: [] });
      return;
    }

    const raw = asRecord(stored);
    try {
      // A load is where history begins; there is nothing before it to undo to.
      set({ status: "ready", error: null, raw, doc: migrate(raw), past: [], future: [] });
    } catch (cause) {
      // The bytes stay exactly where they are. Refusing to read is recoverable;
      // writing over an unreadable document is not.
      set({
        status: "error",
        error: `The saved wedding could not be read: ${message(cause)}`,
        raw,
      });
    }
  },

  past: [],
  future: [],

  setSlice: (slice, value, options) => get().setSlices([[slice, value]], options),

  setSlices: (entries, options = {}) => {
    const state = get();
    // Refused while the stored document is unreadable. Writing over bytes we
    // could not parse is the one unrecoverable outcome.
    if (state.status !== "ready") return;
    const raw = entries.reduce<Record<string, unknown>>(
      (acc, [slice, value]) => mergeSlice(acc, slice, value),
      state.raw,
    );
    // An open tool's copy of one of these slices is now out of date — unless
    // that tool is the one writing.
    const outdated = (Object.keys(state.held) as ToolId[]).some(
      (tool) =>
        tool !== options.by &&
        entries.some(([slice]) => state.held[tool]?.includes(slice)),
    );

    set({
      raw,
      doc: migrate(raw),
      ...(outdated ? { generation: state.generation + 1 } : {}),
      ...(options.silent
        ? {}
        : {
            past: pushHistory(state.past, state.raw, options.label ?? "change"),
            // A new edit after an undo abandons the redo branch. Keeping it
            // would let redo replay changes that never followed this state.
            future: [],
          }),
    });
    persist(raw);
  },

  replaceDocument: (next, options = {}) => {
    const state = get();
    // A collected document keeps each tool's export under `sources` and leaves
    // the slices empty. Both shapes are valid and both are called
    // `.trousseau.json`, so accepting either here is the difference between a
    // restore that works and one that reports success over an empty app.
    const raw = promoteSources(asRecord(next)).raw;
    set({
      status: "ready",
      error: null,
      raw,
      doc: migrate(raw),
      generation: state.generation + 1,
      // A restore is undoable: opening the wrong file should not cost the work.
      // Adopting the cloud's copy is `silent`, though — the user did not make
      // that change, and offering to undo it would offer to overwrite the
      // cloud with the document it just replaced.
      past: options.silent
        ? state.past
        : state.status === "ready"
          ? pushHistory(state.past, state.raw, options.label ?? "restore")
          : [],
      future: options.silent ? state.future : [],
    });
    persist(raw);
  },

  undo: () => {
    const state = get();
    const previous = state.past[state.past.length - 1];
    if (!previous) return;
    try {
      const doc = migrate(previous.raw);
      set({
        raw: previous.raw,
        doc,
        past: state.past.slice(0, -1),
        future: [...state.future, { raw: state.raw, label: previous.label, at: Date.now() }],
      });
      persist(previous.raw);
    } catch {
      // A history entry that no longer parses is dropped rather than restored.
      // It can only happen if a schema changed under a live session, and the
      // alternative is putting the store into its unreadable state by hand.
      set({ past: state.past.slice(0, -1) });
    }
  },

  redo: () => {
    const state = get();
    const next = state.future[state.future.length - 1];
    if (!next) return;
    try {
      set({
        raw: next.raw,
        doc: migrate(next.raw),
        past: pushHistory(state.past, state.raw, next.label),
        future: state.future.slice(0, -1),
      });
      persist(next.raw);
    } catch {
      set({ future: state.future.slice(0, -1) });
    }
  },

  cloudStatus: "disabled",
  cloudError: null,
  cloudVersion: null,
  cloudAgreed: {},
  cloudConflicts: [],
  weddingId: null,
  cloudChoice: null,

  startCloudSync: async () => {
    // A document this device could not read is never synced over: adopting
    // the account's copy would write over the bytes `hydrate` refused to touch.
    if (get().status !== "ready") return;
    set({ cloudStatus: "syncing" });
    const [listed, link, chosen] = await Promise.all([fetchWeddings(), readLink(), readOpenChoice()]);
    if (!listed.ok) {
      if (listed.reason === "unreachable" && link) {
        // Out of reach, but a wedding this device knows. Keep measuring
        // against what the two last agreed, so the push on reconnect merges
        // instead of conflicting over every slice.
        set({
          cloudStatus: "error",
          cloudError: "The cloud could not be reached.",
          weddingId: link.weddingId,
          cloudVersion: link.version,
          cloudAgreed: link.agreed,
        });
        return;
      }
      // "unavailable" covers "accounts not configured" and "signed out" —
      // either way cloud sync does not start, and local-only behaviour
      // continues exactly as it already does.
      set({ cloudStatus: listed.reason === "unreachable" ? "error" : "disabled" });
      return;
    }
    useWeddings.getState().listed(listed.weddings);

    const target = weddingToOpen(listed.weddings, chosen, link);
    // No wedding yet, or a planner with several and none of them open here:
    // the switcher offers them, and opening one starts this again.
    if (target === null) {
      set({ cloudStatus: "disabled" });
      return;
    }
    const result = await fetchCloudDocument(target);
    if (!result.ok) {
      set({ cloudStatus: result.reason === "unreachable" ? "error" : "disabled" });
      return;
    }

    const local = get().raw;
    const account = asRecord(result.document);
    // Nothing is replaced silently when both sides have work in them.
    if (!hasContent(summarise(account))) {
      set({ weddingId: result.weddingId });
      if (hasContent(summarise(local))) {
        applyCloudResult(await pushDocument(result.weddingId, local, result.version), local);
      } else {
        agreeOn(local, result.version);
      }
    } else if (!hasContent(summarise(local))) {
      get().replaceDocument(account, { silent: true });
      set({ weddingId: result.weddingId });
      agreeOn(account, result.version);
    } else if (link !== null && link.weddingId === result.weddingId) {
      // The same wedding: what changed here while the account was out of
      // reach, merged with what changed there, exactly as a poll would.
      const merged = mergeCloudDocument(local, account, link.agreed, dayOf);
      if (merged.adopted || merged.conflicts.length > 0) get().replaceDocument(merged.raw, { silent: true });
      set({
        weddingId: result.weddingId,
        cloudStatus: merged.conflicts.length > 0 ? "conflict" : "idle",
        cloudVersion: result.version,
        cloudAgreed: merged.agreed,
        cloudConflicts: merged.conflicts,
        cloudError: null,
      });
      const kept = fingerprintParts(merged.raw);
      const unpushed = Object.entries(kept).some(([key, fp]) => merged.agreed[key] !== fp);
      if (merged.conflicts.length === 0 && unpushed) void get().syncToCloud();
    } else {
      set({
        cloudStatus: "choosing",
        cloudChoice: { weddingId: result.weddingId, version: result.version, document: account },
      });
      return;
    }
    void syncAssets(result.weddingId);
  },

  chooseWedding: async (keep) => {
    const { cloudChoice: choice, raw } = get();
    if (!choice) throw new Error("There is no choice between weddings to make.");
    if (keep === "account") {
      // The copy first, and awaited: this device's wedding is stored before
      // anything replaces it.
      await useCopies.getState().keep(raw, "This device’s wedding, replaced by your account’s when you signed in.");
      set({ cloudChoice: null, weddingId: choice.weddingId });
      get().replaceDocument(choice.document, { silent: true });
      // Undo reaches back into the other wedding otherwise.
      set({ past: [], future: [] });
      agreeOn(choice.document, choice.version);
    } else {
      const result = await pushDocument(choice.weddingId, raw, choice.version);
      if (!result.ok) {
        // The question stays open either way. Moved while it was open:
        // merging would mix two weddings a slice at a time, so it is asked
        // again about what the account holds now. Not sent: nothing changed.
        set(
          result.reason === "conflict"
            ? {
                cloudChoice: { weddingId: choice.weddingId, version: result.version, document: asRecord(result.document) },
                cloudError: null,
              }
            : { cloudError: "Your account could not be reached, so nothing has changed. Try again." },
        );
        return;
      }
      // After the push rather than before: the account's own history already
      // holds what it replaced, so this copy is the convenient one, not the
      // only one.
      await useCopies.getState().keep(choice.document, "Your account’s wedding, replaced by this device’s when you signed in.");
      set({ cloudChoice: null, weddingId: choice.weddingId });
      applyCloudResult(result, raw);
    }
    void syncAssets(choice.weddingId);
  },

  syncToCloud: async () => {
    const state = get();
    // "conflict" refuses as firmly as "disabled" does. Both conflict paths
    // below call `replaceDocument`, which schedules a persist, whose timer
    // ends here 250ms later — pushing the merged document (still holding
    // *local's* value for every conflicted slice) at the version the server
    // just reported. The compare-and-set would succeed, the partner's edit
    // would be gone, and the conflict UI would clear itself having chosen
    // "keep mine" on the user's behalf. Nothing is pushed until the last
    // conflict is resolved; `resolveConflict` then schedules its own push.
    // "choosing" refuses too: until the person picks, this device's document
    // is not the account's to overwrite. So does not knowing which wedding
    // this is — a start that never reached the account.
    const { weddingId } = state;
    if (
      weddingId === null ||
      state.cloudStatus === "disabled" ||
      state.cloudStatus === "conflict" ||
      state.cloudStatus === "choosing"
    ) {
      return;
    }
    set({ cloudStatus: "syncing" });
    const pushed = state.raw;
    const result = await pushDocument(weddingId, pushed, state.cloudVersion ?? 0);
    applyCloudResult(result, pushed);
  },

  pullFromCloud: async () => {
    const before = get();
    if (before.cloudStatus === "disabled" || before.cloudStatus === "syncing" || before.cloudStatus === "choosing") {
      return;
    }
    // A pull with nothing agreed yet is not a valid pull: with an empty
    // `cloudAgreed`, every slice classifies as changed-on-both-sides against
    // every other slice. `startCloudSync` leaves exactly that state
    // (`cloudVersion: null`) when its first fetch was unreachable, so the
    // next successful poll would otherwise turn a transient network failure
    // into a document-wide conflict. Wait for a full sync to set a baseline.
    if (before.cloudVersion === null || before.weddingId === null) return;

    const result = await fetchCloudDocument(before.weddingId);
    if (!result.ok) {
      if (result.reason === "unreachable") {
        set({ cloudStatus: "error", cloudError: "The cloud could not be reached." });
      } else {
        // Refused: most likely this account was taken off the wedding while
        // the tab was open. Which wedding this device holds is a start's
        // decision, not a merge's.
        await get().startCloudSync();
      }
      return;
    }

    // Re-read after the awaits above. The snapshot taken before the fetch is
    // one network round trip old; merging against it would discard anything
    // the user typed while it was in flight and then push the discard.
    const state = get();
    if (state.cloudStatus === "disabled" || state.cloudStatus === "syncing") return;
    // Nothing has changed on the server since we last agreed - the common
    // case on every tick of the poll.
    if (result.version === state.cloudVersion) return;

    const serverRaw = (result.document ?? {}) as Record<string, unknown>;
    const merged = mergeCloudDocument(state.raw, serverRaw, state.cloudAgreed, dayOf);

    if (merged.conflicts.length > 0) {
      get().replaceDocument(merged.raw, { silent: true });
      set({
        cloudStatus: "conflict",
        cloudConflicts: merged.conflicts,
        cloudVersion: result.version,
        cloudAgreed: merged.agreed,
      });
    } else if (merged.adopted) {
      get().replaceDocument(merged.raw, { silent: true });
      set({ cloudVersion: result.version, cloudAgreed: merged.agreed });
      void get().syncToCloud();
    } else {
      // The version moved but nothing here changed — usually our own write
      // coming back, or the other tab echoing it. Record the version and
      // stop: replacing the document would remount every tool for nothing,
      // and pushing it back is how two open tabs ping-pong forever.
      set({ cloudVersion: result.version, cloudAgreed: merged.agreed });
    }

    // Something moved elsewhere, so fonts and artwork may have too.
    const { weddingId } = get();
    if (weddingId) void syncAssets(weddingId);
  },

  resolveConflict: (key, choice) => {
    const state = get();
    const conflict = state.cloudConflicts.find((c) => c.key === key);
    if (!conflict) return;
    const remaining = state.cloudConflicts.filter((c) => c.key !== key);
    let raw = choice === "theirs" ? withPart(state.raw, key, conflict.theirs) : state.raw;
    // The published day follows the timeline and the event it is made from.
    const { slice } = partInfo(key);
    if (choice === "theirs" && (slice === "timeline" || slice === "event")) raw = { ...raw, day: dayOf(raw) };
    const resolved = partsOf(raw).get(key);
    const cloudAgreed = { ...state.cloudAgreed };
    // A part taken out on the side chosen is agreed as not there.
    if (resolved === undefined) delete cloudAgreed[key];
    else cloudAgreed[key] = fingerprint(resolved);

    set({
      raw,
      doc: migrate(raw),
      // Bumped for the same reason `replaceDocument` bumps it: a tool mounted
      // before the resolution still holds the pre-resolution slice, and
      // `toolGeneration`'s `mayWrite()` would let its next autosave write that
      // back — silently undoing the choice and pushing the undo to the cloud.
      generation: state.generation + 1,
      cloudConflicts: remaining,
      cloudAgreed,
      // Still "conflict" while any remain, which keeps `syncToCloud` refusing
      // to push a half-resolved document. The last resolution flips it to
      // "idle", and the persist scheduled below then pushes normally.
      cloudStatus: remaining.length > 0 ? "conflict" : "idle",
    });
    persist(raw);
  },
}));

/**
 * Add a document to the undo stack, folding it into the last entry when the two
 * are the same action moments apart.
 *
 * Coalescing looks at the entry already on the stack rather than the incoming
 * one, because the stack holds *previous* states: keeping the older of two
 * consecutive keystrokes is what makes one undo jump back to before the word.
 */
function pushHistory(
  past: HistoryEntry[],
  raw: Record<string, unknown>,
  label: string,
): HistoryEntry[] {
  const last = past[past.length - 1];
  if (last && last.label === label && Date.now() - last.at < COALESCE_MS) {
    return [...past.slice(0, -1), { ...last, at: Date.now() }];
  }
  const next = [...past, { raw, label, at: Date.now() }];
  return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
}

/** Guests are a record keyed by id, so the badge is a key count. */
export const selectGuestCount = (s: TrousseauState): number => Object.keys(s.doc.guests).length;
export const selectTableCount = (s: TrousseauState): number => Object.keys(s.doc.seating).length;
export const selectBlockCount = (s: TrousseauState): number => s.doc.day?.blocks.length ?? 0;

/**
 * Write the document to IndexedDB now, then push it to the cloud shortly after.
 *
 * The local write is started synchronously, never from a timer. The tools
 * hand over their last edit from `beforeunload` and `pagehide`, and a timer
 * started there never fires: the page is gone first. A write deferred by even
 * 250ms lost every Seating edit made in the half-minute before a reload.
 * IndexedDB runs transactions in the order they were opened, so the last
 * write always lands last.
 */
function persist(raw: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const noted = (cause: unknown) =>
    // A save the user believes happened and did not is the worst outcome
    // here, so it goes on screen rather than into the console.
    useTrousseauStore.setState({ saveError: `The wedding could not be saved: ${message(cause)}` });
  try {
    // `idbSet` opens the database synchronously, so a browser that refuses
    // one throws here rather than rejecting.
    void idbSet(STORAGE_KEY, raw).then(() => {
      useTrousseauStore.setState({ savedAt: new Date().toISOString(), saveError: null });
      // Only after the local write has landed. Local storage is the record
      // of what the user has if the cloud is unreachable, so it goes first.
      scheduleCloudPush();
    }, noted);
  } catch (cause) {
    noted(cause);
  }
}

let cloudPushTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleCloudPush(): void {
  clearTimeout(cloudPushTimer);
  cloudPushTimer = setTimeout(() => void useTrousseauStore.getState().syncToCloud(), CLOUD_PUSH_DELAY_MS);
}

/**
 * Which of the account's weddings this device holds, while the account is
 * still on it: the one last opened here; else the one it last synced with;
 * else the couple's own; else the only one. A planner with several clients
 * and none opened here chooses.
 */
export function weddingToOpen(weddings: WeddingListing[], chosen: string | null, link: CloudLink | null): string | null {
  const on = (weddingId: string | undefined) => weddings.some((w) => w.weddingId === weddingId);
  if (chosen && on(chosen)) return chosen;
  if (link && on(link.weddingId)) return link.weddingId;
  const own = weddings.find((w) => w.role === "partner");
  if (own) return own.weddingId;
  return weddings.length === 1 ? weddings[0]!.weddingId : null;
}

/** Record that this device and the account hold the same document. */
function agreeOn(raw: Record<string, unknown>, version: number): void {
  useTrousseauStore.setState({
    cloudStatus: "idle",
    cloudVersion: version,
    cloudAgreed: fingerprintParts(raw),
    cloudConflicts: [],
    cloudError: null,
  });
}

// Whatever changes the agreement is stored with it — see `CloudLink`. One
// subscription rather than a write beside every `setState` that touches these,
// so no path can move the baseline without storing it.
useTrousseauStore.subscribe((state, prev) => {
  if (typeof window === "undefined") return;
  if (state.weddingId === null || state.cloudVersion === null) return;
  if (
    state.weddingId === prev.weddingId &&
    state.cloudVersion === prev.cloudVersion &&
    state.cloudAgreed === prev.cloudAgreed
  ) {
    return;
  }
  void writeLink({ weddingId: state.weddingId, version: state.cloudVersion, agreed: state.cloudAgreed });
});

/**
 * Fold a write's answer back into the store.
 *
 * Shared by every path that pushes, and deliberately not a store action: it is
 * called from `persist`'s timer as well as from the actions, and
 * reaching for `setState` directly is what the persist path already does.
 *
 * A conflict is merged per slice, never overwritten wholesale. Slices that
 * changed on both sides are parked in `cloudConflicts` for the user to choose
 * between; every other slice's server value is adopted immediately.
 *
 * `pushed` is the document the caller actually sent. Agreement is recorded
 * against *that*, not against whatever `raw` happens to be when the response
 * lands: a keystroke during the round trip would otherwise be recorded as
 * agreed with a server that never received it, and the next merge would treat
 * that slice as unchanged here and quietly take the partner's value over it.
 */
function applyCloudResult(result: PushResult, pushed?: Record<string, unknown>): void {
  if (result.ok) {
    useTrousseauStore.setState({
      cloudStatus: "idle",
      cloudVersion: result.version,
      cloudConflicts: [],
      cloudAgreed: fingerprintParts(pushed ?? useTrousseauStore.getState().raw),
      cloudError: null,
    });
    // No asset sync here. This runs after every debounced edit burst, and
    // fonts and artwork only change on upload — listing the bucket and
    // reading every blob out of IndexedDB on each keystroke burst buys
    // nothing. `startCloudSync` and `pullFromCloud` cover the two cases where
    // something might actually have changed elsewhere.
    return;
  }
  if (result.reason === "conflict") {
    const state = useTrousseauStore.getState();
    const merged = mergeCloudDocument(state.raw, result.document as Record<string, unknown>, state.cloudAgreed, dayOf);
    state.replaceDocument(merged.raw, { silent: true });

    if (merged.conflicts.length > 0) {
      useTrousseauStore.setState({
        cloudStatus: "conflict",
        cloudConflicts: merged.conflicts,
        cloudVersion: result.version,
        cloudAgreed: merged.agreed,
      });
    } else {
      // Every differing slice resolved cleanly - finalize by pushing the
      // merged document at the version the server just reported.
      useTrousseauStore.setState({ cloudVersion: result.version, cloudAgreed: merged.agreed });
      void useTrousseauStore.getState().syncToCloud();
    }
    return;
  }
  if (result.reason === "queued") {
    useTrousseauStore.setState({ cloudStatus: "queued" });
    return;
  }
  if (result.reason === "invalid") {
    useTrousseauStore.setState({
      cloudStatus: "error",
      cloudError: `This wedding could not be saved to the cloud: ${result.errors.join("; ")}`,
    });
    return;
  }
  useTrousseauStore.setState({ cloudStatus: "error", cloudError: "The cloud could not be reached." });
}

/**
 * For tests: settle the local write and cancel the pending cloud push, so a
 * push scheduled in one test cannot fire against the next test's mocks.
 */
export async function flushPersist(): Promise<void> {
  clearTimeout(cloudPushTimer);
  if (typeof window === "undefined") return;
  await idbSet(STORAGE_KEY, useTrousseauStore.getState().raw);
  useTrousseauStore.setState({ savedAt: new Date().toISOString() });
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
