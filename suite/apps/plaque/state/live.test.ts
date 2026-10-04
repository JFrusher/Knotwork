import { beforeEach, expect, test, vi } from "vitest";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined }));

const { emptyKnotwork, migrate } = await import("@jfrusher/knotwork");
const { useKnotworkStore } = await import("@/lib/store/useKnotworkStore");
const { usePlaque } = await import("./store");
const { initialSuite } = await import("./design");

/*
 * Place cards hold no copy of the wedding: the design is the stationery
 * slice, every edit lands there at once on the one history, and a change to
 * it from anywhere is what the editor shows.
 */
type Raw = Record<string, any>;
const GUESTS = {
  g1: { id: "g1", firstName: "Charis", lastName: "Smith", assignedTableId: "t1" },
  g2: { id: "g2", firstName: "Eleanor", lastName: "Vane", assignedTableId: "t2" },
};
const TABLES = {
  t1: { id: "t1", label: "Table 1", assignedGuestIds: ["g1"] },
  t2: { id: "t2", label: "Table 2", assignedGuestIds: ["g2"] },
};

const shared = () => useKnotworkStore.getState();
const plaque = () => usePlaque.getState();
const stored = () => (shared().raw as Raw).stationery as Raw;
/** The piece on screen, as the wedding holds it. */
const piece = () => (stored().pieces as Raw[]).find((p) => p.id === plaque().pieceId)!;

beforeEach(() => {
  // A wedding with two guests seated, and Place cards already saved once.
  const raw = {
    ...(emptyKnotwork() as unknown as Raw),
    guests: GUESTS,
    seating: { tables: TABLES },
    stationery: { version: 3, savedAt: null, ...initialSuite() },
  };
  useKnotworkStore.setState({ status: "ready", raw, doc: migrate(raw), past: [], future: [] });
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

test("a copied piece keeps the design and who shares a card, under its own name", () => {
  plaque().combineRows([0, 1]);
  const template = plaque().template;
  plaque().duplicatePiece("place-cards");
  expect(plaque().pieces.map((p) => p.name)).toEqual(["Place cards", "Place cards (copy)"]);
  expect(plaque().template).toEqual(template);
  expect(plaque().rows.map((row) => row["Name"])).toEqual(["Charis Smith & Eleanor Vane"]);
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

test("a wedding saved with one design and a copy of the list opens from the room, keeping each guest's own change", () => {
  const { pieces, ...sharedParts } = stored();
  const [{ id: _id, name: _name, merged: _merged, template, ...flat }] = pieces as Raw[];
  const name = template.elements.find((el: Raw) => el.kind === "text").id;
  // Version 2 kept the rows themselves — here, Eleanor still on the table she
  // has since left — and keyed a tweak to her by her position in them.
  shared().setSlice(
    "stationery",
    {
      ...sharedParts,
      ...flat,
      version: 2,
      template: { ...template, overrides: { r1: { [name]: { fontSizePt: 11 } } } },
      headers: ["First Name", "Last Name", "Name", "Table"],
      rows: [
        { "First Name": "Charis", "Last Name": "Smith", Name: "Charis Smith", Table: "Table 1" },
        { "First Name": "Eleanor", "Last Name": "Vane", Name: "Eleanor Vane", Table: "Table 9" },
      ],
      rowIds: ["r0", "r1"],
      fileName: "the room",
    },
    { silent: true },
  );
  expect(plaque().pieces).toEqual([{ id: "place-cards", name: "Place cards" }]);
  expect(plaque().rows.map((row) => row["Table"])).toEqual(["Table 1", "Table 2"]);
  expect(plaque().template.overrides).toEqual({ g2: { [name]: { fontSizePt: 11 } } });

  plaque().setBackground("#fdfbf7");
  expect(stored().version).toBe(3);
  expect(piece()).not.toHaveProperty("rows");
  expect(piece().template.overrides).toEqual({ g2: { [name]: { fontSizePt: 11 } } });
});

test("a guest seated in the room is on the card at once, on any piece", () => {
  plaque().addPiece("Escort cards");
  const seating = { tables: { ...TABLES, t2: { ...TABLES.t2, label: "Top table" } } };
  shared().setSlice("seating", seating, { label: "the room" });
  expect(plaque().rows.map((row) => row["Table"])).toEqual(["Table 1", "Top table"]);
});
