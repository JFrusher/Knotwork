import { describe, expect, it } from "vitest";
import { nodeFontSource } from "@/apps/brigade/render/pdf/nodeFontSource";
import { textOf } from "@/apps/brigade/render/pdf/readPdf";
import type { Cast, Guest, Seating, ShotSection } from "@/lib/model/types";
import { renderShotSheet } from "./shotSheet";

const guest = (id: string, extra: Partial<Guest> = {}): Guest => ({
  id,
  firstName: id,
  lastName: "",
  email: "",
  rsvpStatus: "confirmed",
  dietary: "",
  dietaryRaw: "",
  entree: "",
  notes: "",
  side: "",
  groupId: null,
  subgroupId: null,
  familyId: null,
  assignedTableId: null,
  tags: [],
  plusOneOf: null,
  ...extra,
});

const seating: Seating = {
  tables: {},
  groups: {},
  subgroups: {},
  families: {},
  zones: {},
  obstacles: {},
  constraints: [],
  snapshots: [],
  room: { widthUnits: 0, heightUnits: 0, width: 0, height: 0, backgroundColour: "", spaces: [] },
  settings: {
    defaultSeatMode: "table",
    pixelsPerUnit: 1,
    gridSnap: true,
    gridSize: 1,
    snapAlign: true,
    showChairs: true,
    chairSizeUnits: 1,
    showDietaryBadges: true,
    showGroupColours: true,
    unitSystem: "metric",
    customTablePresets: [],
  },
};

const emptyCast: Cast = {
  a: [],
  b: [],
  "a-mother": [],
  "a-father": [],
  "b-mother": [],
  "b-father": [],
  "a-party": [],
  "b-party": [],
};

const options = {
  fontSource: nodeFontSource,
  partners: ["Alex", "Sam"] as [string, string],
  generatedOn: "Generated for the test",
};

describe("renderShotSheet", () => {
  it("prints every section heading and every shot's label and people", async () => {
    const guests = { g1: guest("g1", { firstName: "Charis" }) };
    const sections: ShotSection[] = [
      {
        id: "sec1",
        name: "Alex's family",
        shots: [{ id: "sh1", label: "Alex with their mother", members: [{ kind: "guest", ref: "g1" }], notes: "Outdoors if dry" }],
      },
    ];
    const { text } = await textOf(await renderShotSheet(sections, guests, seating, emptyCast, options, []));
    expect(text).toContain("ALEX'S FAMILY");
    expect(text).toContain("Alex with their mother");
    expect(text).toContain("Charis");
    expect(text).toContain("Outdoors if dry");
  });

  it("numbers shots consecutively across sections", async () => {
    const sections: ShotSection[] = [
      { id: "s1", name: "A", shots: [{ id: "sh1", label: "One", members: [], notes: "" }] },
      { id: "s2", name: "B", shots: [{ id: "sh2", label: "Two", members: [], notes: "" }] },
    ];
    const { text: raw } = await textOf(await renderShotSheet(sections, {}, seating, emptyCast, options, []));
    const text = raw.replace(/\s+/g, " ");
    expect(text.indexOf("1. One")).toBeGreaterThanOrEqual(0);
    expect(text.indexOf("2. Two")).toBeGreaterThan(text.indexOf("1. One"));
  });

  it("skips a section with no shots rather than printing a bare heading", async () => {
    const sections: ShotSection[] = [{ id: "s1", name: "Nothing here", shots: [] }];
    const { text } = await textOf(await renderShotSheet(sections, {}, seating, emptyCast, options, []));
    expect(text).not.toContain("NOTHING HERE");
  });

  it("renders a document with no shots at all without falling over", async () => {
    const { pages, text } = await textOf(await renderShotSheet([], {}, seating, emptyCast, options, []));
    expect(pages).toBeGreaterThanOrEqual(1);
    // Drawn as a section heading, and headings print uppercased.
    expect(text).toContain("NO SHOTS PLANNED YET.");
  });

  /*
   * The columns, not just the page count.
   *
   * A5 once rendered "successfully" with the label column at about 10mm, which
   * broke every multi-word label into a vertical stack of fragments. Nothing
   * threw and the page count was right, so the tests of the day were happy. A
   * label wide enough to be squeezed, asserted whole, is what catches that.
   */
  const longLabel = "The couple with Alex's parents";
  const sections: ShotSection[] = [
    { id: "s1", name: "Both families", shots: [{ id: "sh1", label: longLabel, members: [], notes: "" }] },
  ];

  it.each(["A4", "A5"] as const)("keeps a long label unbroken at %s", async (pageSize) => {
    const { pages, text } = await textOf(
      await renderShotSheet(sections, {}, seating, emptyCast, { ...options, pageSize }, []),
    );
    expect(pages).toBeGreaterThanOrEqual(1);
    // `wrap` breaks a word too wide for its column mid-word, and each drawn
    // line is its own extracted run — so a squeezed column shows up here as
    // fragments where the phrase used to be.
    expect(text).toContain(longLabel);
  });
});
