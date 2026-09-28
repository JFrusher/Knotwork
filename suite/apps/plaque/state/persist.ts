import { readSlice, writeSlice } from "./sliceBridge";
import type { RowIssue, GuestRow } from "../core/data/rows";
import type { CardSpec, SheetSpec, Template } from "../core/types";
import type { Snapshot } from "./history";

const VERSION = 2;

/**
 * What survives a refresh. Guest data is included deliberately — losing a
 * hundred and fifty names to an accidental tab close is the worst papercut this
 * app could have. It travels wherever the wedding does: this device, and the
 * account when the wedding is synced to one.
 *
 * Undo history is here too, so a reload does not silently reset the depth of
 * work the user can back out of (S-D1.1). Snapshots hold the design only, never
 * the rows, so fifty of them cost very little.
 *
 * Uploaded font binaries are NOT here. Those are separate keys in the same
 * IndexedDB store — see blobStore.
 */
export interface Persisted {
  version: number;
  /** ISO time of the write. Drives the "restored from 13:42" notice. */
  savedAt: string | null;
  card: CardSpec;
  sheet: SheetSpec;
  template: Template;
  headers: string[];
  rows: GuestRow[];
  /** Row identity and combines, without which per-row overrides lose their anchor. */
  rowIds: string[];
  merged: Record<string, { indexes: number[]; ids: string[]; rows: GuestRow[] }>;
  csvIssues: RowIssue[];
  fileName: string | null;
  uploadedIcons: Record<string, string>;
  snapEnabled: boolean;
  /** Workspace layout, not design: which pane the user last chose to see. */
  sheetCollapsed?: boolean;
  /** Filenames of uploaded assets, so a lost blob can still be named (S-D1.4). */
  assetNames: Record<string, string>;
  past: Snapshot[];
  future: Snapshot[];
}

export type SaveInput = Omit<Persisted, "version" | "savedAt">;

export type LoadResult =
  | { status: "empty" }
  | { status: "ok"; data: Persisted }
  | { status: "discarded"; reason: string };

/**
 * Reports its own failure rather than swallowing it. A save the user believes
 * happened and did not is the one outcome this file exists to prevent — the
 * caller puts that on screen (S-D1.2).
 */
export type SaveResult = { ok: true } | { ok: false; reason: string };

export async function save(data: SaveInput): Promise<SaveResult> {
  const record: Persisted = { version: VERSION, savedAt: new Date().toISOString(), ...data };
  try {
    // Into the shared document rather than a key of Plaque's own, so the
    // stationery travels with the wedding — through the backup, the sync and
    // the guest link — instead of being a second thing to remember to save.
    writeSlice(record);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: saveFailureReason(e) };
  }
}

/**
 * Plain language for the three ways a browser refuses a write. The distinction
 * matters because the remedy differs: space can be freed, a private window
 * cannot be talked round.
 */
export function saveFailureReason(e: unknown): string {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "QuotaExceededError") {
    return "This browser has no room left to save Plaque's work.";
  }
  if (name === "SecurityError" || name === "InvalidStateError" || name === "UnknownError") {
    return "This browser is blocking storage — a private window usually is.";
  }
  return e instanceof Error && e.message ? e.message : "This browser refused to save.";
}

/** Reads the design from the shared wedding's `stationery` slice. */
export function read(): LoadResult {
  const fromSlice = readSlice();
  return fromSlice ? load(JSON.stringify(fromSlice)) : { status: "empty" };
}

/**
 * Anything unreadable is discarded rather than partially applied. A half-loaded
 * template would put the user in a state they cannot reason about or undo.
 */
export function load(raw: string | null): LoadResult {
  if (!raw) return { status: "empty" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: "discarded", reason: "The saved design could not be read." };
  }

  if (!isRecord(parsed)) {
    return { status: "discarded", reason: "The saved design could not be read." };
  }
  const version = parsed["version"];
  if (version !== 1 && version !== VERSION) {
    return {
      status: "discarded",
      reason: "The saved design was made by a different version of Plaque.",
    };
  }

  const bad = firstBadDesignField(parsed);
  if (bad) return { status: "discarded", reason: bad };

  if (!Array.isArray(parsed["rows"]) || !Array.isArray(parsed["headers"])) {
    return { status: "discarded", reason: "The saved guest list could not be read." };
  }

  // v1 predates both fields. History that does not survive validation is
  // dropped rather than discarding the design with it: losing undo depth is a
  // papercut, losing the work is not.
  const data = parsed as unknown as Persisted;
  return {
    status: "ok",
    data: {
      ...data,
      version: VERSION,
      savedAt: typeof data.savedAt === "string" ? data.savedAt : null,
      // Absent in anything written before the sheet pane could be collapsed.
      sheetCollapsed: parsed["sheetCollapsed"] === true,
      assetNames: isRecord(parsed["assetNames"])
        ? (parsed["assetNames"] as Record<string, string>)
        : {},
      // Absent in anything written before per-row editing. Positional ids match
      // what buildArtefacts falls back to, so overrides keyed by them still land.
      rowIds: Array.isArray(parsed["rowIds"])
        ? (parsed["rowIds"] as string[])
        : (data.rows ?? []).map((_, i) => `r${i}`),
      merged: isRecord(parsed["merged"]) ? (parsed["merged"] as Persisted["merged"]) : {},
      past: validSnapshots(parsed["past"]),
      future: validSnapshots(parsed["future"]),
    },
  };
}

/**
 * Returns a message naming the offending field, or null when the design is
 * usable. Shared by the top-level check and every history entry, because an
 * unusable snapshot breaks undo the same way an unusable design breaks load.
 */
function firstBadDesignField(source: Record<string, unknown>): string | null {
  if (!isRecord(source["card"]) || !isRecord(source["sheet"]) || !isRecord(source["template"])) {
    return "The saved design was incomplete.";
  }
  if (!Array.isArray((source["template"] as Record<string, unknown>)["elements"])) {
    return "The saved design was incomplete.";
  }

  // Every geometry field has to be a real, finite number. A string or a NaN in
  // here propagates into the layout maths and produces zero sheets with no
  // error anywhere — a state the user cannot understand or undo out of.
  const badCard = firstBadNumber(source["card"] as Record<string, unknown>, CARD_NUMBERS);
  const badSheet = firstBadNumber(source["sheet"] as Record<string, unknown>, SHEET_NUMBERS);
  if (badCard || badSheet) {
    return `The saved design had an unusable value for "${badCard ?? badSheet}".`;
  }
  return null;
}

function validSnapshots(value: unknown): Snapshot[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is Snapshot => isRecord(entry) && firstBadDesignField(entry) === null,
  );
}

const CARD_NUMBERS = ["widthMm", "heightMm", "foldPositionMm", "bleedMm"] as const;
const SHEET_NUMBERS = [
  "marginTopMm",
  "marginRightMm",
  "marginBottomMm",
  "marginLeftMm",
  "gapXMm",
  "gapYMm",
  "cardRotationDeg",
  "printerMarginMm",
] as const;

function firstBadNumber(source: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value !== "number" || !Number.isFinite(value)) return key;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
