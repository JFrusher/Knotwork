import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUNDLED_FONTS } from "../../assets/fonts";
import { loadFont, widestLineMm, type LoadedFont } from "../text/measure";
import type { CardSpec, ResolvedElement, RoomElement, RoomScene } from "../types";
import { resolveCard } from "./bindings";
import { makeResolveOptions } from "./resolve";

/**
 * The floor plan: the room scaled into its box as shapes, lines and text, so
 * neither renderer knows it is drawing a plan.
 */
const fonts = new Map<string, LoadedFont>(
  BUNDLED_FONTS.map((f) => [f.id, loadFont(f.id, f.family, new Uint8Array(readFileSync(`public/fonts/${f.file}`)))]),
);

const sitter = (first: string, last: string, seat: string) => ({ "First Name": first, "Last Name": last, Name: `${first} ${last}`, Seat: seat });

// A room 400 × 200: a round table and a turned long one, both numbering their
// seats, and a round table where guests sit where they like.
const scene: RoomScene = {
  bounds: { x: 0, y: 0, w: 400, h: 200 },
  walls: [
    [{ x: 0, y: 0 }, { x: 400, y: 0 }],
    [{ x: 400, y: 0 }, { x: 400, y: 200 }],
  ],
  seatRadius: 10,
  tables: [
    {
      label: "Table 1",
      x: 100,
      y: 100,
      rotationDeg: 0,
      pathD: "M -40 0 A 40 40 0 1 0 40 0 A 40 40 0 1 0 -40 0 Z",
      view: { x: -40, y: -40, w: 80, h: 80 },
      numbered: true,
      interior: { x: -28, y: -28, w: 56, h: 56 },
      seats: [
        { x: 100, y: 45, out: { x: 0, y: -1 }, number: 1, row: sitter("Ada", "Byron", "1") },
        { x: 100, y: 155, out: { x: 0, y: 1 }, number: 2, row: null },
      ],
    },
    {
      label: "Top table",
      x: 300,
      y: 100,
      rotationDeg: 30,
      pathD: "M -60 -20 H 60 V 20 H -60 Z",
      view: { x: -60, y: -20, w: 120, h: 40 },
      numbered: true,
      interior: { x: -52, y: -12, w: 104, h: 24 },
      seats: [{ x: 300, y: 65, out: { x: 0, y: -1 }, number: 1, row: sitter("Grace", "Hopper", "1") }],
    },
  ],
};

const freeSeating = {
  label: "Table 2",
  x: 200,
  y: 160,
  rotationDeg: 0,
  pathD: "M -30 0 A 30 30 0 1 0 30 0 A 30 30 0 1 0 -30 0 Z",
  view: { x: -30, y: -30, w: 60, h: 60 },
  numbered: false,
  interior: { x: -20, y: -20, w: 40, h: 40 },
  seats: [
    { x: 200, y: 120, out: { x: 0, y: -1 }, number: 1, row: sitter("Alan", "Turing", "") },
    { x: 200, y: 200, out: { x: 0, y: 1 }, number: 2, row: sitter("Joan", "Clarke", "") },
  ],
};

const card: CardSpec = { widthMm: 420, heightMm: 297, fold: "none", foldPositionMm: 0, invertBackPanel: false, bleedMm: 0 };

const room = (over: Partial<RoomElement> = {}): RoomElement => ({
  kind: "room",
  id: "plan",
  x: 10,
  y: 10,
  w: 400,
  h: 277,
  z: 1,
  show: "room",
  fontId: "crimson",
  fontSizePt: 12,
  nameGap: 0,
  namesAtChairs: true,
  colorHex: "#000000",
  tableHex: "#eeeeee",
  seatHex: "#cccccc",
  wallHex: "#333333",
  tableLabels: true,
  walls: true,
  ...over,
});

