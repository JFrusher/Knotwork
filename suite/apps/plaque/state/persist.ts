import { designOf, type Design } from "./design";

export const VERSION = 2;

/**
 * The stationery slice as stored: the design, versioned and stamped. It
 * travels wherever the wedding does: this device, and the account when the
 * wedding is synced to one.
 *
 * Uploaded font and image binaries are NOT here. Those are separate keys in
 * IndexedDB — see blobStore.
 */
export interface Persisted extends Design {
  version: number;
  /** ISO time of the write. */
  savedAt: string | null;
}

export type LoadResult =
  | { status: "empty" }
  | { status: "ok"; data: Persisted }
  | { status: "discarded"; reason: string };

/**
 * Reads the stationery slice. Anything unreadable is discarded rather than
 * partially applied: a half-loaded template would put the user in a state
 * they cannot reason about or undo.
 *
 * A slice with no version was written by something other than Place cards —
 * an empty envelope, most likely — and is treated as nothing saved.
 */
export function load(slice: unknown): LoadResult {
  if (slice === null || slice === undefined) return { status: "empty" };
  if (!isRecord(slice)) return { status: "discarded", reason: "The saved design could not be read." };
  if (!("version" in slice)) return { status: "empty" };

  const version = slice["version"];
  if (version !== 1 && version !== VERSION) {
    return {
      status: "discarded",
      reason: "The saved design was made by a different version of Plaque.",
    };
  }

  const bad = firstBadDesignField(slice);
  if (bad) return { status: "discarded", reason: bad };

  if (!Array.isArray(slice["rows"]) || !Array.isArray(slice["headers"])) {
    return { status: "discarded", reason: "The saved guest list could not be read." };
  }

  const data = slice as unknown as Persisted;
  return {
    status: "ok",
    data: {
      version: VERSION,
      savedAt: typeof data.savedAt === "string" ? data.savedAt : null,
      ...designOf({
        ...data,
        // Absent in anything written before the sheet pane could be collapsed.
        sheetCollapsed: slice["sheetCollapsed"] === true,
        assetNames: isRecord(slice["assetNames"]) ? (slice["assetNames"] as Record<string, string>) : {},
        // Absent in anything written before per-row editing. Positional ids match
        // what buildArtefacts falls back to, so overrides keyed by them still land.
        rowIds: Array.isArray(slice["rowIds"])
          ? (slice["rowIds"] as string[])
          : (data.rows ?? []).map((_, i) => `r${i}`),
        merged: isRecord(slice["merged"]) ? (slice["merged"] as Persisted["merged"]) : {},
      }),
    },
  };
}

/** Returns a message naming the offending field, or null when the design is usable. */
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
