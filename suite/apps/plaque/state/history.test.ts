import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined }));

const { emptyKnotwork, migrate } = await import("@jfrusher/knotwork");
const { useKnotworkStore } = await import("@/lib/store/useKnotworkStore");
const { usePlaque } = await import("./store");
const { initialSuite } = await import("./design");
const { artefactsOf } = await import("../core/data/parts");

/*
 * What was printed is a fact about paper, not an edit: undo does not take it
 * back, and a print is recorded on the piece it was made from.
 */
type Raw = Record<string, any>;
const plaque = () => usePlaque.getState();
const shared = () => useKnotworkStore.getState();
const cards = () => artefactsOf(plaque().template, plaque().rows, plaque().headers, plaque().rowIds);

beforeEach(() => {
  const raw = {
    ...(emptyKnotwork() as unknown as Raw),
    guests: {
      g1: { id: "g1", firstName: "Charis", lastName: "Smith" },
      g2: { id: "g2", firstName: "Eleanor", lastName: "Vane" },
    },
    stationery: { version: 3, savedAt: null, ...initialSuite() },
  };
  useKnotworkStore.setState({ status: "ready", raw, doc: migrate(raw), past: [], future: [] });
});

describe("a print and the wedding's history", () => {
  test("undoing an edit made before printing keeps the record of what was printed", () => {
    plaque().setBackground("#ff0000");
    plaque().notePrinted(plaque().pieceId, cards(), false);
    expect(plaque().printed).not.toBeNull();
    shared().undo();
    expect(plaque().template.backgroundHex).not.toBe("#ff0000");
    expect(plaque().printed).not.toBeNull();
    shared().redo();
    expect(plaque().printed).not.toBeNull();
  });

  test("a print finished after switching pieces is recorded on the piece it was printed from", () => {
    const from = plaque().pieceId;
    const printedCards = cards();
    plaque().addPiece("Other");
    plaque().notePrinted(from, printedCards, false);
    expect(plaque().printed).toBeNull();
    plaque().switchPiece(from);
    expect(Object.keys(plaque().printed!.cards)).toHaveLength(2);
  });

  test("removing the open piece does not hand its chosen few to the next", () => {
    plaque().addPiece("Second");
    const second = plaque().pieceId;
    plaque().addPiece("Third");
    plaque().switchPiece(second);
    plaque().setPrintOnly([cards()[0]!.key]);
    plaque().removePiece(second);
    expect(plaque().pieceId).not.toBe(second);
    expect(plaque().printOnly).toBeNull();
  });

  test("a piece made from a starter design is one step: one undo takes it all back", () => {
    const before = plaque().pieces.length;
    plaque().openPiece("floor-plan");
    expect(plaque().pieces.length).toBe(before + 1);
    expect(plaque().template.elements.some((el) => el.kind === "room")).toBe(true);
    shared().undo();
    expect(plaque().pieces.length).toBe(before);
  });
});