const draw = (el: RoomElement, row: Record<string, string> = {}, withRoom: RoomScene | null = scene, chairName = "{{First Name}}") => {
  const { scene: out, warnings } = resolveCard(
    { elements: [el], backgroundHex: null, chairName },
    row,
    card,
    makeResolveOptions(fonts, {}, new Map(), {}, withRoom),
  );
  return { elements: out.elements, warnings };
};
const texts = (elements: ResolvedElement[]) => elements.flatMap((el) => (el.kind === "text" ? [el.lines.join(" ")] : []));

describe("a floor plan", () => {
  it("draws the walls, every table and every chair, and the names of the people in them", () => {
    const { elements } = draw(room());
    expect(elements.filter((el) => el.kind === "line")).toHaveLength(2);
    // Two tables and three chairs.
    expect(elements.filter((el) => el.kind === "icon")).toHaveLength(5);
    expect(texts(elements).sort()).toEqual(["Ada", "Grace", "Table 1", "Top table"]);
  });

  it("scales the room into its box, one scale both ways, centred", () => {
    const { elements } = draw(room());
    // 400 × 200 into 400 × 277: scale 1, centred top to bottom.
    const first = elements.find((el) => el.kind === "icon")!;
    expect(first).toMatchObject({ x: 10 + 60, y: 10 + 38.5 + 60, w: 80, h: 80 });
  });

  it("turns a table with its plan, and keeps its names upright", () => {
    const { elements } = draw(room());
    const top = elements.filter((el) => el.kind === "icon")[3]!;
    expect(top.rotationDeg).toBe(30);
    expect(elements.filter((el) => el.kind === "text").every((el) => el.rotationDeg === 0)).toBe(true);
  });

  it("names every piece after the element, so it is grabbed as one", () => {
    const { elements } = draw(room());
    expect(new Set(elements.map((el) => el.sourceId))).toEqual(new Set(["plan"]));
    expect(new Set(elements.map((el) => el.id)).size).toBe(elements.length);
  });

  it("names each sitter as the design's format says, and an empty chair not at all", () => {
    const names = (format: string) => texts(draw(room({ tableLabels: false }), {}, scene, format).elements).sort();
    expect(names("{{Last Name}}, {{First Name}}")).toEqual(["Byron, Ada", "Hopper, Grace"]);
    expect(names("{{First Name}} {{Last Name}}")).toEqual(["Ada Byron", "Grace Hopper"]);
    expect(names("{{Seat}}")).toEqual(["1", "1"]);
    expect(names("")).toEqual([]);
  });

  it("names the guests of a table where they sit where they like inside it, not at chairs", () => {
    const withFree = { ...scene, tables: [...scene.tables, freeSeating] };
    const { elements } = draw(room({ walls: false }), {}, withFree);
    const inside = elements.find((el) => el.kind === "text" && el.lines.includes("Alan"))!;
    expect(inside.kind === "text" && inside.lines).toEqual(["Alan", "Joan"]);
    // Upright, within the table's interior: 40 across at scale 1, centred on the table.
    expect(inside).toMatchObject({ rotationDeg: 0, w: 40, h: 40 });
    // Its name sits above it, clear of the names inside.
    const label = elements.find((el) => el.kind === "text" && el.lines.includes("Table 2"))!;
    expect(label.y + label.h).toBeLessThan(inside.y);
  });

  it("draws just this card's table, filling the box, when it is a table's own map", () => {
    const { elements } = draw(room({ show: "table", walls: true }), { Table: "top TABLE" });
    expect(elements.filter((el) => el.kind === "line")).toHaveLength(0);
    expect(texts(elements).sort()).toEqual(["Grace", "Top table"]);
    const table = elements.find((el) => el.kind === "icon")!;
    expect(table.w).toBeGreaterThan(120);
  });

  it("says so when the card's table is not on the plan, or there is no plan", () => {
    expect(draw(room({ show: "table" }), { Table: "Table 9" }).warnings).toContainEqual(
      expect.objectContaining({ kind: "missing-field", detail: expect.stringMatching(/no table called "Table 9"/) }),
    );
    expect(draw(room(), {}, null).warnings).toContainEqual(expect.objectContaining({ detail: expect.stringMatching(/no seating plan/) }));
  });
});

