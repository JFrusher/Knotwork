import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyKnotwork, migrate } from "@jfrusher/knotwork";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import { useStationery } from "./store";

const GUESTS = {
  g1: { id: "g1", firstName: "Charis", lastName: "Smith", assignedTableId: "t1" },
  g2: { id: "g2", firstName: "Eleanor", lastName: "Vane", assignedTableId: "t2" },
};
const TOBIAS = { g3: { id: "g3", firstName: "Tobias", lastName: "Ashdown", assignedTableId: "t1" } };
const TABLES = {
  t1: { id: "t1", label: "Table 1", assignedGuestIds: ["g1", "g3"] },
  t2: { id: "t2", label: "Table 2", assignedGuestIds: ["g2"] },
};

/** Puts guests in the room, as Seating would: Place cards reads them from there. */
const room = (guests: Record<string, unknown> = GUESTS, tables: Record<string, unknown> = TABLES) => {
  const raw = { ...useKnotworkStore.getState().raw, guests, seating: { tables } };
  useKnotworkStore.setState({ raw, doc: migrate(raw) });
};
const state = () => useStationery.getState();
// Place cards' undo is the wedding's.
const undo = () => useKnotworkStore.getState().undo();
const redo = () => useKnotworkStore.getState().redo();
const past = () => useKnotworkStore.getState().past;

beforeEach(() => {
  const raw = emptyKnotwork() as unknown as Record<string, unknown>;
  useKnotworkStore.setState({ status: "ready", raw, doc: migrate(raw), past: [], future: [] });
  state().clearAll();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("a new wedding", () => {
  it("starts with a place card laid out for the room's columns", () => {
    const text = state().template.elements.find((el) => el.kind === "text");
    expect(text?.kind === "text" && text.template).toContain("{{First Name}}");
  });

  it("prints whoever is in the room, without being asked", () => {
    expect(state().rows).toEqual([]);
    room();
    expect(state().rows.map((row) => row["Name"])).toEqual(["Charis Smith", "Eleanor Vane"]);
    expect(state().rowIds).toEqual(["g1", "g2"]);
  });

  it("follows a move in the room, and leaves the design alone", () => {
    room();
    state().addElement("rect");
    const design = state().template;
    room(GUESTS, { t1: { id: "t1", label: "Table 1", assignedGuestIds: ["g1", "g2"] } });
    expect(state().rows.map((row) => row["Table"])).toEqual(["Table 1", "Table 1"]);
    expect(state().template).toBe(design);
  });

  it("follows a name corrected on the guest list", () => {
    room();
    room({ ...GUESTS, g2: { ...GUESTS.g2, lastName: "Vane-Ashby" } });
    expect(state().rows[1]?.["Name"]).toBe("Eleanor Vane-Ashby");
  });
});

describe("elements", () => {
  // A blank piece: the place cards start with a design already on them.
  beforeEach(() => {
    state().addPiece("Blank");
  });

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
    room();
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
    room();
    state().setPage(3);
    state().setSheet({ gapXMm: 8 });
    expect(state().page).toBe(0);
  });
});

