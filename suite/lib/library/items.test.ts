// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { adds, applyTo, extract } from "./items";

const example = JSON.parse(readFileSync(join(process.cwd(), "public", "fixtures", "example-wedding.trousseau.json"), "utf8"));
const names = Object.values(example.guests as Record<string, { firstName: string; lastName: string }>).flatMap((guest) => [
  guest.firstName,
  guest.lastName,
]);
const mentionsAnyGuest = (value: unknown) => {
  const text = JSON.stringify(value);
  return names.filter((name) => name.length > 3 && text.includes(`"${name}"`));
};

describe("keeping a design from one wedding", () => {
  it("keeps the card design without a single guest's name in it", () => {
    const cards = extract("cards", example)!;
    expect(Object.keys(cards).sort()).toEqual(["assetNames", "card", "sheet", "snapEnabled", "template", "uploadedIcons", "version"]);
    expect(mentionsAnyGuest(cards)).toEqual([]);
  });

  it("keeps the running order without the date, the couple or the suppliers' numbers", () => {
    const day = extract("day", example)!;
    expect(Object.keys(day)).not.toContain("day");
    expect(JSON.stringify(day)).not.toContain("07700");
    expect((day["tagDetails"] as object[])[0]).toEqual({ tag: "photographer", arrivalMin: 465 });
    expect((day["blocks"] as object[]).length).toBe(27);
    expect(mentionsAnyGuest(day)).toEqual([]);
  });

  it("keeps the room with every chair empty", () => {
    const room = extract("room", example)!;
    const tables = Object.values(room["tables"] as Record<string, { assignedGuestIds: unknown[] }>);
    expect(tables).toHaveLength(14);
    expect(tables.every((table) => table.assignedGuestIds.every((seat) => seat === null))).toBe(true);
    expect(Object.keys(room)).not.toContain("families");
    expect(mentionsAnyGuest(room)).toEqual([]);
  });

  it("keeps the checklist as so many days before the day", () => {
    const { tasks } = extract("checklist", example) as { tasks: Array<{ label: string; daysBefore: number | null }> };
    expect(tasks.find((task) => task.label === "Book the venue")).toEqual({ label: "Book the venue", daysBefore: 365 });
  });

  it("says there is nothing to keep from a wedding with nothing in it", () => {
    for (const kind of ["cards", "day", "room", "checklist"] as const) expect(extract(kind, {}), kind).toBeNull();
  });
});

describe("putting it into another wedding", () => {
  const other = {
    event: { date: "2029-09-01", coupleNames: "Robin & Kit" },
    guests: { r1: { id: "r1", firstName: "Robin", assignedTableId: "old", assignedSeatId: null } },
    seating: { tables: { old: { id: "old", assignedGuestIds: ["r1"] } }, families: { f: { id: "f", memberIds: ["r1"] } } },
    crew: { jobs: [{ id: "j1", blockId: null, label: "Book the venue", dueOn: "2028-01-01" }] },
  };

  it("gives a wedding with no cards a design and an empty list to fill from the room", () => {
    const [[slice, stationery]] = applyTo("cards", extract("cards", example)!, other) as Array<[string, Record<string, unknown>]>;
    expect(slice).toBe("stationery");
    expect(stationery).toMatchObject({ rows: [], headers: [], version: 2 });
    expect(stationery["template"]).toBeTruthy();
  });

  it("puts the room in, keeps the families, and unseats everyone from the tables that went", () => {
    const changed = Object.fromEntries(applyTo("room", extract("room", example)!, other)) as Record<string, Record<string, Record<string, unknown>>>;
    expect(Object.keys(changed["seating"]!["tables"]!)).toHaveLength(14);
    expect(changed["seating"]!["families"]).toEqual(other.seating.families);
    expect(changed["guests"]!["r1"]).toMatchObject({ assignedTableId: null });
  });

  it("adds the tasks this wedding does not have, dated from its own day", () => {
    const [[, crew]] = applyTo("checklist", extract("checklist", example)!, other) as Array<[string, { jobs: Array<{ label: string; dueOn: string }> }]>;
    expect(crew.jobs.filter((job) => job.label === "Book the venue")).toHaveLength(1);
    expect(crew.jobs.find((job) => job.label === "Order the cake")?.dueOn).toBe("2029-05-04");
  });
});

