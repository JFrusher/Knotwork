import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined }));

const { emptyKnotwork, migrate } = await import("@jfrusher/knotwork");
const { useKnotworkStore } = await import("@/lib/store/useKnotworkStore");
const { useStationery } = await import("./store");
const { initialSuite } = await import("./design");
const { artefactsOf } = await import("../core/data/parts");
const { printBasis } = await import("./printed");

/*
 * What was printed is a fact about paper, not an edit: undo does not take it
 * back, and a print is recorded on the piece it was made from.
 */
type Raw = Record<string, any>;
const stationery = () => useStationery.getState();
const shared = () => useKnotworkStore.getState();
const cards = () => artefactsOf(stationery().template, stationery().rows, stationery().headers, stationery().rowIds);
const basis = () => printBasis(stationery().template, stationery().room);

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
    stationery().setBackground("#ff0000");
    stationery().notePrinted(stationery().pieceId, cards(), false, basis());
    expect(stationery().printed).not.toBeNull();
    shared().undo();
    expect(stationery().template.backgroundHex).not.toBe("#ff0000");
    expect(stationery().printed).not.toBeNull();
    shared().redo();
    expect(stationery().printed).not.toBeNull();
  });

  test("a print finished after switching pieces is recorded on the piece it was printed from", () => {
    const from = stationery().pieceId;
    const printedCards = cards();
    stationery().addPiece("Other");
    stationery().notePrinted(from, printedCards, false, basis());
    expect(stationery().printed).toBeNull();
    stationery().switchPiece(from);
    expect(Object.keys(stationery().printed!.cards)).toHaveLength(2);
  });

  test("removing the open piece does not hand its chosen few to the next", () => {
    stationery().addPiece("Second");
    const second = stationery().pieceId;
    stationery().addPiece("Third");
    stationery().switchPiece(second);
    stationery().setPrintOnly([cards()[0]!.key]);
    stationery().removePiece(second);
    expect(stationery().pieceId).not.toBe(second);
    expect(stationery().printOnly).toBeNull();
  });

  test("a piece made from a starter design is one step: one undo takes it all back", () => {
    const before = stationery().pieces.length;
    stationery().openPiece("floor-plan");
    expect(stationery().pieces.length).toBe(before + 1);
    expect(stationery().template.elements.some((el) => el.kind === "room")).toBe(true);
    shared().undo();
    expect(stationery().pieces.length).toBe(before);
  });

  test("a copy of a printed piece has not been printed", () => {
    stationery().notePrinted(stationery().pieceId, cards(), false, basis());
    stationery().duplicatePiece(stationery().pieceId);
    expect(stationery().printed).toBeNull();
  });

  test("a print that finishes after its piece was removed is nothing to record, not an error", () => {
    stationery().addPiece("Gone soon");
    const gone = stationery().pieceId;
    const printedCards = cards();
    const before = basis();
    stationery().removePiece(gone);
    expect(() => stationery().notePrinted(gone, printedCards, false, before)).not.toThrow();
  });
});