describe("fonts", () => {
  it("moves elements off a font that is removed rather than leaving them blank", () => {
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
  it("returns the stationery to its starting place cards — and can be undone", () => {
    room();
    state().addElement("rect");
    state().addPiece("Menus");
    const before = state().pieces;
    state().clearAll();
    expect(state().pieces).toEqual([{ id: "place-cards", name: "Place cards" }]);
    expect(state().template.elements.some((el) => el.kind === "rect")).toBe(false);
    // The guests are the room's, not the design's: clearing the cards keeps them.
    expect(state().rows).toHaveLength(2);

    undo();
    expect(state().pieces).toEqual(before);
  });
});

describe("combining rows (S-I.3)", () => {
  const three = () => room({ ...GUESTS, ...TOBIAS });

  it("gives every row its guest's id, so an override follows the guest", () => {
    room();
    expect(state().rowIds).toEqual(["g1", "g2"]);
  });

  it("joins two guests onto one row and drops the originals from the list", () => {
    three();
    state().combineRows([0, 2]);
    expect(state().rows).toHaveLength(2);
    expect(state().rows[0]?.["First Name"]).toBe("Charis & Tobias");
    expect(Object.values(state().merged)).toEqual([["g1", "g3"]]);
  });

  it("says a shared value once rather than repeating it", () => {
    three();
    state().combineRows([0, 2]);
    // Both are on Table 1; the card should not read "Table 1 & Table 1".
    expect(state().rows[0]?.["Table"]).toBe("Table 1");
  });

  it("puts the combined row where the first of its guests was", () => {
    three();
    state().combineRows([1, 2]);
    expect(state().rows[0]?.["First Name"]).toBe("Charis");
    expect(state().rows[1]?.["First Name"]).toBe("Eleanor & Tobias");
  });

  it("restores the originals exactly when split again", () => {
    three();
    const before = state().rows;
    const beforeIds = state().rowIds;
    state().combineRows([0, 2]);
    state().splitRow(state().rowIds[0]!);
    expect(state().rows).toEqual(before);
    expect(state().rowIds).toEqual(beforeIds);
    expect(state().merged).toEqual({});
  });

  it("opens a combined card up rather than nesting it, when it is combined again", () => {
    three();
    state().combineRows([0, 1]);
    state().combineRows([0, 1]);
    expect(state().rows).toHaveLength(1);
    expect(Object.values(state().merged)).toEqual([["g1", "g2", "g3"]]);
  });

  it("follows its guests: one moving table moves the card's table line", () => {
    three();
    state().combineRows([0, 2]);
    room({ ...GUESTS, ...TOBIAS }, { t2: { id: "t2", label: "Table 2", assignedGuestIds: ["g1", "g2", "g3"] } });
    expect(state().rows[0]?.["Table"]).toBe("Table 2");
  });

  it("refuses to combine fewer than two rows", () => {
    room();
    state().combineRows([0]);
    expect(state().rows).toHaveLength(2);
  });

  it("ignores a split of something that was never combined", () => {
    room();
    state().splitRow("nope");
    expect(state().rows).toHaveLength(2);
  });

  it("is taken back by undo as by its inverse, split", () => {
    vi.useFakeTimers();
    three();
    const rows = state().rows;
    vi.advanceTimersByTime(1000);
    state().combineRows([0, 2]);
    undo();
    expect(state().rows).toEqual(rows);

    redo();
    state().splitRow(state().rowIds[0]!);
    expect(state().rows).toEqual(rows);
  });
});

describe("per-row overrides (D1)", () => {
  it("stores and clears a patch for one row", () => {
    room();
    state().addElement("text");
    const elementId = state().template.elements[0]!.id;
    const rowId = state().rowIds[0]!;

    state().overrideForRow(rowId, elementId, { fontSizePt: 11 });
    expect(state().template.overrides?.[rowId]?.[elementId]).toEqual({ fontSizePt: 11 });

    state().overrideForRow(rowId, elementId, null);
    expect(state().template.overrides?.[rowId]).toBeUndefined();
  });

  it("is undoable, because it is design and not data", () => {
    room();
    state().addElement("text");
    const elementId = state().template.elements[0]!.id;
    state().overrideForRow(state().rowIds[0]!, elementId, { fontSizePt: 11 });
    undo();
    expect(state().template.overrides ?? {}).toEqual({});
  });
});

describe("reprinting a few", () => {
  it("is forgotten when another piece is opened", () => {
    room();
    state().setPrintOnly(["row:g1"]);
    state().addPiece("Escort cards");
    expect(state().printOnly).toBeNull();
  });
});

describe("an order of service", () => {
  it("is a booklet from the first design, and a design applied over it keeps the couple's pictures", async () => {
    const { GALLERY } = await import("../core/data/gallery");
    state().openPiece("order-of-service-classic");
    expect(state().booklet).toEqual({ output: "home", paper: "A4" });
    expect(state().rows.map((row) => row["Page"])).toEqual(["1", "2", "3", "4"]);
    // Nothing in the ceremony yet: both inside pages are there only so it folds.
    expect(state().blankPages).toBe(2);

    state().setPreviewGuestIndex(2);
    state().addElement("image");
    const picture = state().template.elements.at(-1)!;
    expect(picture.page).toBe("inside");

    state().applyGalleryTemplate(GALLERY.find((entry) => entry.id === "order-of-service-script")!);
    const ids = state().template.elements.map((el) => el.id);
    expect(ids).toContain(picture.id);
    expect(ids).not.toContain("inside-frame");
    expect(ids).toContain("inside-rule-top");
  });
});
