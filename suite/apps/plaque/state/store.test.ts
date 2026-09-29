import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyTrousseau, migrate } from "@jfrusher/trousseau";
import { useTrousseauStore } from "@/lib/store/useTrousseauStore";
import { usePlaque } from "./store";

const HEADERS = ["First Name", "Last Name", "Table", "Dietary"];
const ROWS = [
  { "First Name": "Charis", "Last Name": "Smith", Table: "Table 1", Dietary: "Vegetarian" },
  { "First Name": "Eleanor", "Last Name": "Vane", Table: "Table 2", Dietary: "Vegan" },
];

const csv = () => ({ headers: HEADERS, rows: ROWS, issues: [], fileName: "guests.csv" });
const state = () => usePlaque.getState();
// Place cards' undo is the wedding's.
const undo = () => useTrousseauStore.getState().undo();
const redo = () => useTrousseauStore.getState().redo();
const past = () => useTrousseauStore.getState().past;

beforeEach(() => {
  const raw = emptyTrousseau() as unknown as Record<string, unknown>;
  useTrousseauStore.setState({ status: "ready", raw, doc: migrate(raw), past: [], future: [] });
  state().clearAll();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("first upload", () => {
  it("starts with no elements, so the default template is not built against columns that do not exist", () => {
    expect(state().template.elements).toEqual([]);
  });

  it("lays out a real template as soon as a CSV lands", () => {
    state().setCsv(csv());
    const elements = state().template.elements;
    expect(elements.length).toBeGreaterThan(0);
    const text = elements.find((el) => el.kind === "text");
    expect(text?.kind === "text" && text.template).toBe("{{First Name}} {{Last Name}}");
  });

  it("never overwrites a design the user has already made", () => {
    state().setCsv(csv());
    state().addElement("rect");
    const before = state().template.elements.map((el) => el.id);
    state().setCsv({ ...csv(), headers: ["Name"], fileName: "other.csv" });
    expect(state().template.elements.map((el) => el.id)).toEqual(before);
  });
});

describe("elements", () => {
  it("selects what it adds", () => {
    state().addElement("text");
    expect(state().selectedId).toBe(state().template.elements[0]?.id);
  });

  it("puts a duplicate on top and offset from its source", () => {
    state().addElement("rect");
    const source = state().template.elements[0]!;
    state().duplicateElement(source.id);
    const copy = state().template.elements[1]!;
    expect(copy.id).not.toBe(source.id);
    expect(copy.x).toBe(source.x + 3);
    expect(copy.z).toBeGreaterThan(source.z);
  });

  it("clears the selection when the selected element is deleted", () => {
    state().addElement("text");
    const id = state().selectedId!;
    state().removeElement(id);
    expect(state().selectedId).toBeNull();
    expect(state().template.elements).toEqual([]);
  });

  it("raises and lowers z", () => {
    state().addElement("text");
    state().addElement("rect");
    const [first, second] = state().template.elements;
    state().raiseElement(first!.id);
    expect(state().template.elements[0]!.z).toBeGreaterThan(state().template.elements[1]!.z);
    state().lowerElement(first!.id);
    expect(state().template.elements[0]!.z).toBeLessThan(second!.z);
  });
});

describe("copying the front onto the back", () => {
  beforeEach(() => {
    state().setCsv(csv());
  });

  it("gives the back the same design at the same card coordinates", () => {
    // Card-local coordinates are copied verbatim: imposition mirrors the card
    // SLOT, so identical coordinates are what puts the twin behind its front and
    // reading the same way up from the other side of the table.
    state().copyFrontToBack();
    const { elements } = state().template;
    const fronts = elements.filter((el) => el.side !== "back");
    const backs = elements.filter((el) => el.side === "back");

    expect(backs).toHaveLength(fronts.length);
    expect(backs.map((el) => [el.kind, el.x, el.y, el.w, el.h])).toEqual(
      fronts.map((el) => [el.kind, el.x, el.y, el.w, el.h]),
    );
    // New ids, or the two sides would be one element and could never diverge.
    expect(backs.some((el) => fronts.some((f) => f.id === el.id))).toBe(false);
  });

  it("turns duplex on, since a back nobody prints is not a back", () => {
    expect(state().sheet.duplex).toBe(false);
    state().copyFrontToBack();
    expect(state().sheet.duplex).toBe(true);
    expect(state().editingSide).toBe("back");
  });

  it("replaces the old back rather than piling copies onto it", () => {
    state().copyFrontToBack();
    const first = state().template.elements.filter((el) => el.side === "back").length;
    state().copyFrontToBack();
    expect(state().template.elements.filter((el) => el.side === "back")).toHaveLength(first);
  });

  it("carries per-row edits across, or the back would print the raw CSV value", () => {
    const rowId = state().rowIds[0]!;
    const element = state().template.elements[0]!;
    state().overrideForRow(rowId, element.id, { fontSizePt: 11 });
    state().copyFrontToBack();

    const twin = state().template.elements.find((el) => el.side === "back" && el.kind === element.kind)!;
    expect(state().template.overrides?.[rowId]?.[twin.id]).toEqual({ fontSizePt: 11 });
  });

  it("is undoable like any other design change", () => {
    const before = state().template.elements.length;
    state().copyFrontToBack();
    undo();
    expect(state().template.elements).toHaveLength(before);
    expect(state().sheet.duplex).toBe(false);
  });
});

describe("undo", () => {
  it("steps back through changes made a moment apart", () => {
    vi.useFakeTimers();
    state().setCard({ widthMm: 100 });
    vi.advanceTimersByTime(1000);
    state().setCard({ widthMm: 120 });
    undo();
    expect(state().card.widthMm).toBe(100);
    undo();
    expect(state().card.widthMm).toBe(85);
  });

  it("takes a width typed in quick keystrokes back in one step", () => {
    state().setCard({ widthMm: 1 });
    state().setCard({ widthMm: 10 });
    state().setCard({ widthMm: 100 });
    undo();
    expect(state().card.widthMm).toBe(85);
  });

  it("redoes what it undid", () => {
    state().setCard({ widthMm: 100 });
    undo();
    redo();
    expect(state().card.widthMm).toBe(100);
  });

  it("drops the redo stack once a new change is made", () => {
    state().setCard({ widthMm: 100 });
    undo();
    state().setCard({ widthMm: 70 });
    redo();
    expect(state().card.widthMm).toBe(70);
  });

  it("records one entry for a whole drag, not one per frame", () => {
    state().addElement("rect");
    const id = state().selectedId!;
    const depth = past().length;

    for (let i = 0; i < 50; i++) state().setElementBox(id, { x: i, y: i, w: 10, h: 10 });

    expect(past()).toHaveLength(depth + 1);
    undo();
    expect(state().template.elements[0]!.x).not.toBe(49);
  });
});

describe("card and sheet", () => {
  it("recentres the fold when the fold axis changes", () => {
    state().setCard({ widthMm: 85, heightMm: 110 });
    state().setCard({ fold: "horizontal" });
    expect(state().card.foldPositionMm).toBe(55);
    state().setCard({ fold: "vertical" });
    expect(state().card.foldPositionMm).toBe(42.5);
  });

  it("returns to sheet one whenever the layout changes underneath", () => {
    state().setCsv(csv());
    state().setPage(3);
    state().setSheet({ gapXMm: 8 });
    expect(state().page).toBe(0);
  });
});

describe("fonts", () => {
  it("moves elements off a font that is removed rather than leaving them blank", () => {
    state().setCsv(csv());
    const font = { id: "user:x", family: "X" } as never;
    state().addFont(font, "X");
    const textEl = state().template.elements.find((el) => el.kind === "text")!;
    state().updateElement(textEl.id, { fontId: "user:x" });
    state().removeFont("user:x");
    const after = state().template.elements.find((el) => el.id === textEl.id)!;
    expect(after.kind === "text" && after.fontId).toBe("crimson");
    expect(state().fonts.has("user:x")).toBe(false);
  });
});

describe("clearAll", () => {
  it("wipes the guest list and the design — and can be undone", () => {
    state().setCsv(csv());
    state().addElement("rect");
    const elements = state().template.elements;
    state().clearAll();
    expect(state().rows).toEqual([]);
    expect(state().headers).toEqual([]);
    expect(state().template.elements).toEqual([]);
    expect(state().fileName).toBeNull();

    undo();
    expect(state().template.elements).toEqual(elements);
  });
});

describe("combining rows (S-I.3)", () => {
  const threeRows = () => ({
    headers: HEADERS,
    rows: [
      ...ROWS,
      { "First Name": "Tobias", "Last Name": "Ashdown", Table: "Table 1", Dietary: "" },
    ],
    issues: [],
    fileName: "guests.csv",
  });

  it("gives every row an id, so an override can outlive a re-order", () => {
    state().setCsv(csv());
    expect(state().rowIds).toHaveLength(ROWS.length);
    expect(new Set(state().rowIds).size).toBe(ROWS.length);
  });

  it("joins two guests onto one row and drops the originals from the list", () => {
    state().setCsv(threeRows());
    state().combineRows([0, 2]);
    expect(state().rows).toHaveLength(2);
    expect(state().rows[0]?.["First Name"]).toBe("Charis & Tobias");
  });

  it("says a shared value once rather than repeating it", () => {
    state().setCsv(threeRows());
    state().combineRows([0, 2]);
    // Both are on Table 1; the card should not read "Table 1 & Table 1".
    expect(state().rows[0]?.["Table"]).toBe("Table 1");
  });

  it("puts the combined row where the first of its sources was", () => {
    state().setCsv(threeRows());
    state().combineRows([1, 2]);
    expect(state().rows[0]?.["First Name"]).toBe("Charis");
    expect(state().rows[1]?.["First Name"]).toBe("Eleanor & Tobias");
  });

  it("restores the originals exactly when split again", () => {
    state().setCsv(threeRows());
    const before = state().rows;
    const beforeIds = state().rowIds;
    state().combineRows([0, 2]);
    state().splitRow(state().rowIds[0]!);
    expect(state().rows).toEqual(before);
    expect(state().rowIds).toEqual(beforeIds);
    expect(state().merged).toEqual({});
  });

  it("refuses to combine fewer than two rows", () => {
    state().setCsv(csv());
    state().combineRows([0]);
    expect(state().rows).toHaveLength(2);
  });

  it("ignores a split of something that was never combined", () => {
    state().setCsv(csv());
    state().splitRow("nope");
    expect(state().rows).toHaveLength(2);
  });

  it("is taken back by undo as by its inverse, split", () => {
    vi.useFakeTimers();
    state().setCsv(threeRows());
    const rows = state().rows;
    vi.advanceTimersByTime(1000);
    state().combineRows([0, 2]);
    undo();
    expect(state().rows).toEqual(rows);

    redo();
    state().splitRow(state().rowIds[0]!);
    expect(state().rows).toEqual(rows);
  });

  it("drops ids and combines when a new CSV arrives", () => {
    state().setCsv(threeRows());
    state().combineRows([0, 2]);
    state().setCsv(csv());
    expect(state().merged).toEqual({});
    expect(state().rowIds).toHaveLength(ROWS.length);
  });
});

describe("per-row overrides (D1)", () => {
  it("stores and clears a patch for one row", () => {
    state().setCsv(csv());
    state().addElement("text");
    const elementId = state().template.elements[0]!.id;
    const rowId = state().rowIds[0]!;

    state().overrideForRow(rowId, elementId, { fontSizePt: 11 });
    expect(state().template.overrides?.[rowId]?.[elementId]).toEqual({ fontSizePt: 11 });

    state().overrideForRow(rowId, elementId, null);
    expect(state().template.overrides?.[rowId]).toBeUndefined();
  });

  it("is undoable, because it is design and not data", () => {
    state().setCsv(csv());
    state().addElement("text");
    const elementId = state().template.elements[0]!.id;
    state().overrideForRow(state().rowIds[0]!, elementId, { fontSizePt: 11 });
    undo();
    expect(state().template.overrides ?? {}).toEqual({});
  });
});

describe("a second CSV with different headers (S-B.1)", () => {
  it("re-attaches the design by column role rather than unbinding it", () => {
    state().setCsv(csv());
    const before = state().template.elements.length;
    expect(before).toBeGreaterThan(0);

    state().setCsv({
      headers: ["Guest First", "Guest Last", "Tbl", "Dietary Needs"],
      rows: [{ "Guest First": "Ada", "Guest Last": "Lovelace", Tbl: "Table 1", "Dietary Needs": "" }],
      issues: [],
      fileName: "next-year.csv",
    });

    const templates = state()
      .template.elements.flatMap((el) => (el.kind === "text" ? [el.template] : []));
    expect(state().template.elements).toHaveLength(before);
    expect(templates.join(" ")).toContain("{{Guest First}}");
    expect(templates.join(" ")).not.toContain("{{First Name}}");
  });

  it("builds a fresh template only when there was nothing to keep", () => {
    state().setCsv(csv());
    expect(state().template.elements.length).toBeGreaterThan(0);
  });
});