describe("a processional", () => {
  const withGuestWalking = {
    ...example,
    ceremony: {
      processional: [
        ...(example.ceremony.processional as object[]),
        {
          id: "walk-extra",
          label: "",
          members: [
            { kind: "guest", ref: Object.keys(example.guests)[0] },
            { kind: "customRole", ref: "crole-readers" },
            { kind: "family", ref: "fam-1" },
            { kind: "role", ref: "b-grandparents" },
          ],
          formation: "pairs",
          side: "b",
          music: "",
          cue: "",
        },
      ],
    },
  };

  it("is kept by roles, words and music, with nobody named and nothing of this wedding's own", () => {
    const kept = extract("processional", withGuestWalking)!;
    const groups = kept["processional"] as Array<{ members: Array<{ kind: string }> }>;
    expect(groups).toHaveLength(7);
    expect(groups[5]).toMatchObject({ formation: "pairs", side: "", music: "The Arrival of the Queen of Sheba" });
    expect(groups[6]!.members).toEqual([{ kind: "role", ref: "b-grandparents" }]);
    expect(groups.flatMap((group) => group.members).every((member) => member.kind === "role" || member.kind === "text")).toBe(true);
    expect(JSON.stringify(kept)).not.toContain('"id"');
    expect(mentionsAnyGuest(kept)).toEqual([]);
  });

  it("is nothing to keep from a wedding with no processional", () => {
    expect(extract("processional", { ...example, ceremony: { processional: [] } })).toBeNull();
  });

  it("goes into another wedding as its processional, each group with an id of its own", () => {
    const kept = extract("processional", example)!;
    const [[slice, value]] = applyTo("processional", kept, { ceremony: { processional: [{ id: "old" }] } }) as [[string, { processional: Array<{ id: string }> }]];
    expect(slice).toBe("ceremony");
    expect(value.processional).toHaveLength(6);
    expect(new Set(value.processional.map((group) => group.id)).size).toBe(6);
    expect(value.processional.map((group) => group.id)).not.toContain("old");
  });
});

describe("a set of boxes", () => {
  it("is kept as its boxes and what goes in each: not who takes them, when, what is packed or its notes", () => {
    const kept = extract("boxes", example)!;
    const boxes = kept["boxes"] as Array<Record<string, unknown>>;
    expect(boxes).toHaveLength(4);
    expect(boxes[1]).toEqual({
      number: 2,
      name: "Getting ready",
      items: [
        { label: "Outfits, on hangers", quantity: 2 },
        { label: "Shoes", quantity: 2 },
        { label: "Steamer", quantity: 1 },
        { label: "Emergency kit: plasters, safety pins, needle and thread, painkillers", quantity: 1 },
        { label: "Phone chargers", quantity: 2 },
      ],
    });
    const text = JSON.stringify(kept);
    for (const gone of ['"personIds"', '"blockId"', '"packed"', '"notes"', '"id"', "best man"]) expect(text).not.toContain(gone);
    expect(mentionsAnyGuest(kept)).toEqual([]);
  });

  it("adds to a wedding the boxes it has none of by name, numbered on, with nothing packed, and asks nothing first", () => {
    const kept = extract("boxes", example)!;
    const into = { boxes: { boxes: [{ id: "mine", number: 7, name: "getting ready", items: [] }] } };
    const [[slice, value]] = applyTo("boxes", kept, into) as [[string, { boxes: Array<Record<string, unknown>> }]];
    expect(slice).toBe("boxes");
    expect(value.boxes.map((box) => `${box["number"]} ${box["name"]}`)).toEqual([
      "7 getting ready",
      "8 The rings and the paperwork",
      "9 The day's odds and ends",
      "10 Overnight and the day after",
    ]);
    const items = value.boxes.slice(1).flatMap((box) => box["items"] as Array<{ id: string; packed: boolean }>);
    expect(items.every((item) => item.packed === false && typeof item.id === "string")).toBe(true);
    expect(adds("boxes")).toBe(true);
    expect(adds("room")).toBe(false);
  });
});
