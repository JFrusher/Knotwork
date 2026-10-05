import { describe, expect, it } from "vitest";
import type { RoomScene, RoomTable, TextElement } from "../types";
import { noFit, resolveCard } from "./bindings";
import { chairName, chairRef, chairToken, chairValues } from "./chairs";
import { unboundTokens } from "./rebind";

const sitter = (first: string, last: string) => ({ "First Name": first, "Last Name": last });
const table = (label: string, numbered: boolean, names: Array<[string, string] | null>): RoomTable => ({
  label,
  x: 0,
  y: 0,
  rotationDeg: 0,
  pathD: "",
  view: { x: 0, y: 0, w: 1, h: 1 },
  numbered,
  interior: { x: 0, y: 0, w: 1, h: 1 },
  seats: names.map((name, i) => ({ x: 0, y: 0, out: { x: 0, y: 1 }, number: i + 1, row: name ? sitter(...name) : null })),
});
const scene: RoomScene = {
  bounds: { x: 0, y: 0, w: 1, h: 1 },
  walls: [],
  seatRadius: 1,
  tables: [
    table("Table 1", true, [["Ada", "Byron"], null, ["Grace", "Hopper"]]),
    table("Table 2", true, [["Alan", "Turing"]]),
    table("Table 3", false, [["Joan", "Clarke"]]),
  ],
};

describe("naming a chair", () => {
  it("reads both forms, and leaves an ordinary column alone", () => {
    expect(chairRef("At seat 3")).toEqual({ table: null, seat: 3 });
    expect(chairRef("at seat 12")).toEqual({ table: null, seat: 12 });
    expect(chairRef("Table 1, seat 3")).toEqual({ table: "Table 1", seat: 3 });
    expect(chairRef("Top table,seat 2")).toEqual({ table: "Top table", seat: 2 });
    expect(chairRef("Seat")).toBeNull();
    expect(chairRef("First Name")).toBeNull();
    expect(chairToken({ table: null, seat: 3 })).toBe("At seat 3");
    expect(chairToken({ table: "Table 1", seat: 3 })).toBe("Table 1, seat 3");
  });
});

describe("a guest known by a name of their own", () => {
  it("is called it wherever the design's name format would name them", () => {
    const format = { chairName: "{{First Name}}" };
    expect(chairName(format, { "First Name": "Josephine", "Last Name": "Clarke", "Known As": "Granny Jo" })).toBe("Granny Jo");
    expect(chairName(format, { "First Name": "Josephine", "Last Name": "Clarke", "Known As": "" })).toBe("Josephine");
  });
});

describe("{{Known As}} on a card", () => {
  const card = { widthMm: 90, heightMm: 55, fold: "none", foldPositionMm: 0, invertBackPanel: false, bleedMm: 0 } as const;
  const text = { kind: "text", id: "t", x: 0, y: 0, w: 80, h: 20, z: 0, template: "{{Known As}}", fontId: "crimson", fontSizePt: 12, align: "center", vAlign: "middle", lineHeight: 1.2, colorHex: "#000000", letterSpacingMm: 0, fit: { mode: "shrink", minFontSizePt: 6, maxLines: 1, anchor: "align" } } as TextElement;
  const say = (row: Record<string, string>, chairName?: string) =>
    resolveCard({ backgroundHex: null, elements: [text], ...(chairName ? { chairName } : {}) }, row, card, { fitText: noFit, iconPath: () => null }).scene.elements.flatMap((el) => (el.kind === "text" ? el.lines : []));

  it("is the guest's own name, else the design's name format", () => {
    expect(say({ "First Name": "Josephine", "Last Name": "Clarke", "Known As": "Granny Jo" })).toEqual(["Granny Jo"]);
    expect(say({ "First Name": "Josephine", "Last Name": "Clarke", "Known As": "" })).toEqual(["Josephine Clarke"]);
    expect(say({ "First Name": "Josephine", "Last Name": "Clarke", "Known As": "" }, "{{First Name}}")).toEqual(["Josephine"]);
  });
});

describe("whoever sits there now", () => {
  const values = (tokens: string[], cardTable: string, chairName?: string) =>
    chairValues(tokens, { Table: cardTable }, scene, chairName === undefined ? {} : { chairName });

  it("is the sitter of that seat of the card's own table, named as the design names people", () => {
    expect(values(["At seat 1", "At seat 3"], "Table 1").values).toEqual({ "At seat 1": "Ada Byron", "At seat 3": "Grace Hopper" });
    expect(values(["At seat 1"], "Table 2", "{{First Name}}").values).toEqual({ "At seat 1": "Alan" });
  });

  it("is that one chair in the room, whatever table the card is for", () => {
    expect(values(["Table 2, seat 1"], "Table 1").values).toEqual({ "Table 2, seat 1": "Alan Turing" });
  });

  it("is nothing for an empty chair, or a seat a smaller table does not have, and says nothing either", () => {
    const { values: got, problems } = values(["At seat 2", "At seat 9"], "Table 1");
    expect(got).toEqual({ "At seat 2": "", "At seat 9": "" });
    expect(problems).toEqual([]);
  });

  it("says so when a named chair is not there", () => {
    expect(values(["Table 2, seat 5"], "Table 1").problems).toEqual(["Table 2 has 1 seats, so there is no seat 5."]);
    expect(values(["Table 9, seat 1"], "Table 1").problems).toEqual(['The plan has no table called "Table 9".']);
  });

  it("never names a seat at a table where guests sit where they like", () => {
    const { values: got, problems } = values(["At seat 1"], "Table 3");
    expect(got).toEqual({ "At seat 1": "" });
    // One message for a design, whichever table's card says it.
    expect(problems).toEqual(["At tables where guests sit where they like there is no seat 1, so it says nothing there."]);
    expect(values(["Table 3, seat 1"], "Table 1").problems).toEqual(["Table 3 seats its guests where they like, so it has no seat 1."]);
  });
});

describe("on a card", () => {
  const text = (template: string): TextElement => ({
    kind: "text",
    id: "t",
    x: 0,
    y: 0,
    w: 50,
    h: 10,
    z: 0,
    template,
    fontId: "crimson",
    fontSizePt: 12,
    align: "center",
    vAlign: "middle",
    lineHeight: 1.2,
    colorHex: "#000000",
    letterSpacingMm: 0,
    fit: { mode: "shrink", minFontSizePt: 6, maxLines: 1, anchor: "align" },
  });
  const card = { widthMm: 100, heightMm: 100, fold: "none" as const, foldPositionMm: 0, invertBackPanel: false, bleedMm: 0 };

  it("fills in on every table's card from one design", () => {
    const resolve = (Table: string) =>
      resolveCard({ elements: [text("Opposite: {{At seat 1}}")], backgroundHex: null }, { Table }, card, {
        fitText: noFit,
        iconPath: () => null,
        room: () => scene,
      }).scene.elements[0];
    expect(resolve("Table 1")).toMatchObject({ lines: ["Opposite: Ada Byron"] });
    expect(resolve("Table 2")).toMatchObject({ lines: ["Opposite: Alan Turing"] });
  });

  it("is not a missing column, so it never blocks a print", () => {
    const template = { elements: [text("{{At seat 1}} and {{Table 2, seat 1}}")], backgroundHex: null };
    expect(unboundTokens(template, ["Name", "Table"])).toEqual([]);
    // A seat of the card's own table needs the card to have a table.
    expect(unboundTokens(template, ["Name"])).toEqual(["Table"]);
  });
});
