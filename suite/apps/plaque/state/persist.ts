import type { Piece, Suite } from "./design";
import { SUITE_VERSION, isRecord, storedPieces } from "./suite";

export const VERSION = SUITE_VERSION;

/**
 * The stationery slice as stored: the suite of pieces, versioned and stamped.
 * It travels wherever the wedding does: this device, and the account when the
 * wedding is synced to one.
 *
 * Uploaded font and image binaries are NOT here. Those are separate keys in
 * IndexedDB — see blobStore.
 */
export interface Persisted extends Suite {
  version: number;
  /** ISO time of the write. */
  savedAt: string | null;
}

export type LoadResult =
  | { status: "empty" }
  /** `problem` names any piece that could not be read and was left out. */
  | { status: "ok"; data: Persisted; problem: string | null }
  | { status: "discarded"; reason: string };

/**
 * Reads the stationery slice. A piece that cannot be read is left out whole
 * rather than partially applied — a half-loaded template would put the user in
 * a state they cannot reason about or undo — and named, so its loss is never
 * silent. With no readable piece at all, the slice is discarded.
 *
 * A slice with no version was written by something other than Place cards —
 * an empty envelope, most likely — and is treated as nothing saved.
 */
export function load(slice: unknown): LoadResult {
  if (slice === null || slice === undefined) return { status: "empty" };
  if (!isRecord(slice)) return { status: "discarded", reason: "The saved design could not be read." };
  if (!("version" in slice)) return { status: "empty" };

  const version = slice["version"];
  if (version !== 1 && version !== 2 && version !== VERSION) {
    return {
      status: "discarded",
      reason: "The saved design was made by a different version of Plaque.",
    };
  }
  if (version === VERSION && !Array.isArray(slice["pieces"])) {
    return { status: "discarded", reason: "The saved design was incomplete." };
  }

  const pieces: Piece[] = [];
  const problems: string[] = [];
  for (const stored of storedPieces(slice)) {
    const read = readPiece(stored, pieces);
    if (typeof read === "string") problems.push(read);
    else pieces.push(read);
  }
  if (pieces.length === 0) {
    return { status: "discarded", reason: problems[0] ?? "The saved design was incomplete." };
  }

  return {
    status: "ok",
    data: {
      version: VERSION,
      savedAt: typeof slice["savedAt"] === "string" ? slice["savedAt"] : null,
      pieces,
      uploadedIcons: isRecord(slice["uploadedIcons"]) ? (slice["uploadedIcons"] as Record<string, string>) : {},
      assetNames: isRecord(slice["assetNames"]) ? (slice["assetNames"] as Record<string, string>) : {},
      snapEnabled: slice["snapEnabled"] !== false,
      // Absent in anything written before the sheet pane could be collapsed.
      sheetCollapsed: slice["sheetCollapsed"] === true,
    },
    problem: problems.length > 0 ? problems.join(" ") : null,
  };
}

/** One piece, or why it cannot be read. `before` is what has been read already. */
function readPiece(source: Record<string, unknown>, before: Piece[]): Piece | string {
  const id = source["id"];
  const name = typeof source["name"] === "string" && source["name"] ? source["name"] : "A piece";
  if (typeof id !== "string" || !id) return `"${name}" had no id, so it was left out.`;
  if (before.some((p) => p.id === id)) return `"${name}" was saved twice, so the second was left out.`;

  const bad = firstBadDesignField(source);
  if (bad) return `${bad} "${name}" was left out.`;
  if (!Array.isArray(source["rows"]) || !Array.isArray(source["headers"])) {
    return `The saved guest list for "${name}" could not be read, so it was left out.`;
  }

  const rows = source["rows"] as Piece["rows"];
  return {
    id,
    name,
    card: source["card"] as Piece["card"],
    sheet: source["sheet"] as Piece["sheet"],
    template: source["template"] as Piece["template"],
    headers: source["headers"] as string[],
    rows,
    // Absent in anything written before per-row editing. Positional ids match
    // what buildArtefacts falls back to, so overrides keyed by them still land.
    rowIds: Array.isArray(source["rowIds"]) ? (source["rowIds"] as string[]) : rows.map((_, i) => `r${i}`),
    merged: isRecord(source["merged"]) ? (source["merged"] as Piece["merged"]) : {},
    csvIssues: Array.isArray(source["csvIssues"]) ? (source["csvIssues"] as Piece["csvIssues"]) : [],
    fileName: typeof source["fileName"] === "string" ? source["fileName"] : null,
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