describe("names inside a long table", () => {
  it("spread across columns, all one size, rather than crushed into one", () => {
    const long = {
      label: "Top table",
      x: 200,
      y: 100,
      rotationDeg: 0,
      pathD: "M -150 -15 H 150 V 15 H -150 Z",
      view: { x: -150, y: -15, w: 300, h: 30 },
      numbered: false,
      interior: { x: -142, y: -7, w: 284, h: 14 },
      seats: ["Alex", "David", "Helen", "Ines", "Lucia", "Mateo"].map((first, i) => ({
        x: 200,
        y: 80,
        out: { x: 0, y: -1 },
        number: i + 1,
        row: { "First Name": first, "Last Name": "Morgan" },
      })),
    };
    const { elements } = draw(room({ walls: false, tableLabels: false }), {}, { ...scene, tables: [long] });
    const columns = elements.filter((el) => el.kind === "text");
    expect(columns.length).toBeGreaterThan(1);
    expect(new Set(columns.map((el) => el.kind === "text" && el.fontSizePt)).size).toBe(1);
    expect(columns.flatMap((el) => (el.kind === "text" ? el.lines : []))).toEqual(["Alex", "David", "Helen", "Ines", "Lucia", "Mateo"]);
  });
});

describe("names inside a round table, in columns", () => {
  it("leave a gap between the columns, however long the longest name", () => {
    const names = ["Eleanor", "Florence", "Devendra", "Beatrix", "Charis", "Chloé", "Anneliese", "Callum"];
    const round = {
      ...freeSeating,
      seats: names.map((first, i) => ({ ...freeSeating.seats[0]!, number: i + 1, row: { "First Name": first, "Last Name": "" } })),
    };
    const { elements } = draw(room({ walls: false, tableLabels: false, fontSizePt: 200 }), {}, { ...scene, tables: [round] });
    const columns = elements.flatMap((el) => (el.kind === "text" ? [el] : []));
    expect(columns.length).toBe(2);
    const font = fonts.get(columns[0]!.fontId)!;
    const [left, right] = columns.map((c) => {
      const half = widestLineMm(font, c.lines, c.fontSizePt, 0) / 2;
      return { from: c.x + c.w / 2 - half, to: c.x + c.w / 2 + half };
    });
    expect(right!.from - left!.to).toBeGreaterThan(1);
  });
});

describe("names at chairs", () => {
  it("are all one size: a long name does not read smaller than its neighbour", () => {
    const crowded = {
      ...scene.tables[0]!,
      seats: [
        // Side by side, 20 apart: a name may be about that wide.
        { x: 90, y: 45, out: { x: 0, y: -1 }, number: 1, row: sitter("Al", "Bo", "1") },
        { x: 110, y: 45, out: { x: 0, y: -1 }, number: 2, row: sitter("Bartholomew-Fortescue", "Pemberton-Blythe", "2") },
      ],
    };
    const { elements } = draw(room({ tableLabels: false, walls: false }), {}, { ...scene, tables: [crowded] }, "{{First Name}}");
    const sizes = elements.flatMap((el) => (el.kind === "text" ? [el.fontSizePt] : []));
    expect(sizes).toHaveLength(2);
    expect(sizes[0]).toBe(sizes[1]);
    expect(sizes[0]).toBeLessThan(12);
  });

  it("sit as far out from their chair as the design says", () => {
    const name = (nameGap: number) =>
      draw(room({ tableLabels: false, walls: false, nameGap }), {}, { ...scene, tables: [scene.tables[0]!] }).elements.find((el) => el.kind === "text")!;
    // Ada's chair faces up the page: further out is higher.
    expect(name(1).y).toBeLessThan(name(0).y);
  });
});
