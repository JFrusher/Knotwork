import { beforeEach, expect, test, vi } from "vitest";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined }));

const { emptyKnotwork, migrate } = await import("@jfrusher/knotwork");
const { useKnotworkStore } = await import("@/lib/store/useKnotworkStore");
const { usePlaque } = await import("./store");

/*
 * Place cards hold no copy of the wedding: the design is the stationery
 * slice, every edit lands there at once on the one history, and a change to
 * it from anywhere is what the editor shows.
 */
type Raw = Record<string, any>;
const HEADERS = ["First Name", "Last Name", "Table", "Dietary"];
const ROWS = [
  { "First Name": "Charis", "Last Name": "Smith", Table: "Table 1", Dietary: "Vegetarian" },
  { "First Name": "Eleanor", "Last Name": "Vane", Table: "Table 2", Dietary: "Vegan" },
];

const shared = () => useKnotworkStore.getState();
const plaque = () => usePlaque.getState();
const stored = () => (shared().raw as Raw).stationery as Raw;
/** The piece on screen, as the wedding holds it. */
const piece = () => (stored().pieces as Raw[]).find((p) => p.id === plaque().pieceId)!;

beforeEach(() => {
  const raw = emptyKnotwork() as unknown as Raw;
  useKnotworkStore.setState({ status: "ready", raw, doc: migrate(raw), past: [], future: [] });
  plaque().setCsv({ headers: HEADERS, rows: ROWS, issues: [], fileName: "guests.csv" });
});

test("an edit is in the wedding the moment it is made", () => {
  plaque().setBackground("#fdfbf7");
  expect(piece().template.backgroundHex).toBe("#fdfbf7");
});

test("a change to the stationery from elsewhere is what the editor shows", () => {
  shared().setSlice(
    "stationery",
    { ...stored(), pieces: [{ ...piece(), template: { ...piece().template, backgroundHex: "#112233" } }] },
    { label: "a design from the library" },
  );
  expect(plaque().template.backgroundHex).toBe("#112233");
});

test("the header's undo takes a Place cards edit back, on the wedding's one history", () => {
  plaque().addElement("rect");
  expect(shared().past.at(-1)?.label).toBe("adding to the card");
  const count = piece().template.elements.length;

  shared().undo();
  expect(piece().template.elements.length).toBe(count - 1);
  expect(plaque().template.elements.length).toBe(count - 1);
});

test("undoing an unrelated edit keeps the row scope and every per-row tweak (S19)", () => {
  plaque().setRowScope({ kind: "per-group", byColumn: "Table" });
  const text = plaque().template.elements.find((element) => element.kind === "text")!;
  plaque().overrideForRow(plaque().rowIds[0]!, text.id, { x: 3 } as never);
  const { rowScope, overrides, elements } = plaque().template;

  plaque().addElement("rect");
  shared().undo();
  expect(plaque().template.elements).toEqual(elements);
  expect(plaque().template.rowScope).toEqual(rowScope);
  expect(plaque().template.overrides).toEqual(overrides);
});

test("a drag is one step back, however many frames it took", () => {
  plaque().addElement("rect");
  const rect = plaque().template.elements.at(-1)!;
  const depth = shared().past.length;
  for (let x = 0; x < 30; x++) plaque().setElementBox(rect.id, { x, y: 5, w: 10, h: 10 });
  expect(shared().past.length).toBe(depth + 1);

  shared().undo();
  expect(plaque().template.elements.find((element) => element.id === rect.id)?.x).toBe(rect.x);
});

test("a selected element undone out of existence is no longer selected", () => {
  plaque().addElement("rect");
  expect(plaque().selectedId).not.toBeNull();
  shared().undo();
  expect(plaque().selectedId).toBeNull();
});

test("a design the wedding holds that cannot be read is said so, and the next edit starts fresh", () => {
  shared().setSlice(
    "stationery",
    { ...stored(), pieces: [{ ...piece(), card: { ...piece().card, widthMm: "85" } }] },
    { silent: true },
  );
  expect(plaque().designProblem).toMatch(/widthMm.*Starting fresh/);

  plaque().setBackground("#fdfbf7");
  expect(plaque().designProblem).toBeNull();
  expect(piece().card.widthMm).toBe(85);
});

test("a new piece opens empty, and editing it leaves the place cards as they were", () => {
  const placeCards = plaque().template;
  plaque().addPiece("Table numbers");
  expect(plaque().pieces.map((p) => p.name)).toEqual(["Place cards", "Table numbers"]);
  expect(plaque().template.elements).toEqual([]);

  plaque().setBackground("#223344");
  expect(piece().name).toBe("Table numbers");
  plaque().switchPiece("place-cards");
  expect(plaque().template).toEqual(placeCards);
});

test("pieces share their uploaded assets' names", () => {
  plaque().noteAssetName("user:mono", "Monogram.png");
  plaque().addPiece("Menus");
  expect(plaque().assetNames["user:mono"]).toBe("Monogram.png");
  expect(stored().assetNames).toEqual({ "user:mono": "Monogram.png" });
});

test("a copied piece keeps the design and the list, under its own name", () => {
  plaque().duplicatePiece("place-cards");
  expect(plaque().pieces.map((p) => p.name)).toEqual(["Place cards", "Place cards (copy)"]);
  expect(plaque().rows).toEqual(ROWS);
  expect(plaque().pieceId).not.toBe("place-cards");
});

test("undoing a new piece takes it away and shows the first", () => {
  plaque().addPiece("Escort cards");
  shared().undo();
  expect(plaque().pieces.map((p) => p.name)).toEqual(["Place cards"]);
  expect(plaque().pieceId).toBe("place-cards");
});

test("removing the piece on screen shows its neighbour, and the last piece cannot go", () => {
  plaque().addPiece("Board");
  plaque().removePiece(plaque().pieceId);
  expect(plaque().pieces.map((p) => p.name)).toEqual(["Place cards"]);
  expect(plaque().pieceId).toBe("place-cards");
  expect(() => plaque().removePiece("place-cards")).toThrow(/last piece/);
});

test("a wedding saved with one design opens it as its place cards, and the next edit keeps it", () => {
  const { pieces, ...sharedParts } = stored();
  const [{ id: _id, name: _name, ...flat }] = pieces as Raw[];
  shared().setSlice("stationery", { ...sharedParts, ...flat, version: 2 }, { silent: true });
  expect(plaque().pieces).toEqual([{ id: "place-cards", name: "Place cards" }]);
  expect(plaque().rows).toEqual(ROWS);

  plaque().setBackground("#fdfbf7");
  expect(stored().version).toBe(3);
  expect(piece().rows).toEqual(ROWS);
});
