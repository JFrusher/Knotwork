import type { SliceName } from "@jfrusher/trousseau";
import { daysUntil } from "@/lib/dates";

/**
 * What a planner keeps from one wedding to use in another, and how it goes
 * into the next: a card design without its rows, a running order without its
 * date or its suppliers' numbers, a room without its guests, a checklist
 * without its dates — each task kept as so many days before the day — a
 * processional with its roles and music and nobody named, and a set of boxes
 * with what goes in each, but not who takes them or when.
 *
 * Nothing personal leaves a wedding this way. Each kind is built from a
 * whitelist of what it is, never by removing what it is not, so a field a tool
 * adds later stays out until someone decides it belongs.
 */

export const KINDS = ["cards", "day", "room", "checklist", "processional", "boxes"] as const;

/** Kinds that add to a wedding rather than replace what it has, so ask nothing first. */
const ADDING = ["checklist", "boxes"] as const satisfies readonly Kind[];
export type Adding = (typeof ADDING)[number];
export const adds = (kind: Kind): kind is Adding => (ADDING as readonly Kind[]).includes(kind);
export type Kind = (typeof KINDS)[number];

export const KIND_NAMES: Record<Kind, string> = {
  cards: "Card design",
  day: "Running order",
  room: "Room",
  checklist: "Checklist",
  processional: "Processional",
  boxes: "Boxes",
};

type Raw = Record<string, unknown>;

const isRecord = (value: unknown): value is Raw => typeof value === "object" && value !== null && !Array.isArray(value);
const record = (value: unknown): Raw => (isRecord(value) ? value : {});
const pick = (source: Raw, keys: readonly string[]): Raw =>
  Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));

/** A task as the library keeps it: what to do, and how long before the day, if it said. */
interface KeptTask {
  label: string;
  daysBefore: number | null;
}

/**
 * What of this wedding there is to keep as `kind`, or null when there is
 * nothing — no design yet, no blocks, no tables, no tasks.
 */
export function extract(kind: Kind, raw: Raw): Raw | null {
  switch (kind) {
    case "cards": {
      const stationery = record(raw["stationery"]);
      if (!isRecord(stationery["template"])) return null;
      // The design, and the per-row tweaks and the choice of rows left behind:
      // both are about this wedding's guests.
      const { overrides: _overrides, rowScope: _rowScope, ...template } = stationery["template"];
      return { ...pick(stationery, ["version", "card", "sheet", "uploadedIcons", "assetNames", "snapEnabled"]), template };
    }
    case "day": {
      const timeline = record(raw["timeline"]);
      const blocks = Array.isArray(timeline["blocks"]) ? timeline["blocks"] : [];
      if (blocks.length === 0) return null;
      return {
        ...pick(timeline, ["lanes", "blocks", "outputs", "styles", "fonts"]),
        // Which supplier does what, without who they are or how to ring them.
        tagDetails: (Array.isArray(timeline["tagDetails"]) ? timeline["tagDetails"] : []).map((detail) =>
          pick(record(detail), ["tag", "arrivalMin"]),
        ),
      };
    }
    case "room": {
      const seating = record(raw["seating"]);
      const tables = record(seating["tables"]);
      if (Object.keys(tables).length === 0) return null;
      return {
        ...pick(seating, ["zones", "room", "wallElements", "pillars", "canvas", "settings"]),
        // Every chair empty: a seat-level table keeps its places, as nulls.
        tables: Object.fromEntries(
          Object.entries(tables).map(([id, table]) => {
            const seats = Array.isArray(record(table)["assignedGuestIds"]) ? (record(table)["assignedGuestIds"] as unknown[]) : [];
            return [id, { ...record(table), assignedGuestIds: record(table)["seatMode"] === "seat" ? seats.map(() => null) : [] }];
          }),
        ),
      };
    }
    case "checklist": {
      const jobs = Array.isArray(record(raw["crew"])["jobs"]) ? (record(raw["crew"])["jobs"] as unknown[]) : [];
      const date = typeof record(raw["event"])["date"] === "string" ? (record(raw["event"])["date"] as string) : "";
      const tasks: KeptTask[] = jobs
        .map(record)
        .filter((job) => (job["blockId"] ?? null) === null && typeof job["label"] === "string" && job["label"] !== "")
        .map((job) => {
          const dueOn = typeof job["dueOn"] === "string" ? job["dueOn"] : "";
          return { label: job["label"] as string, daysBefore: dueOn && date ? daysUntil(date, dueOn) : null };
        });
      return tasks.length > 0 ? { tasks } : null;
    }
    case "processional": {
      const groups = Array.isArray(record(raw["ceremony"])["processional"]) ? (record(raw["ceremony"])["processional"] as unknown[]) : [];
      if (groups.length === 0) return null;
      return {
        processional: groups.map(record).map((group) => ({
          ...pick(group, ["label", "formation", "side", "music", "cue"]),
          // Who walks by what they are to the couple, or by the words typed
          // for them: never a guest, a family, a group or a role of this
          // wedding's own devising, none of which exist in another wedding.
          members: (Array.isArray(group["members"]) ? (group["members"] as unknown[]) : [])
            .map(record)
            .filter((member) => member["kind"] === "role" || member["kind"] === "text")
            .map((member) => pick(member, ["kind", "ref"])),
        })),
      };
    }
    case "boxes": {
      const boxes = Array.isArray(record(raw["boxes"])["boxes"]) ? (record(raw["boxes"])["boxes"] as unknown[]) : [];
      if (boxes.length === 0) return null;
      return {
        // What each box is and what goes in it. Not who takes it, which part
        // of the day it is for, what is packed or its notes: those are this
        // wedding's.
        boxes: boxes.map(record).map((box) => ({
          ...pick(box, ["number", "name"]),
          items: (Array.isArray(box["items"]) ? (box["items"] as unknown[]) : []).map(record).map((item) => pick(item, ["label", "quantity"])),
        })),
      };
    }
  }
}

