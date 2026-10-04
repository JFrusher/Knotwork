// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { migrate } from "@jfrusher/knotwork";
import { readCeremony } from "@/lib/model/slices";
import { adds, applyTo, extract } from "./items";

const example = JSON.parse(readFileSync(join(process.cwd(), "public", "fixtures", "example-wedding.knotwork.json"), "utf8"));
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
    expect(Object.keys(cards).sort()).toEqual(["assetNames", "pieces", "snapEnabled", "uploadedIcons", "version"]);
    const [piece] = cards["pieces"] as Array<Record<string, unknown>>;
    expect(Object.keys(piece!).sort()).toEqual(["card", "id", "name", "sheet", "template"]);
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

  it("gives a wedding with no cards the design, to print from its own room", () => {
    const [[slice, stationery]] = applyTo("cards", extract("cards", example)!, other) as Array<[string, Record<string, unknown>]>;
    expect(slice).toBe("stationery");
    expect(stationery).toMatchObject({ version: 3 });
    const pieces = stationery["pieces"] as Array<Record<string, unknown>>;
    expect(pieces[0]).toMatchObject({ id: "place-cards", merged: {} });
    expect(pieces[0]).not.toHaveProperty("rows");
    expect(pieces[0]!["template"]).toBeTruthy();
  });

  it("keeps who shares a card on a piece the wedding already has, and nobody combined on a new one", () => {
    const kept = extract("cards", example)!;
    const board = { id: "board", name: "Seating board", card: { widthMm: 594 }, sheet: {}, template: { elements: [] } };
    const content = { ...kept, pieces: [...(kept["pieces"] as unknown[]), board] };
    const held = {
      ...other,
      stationery: { version: 3, pieces: [{ id: "place-cards", name: "Place cards", merged: { "merged:x": ["r1", "r2"] } }] },
    };
    const [[, stationery]] = applyTo("cards", content, held) as Array<[string, { pieces: Array<Record<string, unknown>> }]>;
    expect(stationery.pieces.map((p) => p["id"])).toEqual(["place-cards", "board"]);
    expect(stationery.pieces[0]).toMatchObject({ merged: { "merged:x": ["r1", "r2"] } });
    expect(stationery.pieces[1]).toMatchObject({ merged: {}, card: { widthMm: 594 } });
  });

  it("still puts in a design kept before there were pieces", () => {
    const old = { version: 2, card: { widthMm: 85 }, sheet: {}, template: { elements: [] } };
    const [[, stationery]] = applyTo("cards", old, other) as Array<[string, { pieces: Array<Record<string, unknown>> }]>;
    expect(stationery.pieces).toEqual([
      expect.objectContaining({ id: "place-cards", name: "Place cards", card: { widthMm: 85 }, merged: {} }),
    ]);
    expect(Object.keys(stationery.pieces[0]!)).not.toContain("version");
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

describe("a ceremony", () => {
  const withGuestsNamed = {
    ...example,
    ceremony: {
      ...example.ceremony,
      processional: [
        ...(example.ceremony.processional as object[]),
        {
          id: "walk-extra",
          members: [
            { kind: "guest", ref: Object.keys(example.guests)[0] },
            { kind: "customRole", ref: "crole-readers" },
            { kind: "family", ref: "fam-1" },
            { kind: "role", ref: "b-grandparents" },
          ],
          formation: "pairs",
          side: "b",
        },
      ],
    },
  };

  it("is kept by roles, words and music, with nobody named and nothing of this wedding's own", () => {
    const kept = extract("processional", withGuestsNamed)!;
    const groups = kept["processional"] as Array<{ members: Array<{ kind: string }>; song: { title: string } | null }>;
    const order = kept["order"] as Array<{ kind: string; members: Array<{ kind: string }>; words: string }>;
    expect(kept["kind"]).toBe("civil");
    expect(groups).toHaveLength(7);
    expect(groups[5]!.song?.title).toBe("The Arrival of the Queen of Sheba");
    expect(groups[6]!.members).toEqual([{ kind: "role", ref: "b-grandparents" }]);
    expect(order.find((moment) => moment.kind === "reading")!.words).toContain("Let me not to the marriage of true minds");
    // The reader was a guest, the vows are the couple's own.
    expect(order.find((moment) => moment.kind === "reading")!.members).toEqual([]);
    expect(order.find((moment) => moment.kind === "vows")!.words).toBe("");
    const everyone = [...groups, ...order].flatMap((entry) => entry.members);
    expect(everyone.every((member) => member.kind === "role" || member.kind === "text")).toBe(true);
    const text = JSON.stringify(kept);
    expect(text).not.toContain('"id"');
    expect(text).not.toContain("Ada Hartley");
    expect(text).not.toContain("left pocket");
    expect(text).not.toContain("blk-ceremony");
    expect(text).not.toContain('"approved"');
    expect(mentionsAnyGuest(kept)).toEqual([]);
  });

  it("is nothing to keep from a wedding with no ceremony planned", () => {
    expect(extract("processional", { ...example, ceremony: { processional: [], order: [] } })).toBeNull();
  });

  it("replaces another wedding's order and processional, each part with an id of its own, keeping its officiant and nothing approved", () => {
    const kept = extract("processional", example)!;
    const into = { ceremony: { officiant: "Revd Jones", blockId: "blk-mine", order: [{ id: "old-moment" }], processional: [{ id: "old" }] } };
    const [[slice, value]] = applyTo("processional", kept, into) as [[string, { officiant: string; blockId: string; order: Array<{ id: string; approved: boolean }>; processional: Array<{ id: string }> }]];
    expect(slice).toBe("ceremony");
    expect(value.officiant).toBe("Revd Jones");
    expect(value.blockId).toBe("blk-mine");
    expect(value.processional).toHaveLength(6);
    expect(new Set([...value.order, ...value.processional].map((entry) => entry.id)).size).toBe(value.order.length + 6);
    expect(value.order.map((moment) => moment.id)).not.toContain("old-moment");
    expect(value.order.every((moment) => moment.approved === false)).toBe(true);
  });

  it("puts one kept before ceremonies had an order in as its processional, read into an order", () => {
    const older = { processional: [{ label: "", formation: "single", side: "", music: "Canon in D", cue: "", members: [] }] };
    const [[, value]] = applyTo("processional", older, { ceremony: { order: [{ id: "stale" }] } }) as [[string, Record<string, unknown>]];
    expect("order" in value).toBe(false);
    const read = readCeremony(migrate({ ceremony: value }));
    expect(read.order.map((moment) => moment.kind)).toEqual(["processional"]);
    expect(read.processional[0]!.song?.title).toBe("Canon in D");
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

describe("bar settings", () => {
  const settled = {
    ...example,
    bar: {
      ...example.bar,
      kind: "beer-and-wine",
      people: 120,
      figures: { eveningGuests: 30, eveningHours: 5 },
      lines: { fizz: { price: 8.5, have: 12, shop: "supermarket" }, spirits: { have: 2 } },
      unknown: "from a newer build",
    },
  };

  it("are kept without the guest count, the evening guests or what the couple already has", () => {
    expect(extract("bar", settled)).toEqual({
      kind: "beer-and-wine",
      crowd: "usual",
      figures: { eveningHours: 5 },
      mix: {},
      lines: { fizz: { price: 8.5, shop: "supermarket" } },
      wholeCases: true,
    });
  });

  it("are nothing to keep from a wedding that changed nothing", () => {
    expect(extract("bar", { ...example, bar: {} })).toBeNull();
    // Only a guest count and evening guests: nothing another wedding could use.
    expect(extract("bar", { ...example, bar: { people: 80, figures: { eveningGuests: 20 } } })).toBeNull();
  });

  it("replace this wedding's, keeping its head count, its evening guests and what it already has", () => {
    const kept = extract("bar", settled)!;
    const into = { bar: { kind: "cocktails", people: 60, figures: { eveningGuests: 10, toastGlasses: 2 }, lines: { ice: { have: 20 }, red: { price: 9 } } } };
    const [[slice, value]] = applyTo("bar", kept, into) as [[string, Record<string, unknown>]];
    expect(slice).toBe("bar");
    expect(value).toEqual({
      kind: "beer-and-wine",
      crowd: "usual",
      people: 60,
      figures: { eveningHours: 5, eveningGuests: 10 },
      mix: {},
      lines: { fizz: { price: 8.5, shop: "supermarket" }, ice: { have: 20 } },
      wholeCases: true,
    });
    expect(adds("bar")).toBe(false);
  });
});
