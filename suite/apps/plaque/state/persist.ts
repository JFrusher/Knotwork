import type { GuestRow } from "../core/data/rows";
import type { Template } from "../core/types";
import type { Piece, Suite } from "./design";
import type { Merged } from "./fromRoom";
import type { Printed } from "./printed";
import { SUITE_VERSION, isRecord, storedPieces } from "./suite";

/**
 * The guest a row printed before the room was live, or null. Saves before
 * version 3 stored the rows themselves and keyed per-guest tweaks by position
 * in them; matching a stored row to a guest is what carries those tweaks over.
 */
export type GuestIdFor = (row: GuestRow) => string | null;

export const VERSION = SUITE_VERSION;

/**
 * The stationery slice as stored: the suite of pieces, versioned and stamped.
 * It travels wherever the wedding does: this device, and the account when the
 * wedding is synced to one.
 *
 * Uploaded font and image binaries are NOT here. Those are separate keys in
 * IndexedDB — see blobStore.
 */
interface Persisted extends Suite {
  version: number;
  /** ISO time of the write. */
  savedAt: string | null;
}

type LoadResult =
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
export function load(slice: unknown, guestIdFor: GuestIdFor = () => null): LoadResult {
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
    const read = readPiece(stored, pieces, version === VERSION ? null : guestIdFor, problems);
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

/**
 * One piece, or why it cannot be read. `before` is what has been read already.
 * `legacy` is set for a piece saved before version 3, whose rows go and whose
 * tweaks are re-keyed from positions to guests.
 */
function readPiece(
  source: Record<string, unknown>,
  before: Piece[],
  legacy: GuestIdFor | null,
  notes: string[],
): Piece | string {
  const id = source["id"];
  const name = typeof source["name"] === "string" && source["name"] ? source["name"] : "A piece";
  if (typeof id !== "string" || !id) return `"${name}" had no id, so it was left out.`;
  if (before.some((p) => p.id === id)) return `"${name}" was saved twice, so the second was left out.`;

  const bad = firstBadDesignField(source);
  if (bad) return `${bad} "${name}" was left out.`;

  const design = {
    id,
    name,
    card: source["card"] as Piece["card"],
    // Absent in anything written before boards could be tiled at home.
    sheet: { tilePaper: "A4", ...(source["sheet"] as object) } as Piece["sheet"],
    template: source["template"] as Template,
  };
  if (!legacy) {
    const merged = source["merged"] ?? {};
    const valid =
      isRecord(merged) &&
      Object.values(merged).every((ids) => Array.isArray(ids) && ids.every((id) => typeof id === "string"));
    if (!valid) return `The combined cards on "${name}" could not be read, so it was left out.`;
    const printed = source["printed"] ?? null;
    if (printed !== null && !isPrinted(printed)) {
      // Bookkeeping, not design: losing it costs a list of what to reprint,
      // which is not worth the piece.
      notes.push(`What "${name}" was last printed as could not be read, so changes since cannot be shown.`);
    }
    return { ...design, merged: merged as Merged, printed: isPrinted(printed) ? printed : null };
  }
  if (!Array.isArray(source["rows"])) {
    return `The saved guest list for "${name}" could not be read, so it was left out.`;
  }
  const { lost, ...moved } = fromRows(source, design.template, legacy);
  if (lost > 0) {
    notes.push(
      lost === 1
        ? `One guest's own change to "${name}" no longer matches anybody on the list, so it was dropped.`
        : `${lost} guests' own changes to "${name}" no longer match anybody on the list, so they were dropped.`,
    );
  }
  return { ...design, ...moved, printed: null };
}

function isPrinted(value: unknown): value is Printed {
  return (
    isRecord(value) &&
    typeof value["at"] === "string" &&
    isRecord(value["cards"]) &&
    Object.values(value["cards"]).every((print) => typeof print === "string")
  );
}

/**
 * A pre-3 piece's tweaks and combined cards, moved off the rows it stored and
 * onto the guests those rows were. A tweak whose row matches no guest goes,
 * and is counted in `lost` so the loss is said rather than silent.
 */
function fromRows(
  source: Record<string, unknown>,
  template: Template,
  guestIdFor: GuestIdFor,
): Pick<Piece, "template" | "merged"> & { lost: number } {
  const rows = source["rows"] as GuestRow[];
  const rowIds = Array.isArray(source["rowIds"]) ? (source["rowIds"] as string[]) : rows.map((_, i) => `r${i}`);
  const oldMerged = isRecord(source["merged"]) ? (source["merged"] as Record<string, { rows?: GuestRow[] }>) : {};

  const newKey = new Map<string, string>();
  const merged: Merged = {};
  rows.forEach((row, index) => {
    const rowId = rowIds[index] ?? `r${index}`;
    const members = oldMerged[rowId]?.rows;
    if (Array.isArray(members)) {
      const ids = members.map(guestIdFor).filter((gid): gid is string => gid !== null);
      if (ids.length > 0) {
        merged[rowId] = ids;
        newKey.set(rowId, rowId);
      }
      return;
    }
    const guestId = guestIdFor(row);
    if (guestId) newKey.set(rowId, guestId);
  });

  const before = Object.entries(template.overrides ?? {});
  const overrides = Object.fromEntries(
    before.flatMap(([rowId, patch]) => {
      const key = newKey.get(rowId);
      return key ? [[key, patch]] : [];
    }),
  );
  return { template: { ...template, overrides }, merged, lost: before.length - Object.keys(overrides).length };
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