/** An ISO date so many days before another. */
function daysBefore(iso: string, days: number): string {
  const when = new Date(`${iso}T12:00:00Z`);
  when.setUTCDate(when.getUTCDate() - days);
  return when.toISOString().slice(0, 10);
}

let counter = 0;
const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}`;

/**
 * The slices that change when `content` goes into a wedding. The day is not
 * among them — the caller publishes it again from the new timeline, as every
 * timeline change does.
 */
export function applyTo(kind: Kind, content: Raw, raw: Raw): Array<[SliceName, unknown]> {
  switch (kind) {
    case "cards": {
      const current = record(raw["stationery"]);
      // A wedding with no cards yet gets an empty list, which Place cards
      // fills from the room when it is asked to.
      const list = "version" in current ? {} : { headers: [], rows: [], rowIds: [], merged: {}, csvIssues: [], fileName: null };
      return [["stationery", { ...current, ...list, ...content, savedAt: null }]];
    }
    case "day":
      return [["timeline", { ...record(raw["timeline"]), ...content }]];
    case "room": {
      // The old tables go, so nobody is at one: every guest is unseated.
      const guests = Object.fromEntries(
        Object.entries(record(raw["guests"])).map(([id, guest]) => [id, { ...record(guest), assignedTableId: null, assignedSeatId: null }]),
      );
      return [
        ["seating", { ...record(raw["seating"]), ...content }],
        ["guests", guests],
      ];
    }
    case "checklist": {
      const crew = record(raw["crew"]);
      const jobs = Array.isArray(crew["jobs"]) ? (crew["jobs"] as Raw[]) : [];
      const date = typeof record(raw["event"])["date"] === "string" ? (record(raw["event"])["date"] as string) : "";
      const have = new Set(jobs.filter((job) => (job["blockId"] ?? null) === null).map((job) => String(job["label"]).toLowerCase()));
      const added = (content["tasks"] as KeptTask[])
        .filter((task) => !have.has(task.label.toLowerCase()))
        .map((task) => ({
          id: newId("j"),
          blockId: null,
          label: task.label,
          notes: "",
          teamId: null,
          personIds: [],
          status: "todo",
          dueOn: date && task.daysBefore !== null ? daysBefore(date, task.daysBefore) : "",
        }));
      return [["crew", { ...crew, jobs: [...jobs, ...added] }]];
    }
    case "boxes": {
      // Added, as the usual boxes are: only boxes this wedding has no box of
      // that name for, numbered on from its highest, nothing yet packed.
      const current = record(raw["boxes"]);
      const boxes = Array.isArray(current["boxes"]) ? (current["boxes"] as Raw[]) : [];
      const have = new Set(boxes.map((box) => String(box["name"] ?? "").trim().toLowerCase()));
      let number = boxes.reduce((highest, box) => Math.max(highest, typeof box["number"] === "number" ? box["number"] : 0), 0);
      const added = (content["boxes"] as Raw[])
        .filter((box) => !have.has(String(box["name"] ?? "").trim().toLowerCase()))
        .map((box) => ({
          id: newId("box"),
          number: ++number,
          name: box["name"],
          items: (box["items"] as Raw[]).map((item) => ({ id: newId("item"), label: item["label"], quantity: item["quantity"], packed: false })),
          blockId: null,
          personIds: [],
          notes: "",
        }));
      return [["boxes", { ...current, boxes: [...boxes, ...added] }]];
    }
    case "processional":
      return [
        [
          "ceremony",
          {
            ...record(raw["ceremony"]),
            processional: (content["processional"] as Raw[]).map((group) => ({ ...group, id: newId("walk") })),
          },
        ],
      ];
  }
}
