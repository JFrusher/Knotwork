import type { SliceName } from "@jfrusher/trousseau";
import { fingerprint } from "./fingerprint";
import { partInfo, partsOf } from "./parts";

/**
 * Parts of a wedding in words, for the people choosing between two versions
 * of it: what a part is, what differs inside it, and what changed between one
 * saved version and the next.
 */

type Raw = Record<string, unknown>;

const isRecord = (value: unknown): value is Raw =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A kept-whole slice, or the rest of a cut one, in words. */
const WHOLE: Partial<Record<SliceName, string>> = {
  event: "The wedding’s names, date and venue",
  seating: "The room",
  timeline: "The day’s lanes and settings",
  crew: "Suppliers and their people",
  shots: "The group shots",
  stationery: "The card design",
  tools: "Which tools the wedding uses",
};

const COLLECTION: Record<string, { one: string; many: string }> = {
  guests: { one: "guest", many: "guests" },
  tables: { one: "table", many: "tables" },
  blocks: { one: "block of the day", many: "blocks of the day" },
  jobs: { one: "job or task", many: "jobs and tasks" },
};

/** What a part is: "Ada Byron", "Table 3", "Speeches", or a slice in words. */
export function partName(key: string, value: unknown): string {
  const info = partInfo(key);
  if (info.record) {
    const record = isRecord(value) ? value : {};
    const name =
      info.record.collection === "guests"
        ? [record["firstName"], record["lastName"]].filter((part) => typeof part === "string" && part).join(" ")
        : typeof record["label"] === "string"
          ? record["label"]
          : "";
    const noun = COLLECTION[info.record.collection]?.one ?? "record";
    return name ? `${name} (a ${noun})` : `A ${noun}`;
  }
  return WHOLE[info.slice] ?? info.slice;
}

/** Field names in words, where the stored name is not already words. */
const FIELD: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  rsvpStatus: "Reply",
  dietaryRaw: "Food",
  dietary: "Dietary requirement",
  assignedTableId: "Table",
  assignedSeatId: "Seat",
  plusOneOf: "Plus-one of",
  groupId: "Group",
  familyId: "Family",
  label: "Name",
  capacity: "Seats",
  durationMin: "Length (minutes)",
  anchorMin: "Fixed time",
  personIds: "People",
  teamId: "Team",
  coupleNames: "Names",
  venueName: "Venue",
};

const fieldName = (field: string) =>
  FIELD[field] ?? field.replace(/([A-Z])/g, " $1").replace(/^./, (first) => first.toUpperCase());

/** A value short enough to read, or a note that it is too big to show. */
function shown(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  return "changed";
}

export interface FieldChange {
  field: string;
  mine: string;
  theirs: string;
}

/** Where two versions of one part differ, field by field. */
export function fieldChanges(mine: unknown, theirs: unknown): FieldChange[] {
  if (!isRecord(mine) || !isRecord(theirs)) {
    return [{ field: "The whole of it", mine: mine === undefined ? "Removed" : shown(mine), theirs: theirs === undefined ? "Removed" : shown(theirs) }];
  }
  const fields = [...new Set([...Object.keys(mine), ...Object.keys(theirs)])];
  return fields
    .filter((field) => fingerprint(mine[field]) !== fingerprint(theirs[field]))
    .map((field) => ({ field: fieldName(field), mine: shown(mine[field]), theirs: shown(theirs[field]) }));
}

/** What changed from one saved version to the next, a line per kind of thing. */
export function describeChanges(before: Raw, after: Raw): string[] {
  const was = partsOf(before);
  const now = partsOf(after);
  const counts = new Map<string, { added: number; removed: number; changed: number }>();
  const wholes: string[] = [];
  let reordered = false;

  for (const key of new Set([...was.keys(), ...now.keys()])) {
    const info = partInfo(key);
    const same = was.has(key) === now.has(key) && fingerprint(was.get(key)) === fingerprint(now.get(key));
    if (same) continue;
    if (info.order) {
      if (key === "timeline/blocks#order") reordered = true;
      continue;
    }
    if (info.record) {
      const count = counts.get(info.record.collection) ?? { added: 0, removed: 0, changed: 0 };
      if (!was.has(key)) count.added += 1;
      else if (!now.has(key)) count.removed += 1;
      else count.changed += 1;
      counts.set(info.record.collection, count);
      continue;
    }
    // The guest list's own marker says only that there is one.
    if (info.slice !== "guests") wholes.push(WHOLE[info.slice] ?? info.slice);
  }

  const lines = [...counts.entries()].map(([collection, count]) => {
    const words = COLLECTION[collection] ?? { one: collection, many: collection };
    const parts = [
      count.added > 0 ? `${count.added} added` : "",
      count.removed > 0 ? `${count.removed} taken off` : "",
      count.changed > 0 ? `${count.changed} changed` : "",
    ].filter(Boolean);
    const total = count.added + count.removed + count.changed;
    return `${total === 1 ? words.one[0]!.toUpperCase() + words.one.slice(1) : words.many[0]!.toUpperCase() + words.many.slice(1)}: ${parts.join(", ")}`;
  });
  if (reordered && !counts.has("blocks")) lines.push("The day’s blocks put in a new order");
  return [...lines, ...wholes.map((whole) => `${whole}: changed`)];
}
