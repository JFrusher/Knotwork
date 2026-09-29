import { SLICE_NAMES, type SliceName } from "@jfrusher/trousseau";

/**
 * A wedding cut into the pieces two people can change apart.
 *
 * Merging whole slices made two partners conflict whenever both touched the
 * guest list, however many guests apart they were. So the collections people
 * edit one record at a time — guests, tables, the day's blocks, the jobs —
 * are cut into one part per record, keyed by id; the rest of each such slice
 * is one part, and a list's order is its own. Every other slice is one part,
 * as before, under its own name.
 *
 *   guests/<id>              one guest
 *   guests#order             the guests' order
 *   seating                  the room, less its tables
 *   seating/tables/<id>      one table
 *   seating/tables#order     the tables' order
 *   timeline                 the timeline, less its blocks
 *   timeline/blocks/<id>     one block
 *   timeline/blocks#order    the blocks' order
 *   crew, crew/jobs/<id>, crew/jobs#order
 *   event, shots, stationery, tools, cast, ceremony
 *
 * `day` is not a part: it is published from the timeline and the event, and
 * is worked out again rather than merged — see `mergeCloudDocument`.
 */

type Raw = Record<string, unknown>;

const isRecord = (value: unknown): value is Raw =>
  typeof value === "object" && value !== null && !Array.isArray(value);

interface Keyed {
  /** The field holding the records, or null when the slice is the records. */
  field: string | null;
  shape: "map" | "list";
}

export const KEYED: Partial<Record<SliceName, Keyed>> = {
  guests: { field: null, shape: "map" },
  seating: { field: "tables", shape: "map" },
  timeline: { field: "blocks", shape: "list" },
  crew: { field: "jobs", shape: "list" },
};

/** Published from the timeline and the event; worked out again, never merged. */
export const DERIVED = "day" satisfies SliceName;

const MERGED_SLICES = SLICE_NAMES.filter((slice) => slice !== DERIVED);

const prefixOf = (slice: SliceName, keyed: Keyed) => (keyed.field === null ? slice : `${slice}/${keyed.field}`);

/** What a part is: its slice, and the record or order it holds, if any. */
export interface PartInfo {
  slice: SliceName;
  record: { collection: string; id: string } | null;
  order: boolean;
}

export function partInfo(key: string): PartInfo {
  const slice = key.split(/[/#]/)[0] as SliceName;
  const keyed = KEYED[slice];
  if (!keyed || key === slice) return { slice, record: null, order: false };
  const prefix = prefixOf(slice, keyed);
  if (key === `${prefix}#order`) return { slice, record: null, order: true };
  return { slice, record: { collection: keyed.field ?? slice, id: key.slice(prefix.length + 1) }, order: false };
}

/** A document as parts, in the document's own order. A missing slice has no parts. */
export function partsOf(raw: Raw): Map<string, unknown> {
  const parts = new Map<string, unknown>();
  for (const slice of MERGED_SLICES) {
    const value = raw[slice];
    if (value === undefined) continue;
    const keyed = KEYED[slice];
    if (!keyed || !isRecord(value)) {
      parts.set(slice, value);
      continue;
    }
    const collection = keyed.field === null ? value : value[keyed.field];
    const prefix = prefixOf(slice, keyed);
    // A missing collection, or one whose records cannot be told apart, keeps
    // the slice whole: nothing invented, nothing lost.
    const keyable =
      keyed.shape === "map"
        ? isRecord(collection)
        : Array.isArray(collection) && collection.every((item) => isRecord(item) && typeof item["id"] === "string");
    if (!keyable) {
      parts.set(slice, value);
      continue;
    }
    if (keyed.field === null) {
      // The slice is the records; this marks that it is there at all.
      parts.set(slice, {});
    } else {
      const { [keyed.field]: _records, ...rest } = value;
      parts.set(slice, rest);
    }
    const records: Array<[string, unknown]> =
      keyed.shape === "map"
        ? Object.entries(collection as Raw)
        : (collection as Raw[]).map((item) => [item["id"] as string, item]);
    for (const [id, record] of records) parts.set(`${prefix}/${id}`, record);
    // Also what marks the slice as cut into records, rather than kept whole.
    parts.set(`${prefix}#order`, records.map(([id]) => id));
  }
  return parts;
}

/**
 * Put parts back together as slices, onto `into` (whose other keys are kept).
 * A list's records follow its order part; any record the order does not name
 * — added on one side while the order came from the other — goes at the end.
 */
export function assemble(parts: ReadonlyMap<string, unknown>, into: Raw): Raw {
  const raw: Raw = { ...into };
  for (const slice of MERGED_SLICES) {
    if (!parts.has(slice)) {
      delete raw[slice];
      continue;
    }
    const keyed = KEYED[slice];
    const head = parts.get(slice);
    if (!keyed || !isKeyedHead(slice, keyed, parts)) {
      raw[slice] = head;
      continue;
    }
    const prefix = prefixOf(slice, keyed);
    const byId = new Map(
      [...parts.entries()]
        .filter(([key]) => key.startsWith(`${prefix}/`))
        .map(([key, value]) => [key.slice(prefix.length + 1), value]),
    );
    const order = parts.get(`${prefix}#order`) as string[];
    const ids = [...order.filter((id) => byId.has(id)), ...[...byId.keys()].filter((id) => !order.includes(id))];
    const collection =
      keyed.shape === "map" ? Object.fromEntries(ids.map((id) => [id, byId.get(id)])) : ids.map((id) => byId.get(id));
    raw[slice] = keyed.field === null ? collection : { ...(head as Raw), [keyed.field]: collection };
  }
  return raw;
}

/**
 * Whether a keyed slice's head part is the rest of it, with the records cut
 * out, rather than the whole slice kept as one — which `partsOf` does for a
 * collection whose records it cannot tell apart.
 */
function isKeyedHead(slice: SliceName, keyed: Keyed, parts: ReadonlyMap<string, unknown>): boolean {
  return parts.has(`${prefixOf(slice, keyed)}#order`);
}

/** One part changed in a document: set it, or with `undefined` take it out. */
export function withPart(raw: Raw, key: string, value: unknown): Raw {
  const parts = partsOf(raw);
  if (value === undefined) parts.delete(key);
  else parts.set(key, value);
  return assemble(parts, raw);
}
