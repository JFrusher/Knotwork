import { beforeEach, expect, test, vi } from "vitest";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined }));

const { emptyKnotwork, migrate } = await import("@jfrusher/knotwork");
const { useKnotworkStore } = await import("@/lib/store/useKnotworkStore");
const { useStationery } = await import("./store");
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
const stationery = () => useStationery.getState();
const stored = () => (shared().raw as Raw).stationery as Raw;
/** The piece on screen, as the wedding holds it. */
const piece = () => (stored().pieces as Raw[]).find((p) => p.id === stationery().pieceId)!;

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
  stationery().setBackground("#fdfbf7");
  expect(piece().template.backgroundHex).toBe("#fdfbf7");
});

test("a change to the stationery from elsewhere is what the editor shows", () => {
  shared().setSlice(
    "stationery",
    { ...stored(), pieces: [{ ...piece(), template: { ...piece().template, backgroundHex: "#112233" } }] },
    { label: "a design from the library" },
  );
  expect(stationery().template.backgroundHex).toBe("#112233");
});

test("the header's undo takes a Place cards edit back, on the wedding's one history", () => {
  stationery().addElement("rect");
  expect(shared().past.at(-1)?.label).toBe("adding to the card");
  const count = piece().template.elements.length;

  shared().undo();
  expect(piece().template.elements.length).toBe(count - 1);
  expect(stationery().template.elements.length).toBe(count - 1);
});

test("undoing an unrelated edit keeps the row scope and every per-row tweak (S19)", () => {
  stationery().setRowScope({ kind: "per-group", byColumn: "Table" });
  const text = stationery().template.elements.find((element) => element.kind === "text")!;
  stationery().overrideForRow(stationery().rowIds[0]!, text.id, { x: 3 } as never);
  const { rowScope, overrides, elements } = stationery().template;

  stationery().addElement("rect");
  shared().undo();
  expect(stationery().template.elements).toEqual(elements);
  expect(stationery().template.rowScope).toEqual(rowScope);
  expect(stationery().template.overrides).toEqual(overrides);
});

test("a drag is one step back, however many frames it took", () => {
  stationery().addElement("rect");
  const rect = stationery().template.elements.at(-1)!;
  const depth = shared().past.length;
  for (let x = 0; x < 30; x++) stationery().setElementBox(rect.id, { x, y: 5, w: 10, h: 10 });
  expect(shared().past.length).toBe(depth + 1);

  shared().undo();
  expect(stationery().template.elements.find((element) => element.id === rect.id)?.x).toBe(rect.x);
});

test("a selected element undone out of existence is no longer selected", () => {
  stationery().addElement("rect");
  expect(stationery().selectedId).not.toBeNull();
  shared().undo();
  expect(stationery().selectedId).toBeNull();
});

test("a design the wedding holds that cannot be read is said so, and the next edit starts fresh", () => {
  shared().setSlice(
    "stationery",
    { ...stored(), pieces: [{ ...piece(), card: { ...piece().card, widthMm: "85" } }] },
    { silent: true },
  );
  expect(stationery().designProblem).toMatch(/widthMm.*Starting fresh/);

  stationery().setBackground("#fdfbf7");
  expect(stationery().designProblem).toBeNull();
  expect(piece().card.widthMm).toBe(85);
});

test("a new piece opens empty, and editing it leaves the place cards as they were", () => {
  const placeCards = stationery().template;
  stationery().addPiece("Table numbers");
  expect(stationery().pieces.map((p) => p.name)).toEqual(["Place cards", "Table numbers"]);
  expect(stationery().template.elements).toEqual([]);

  stationery().setBackground("#223344");
  expect(piece().name).toBe("Table numbers");
  stationery().switchPiece("place-cards");
  expect(stationery().template).toEqual(placeCards);
});

test("pieces share their uploaded assets' names", () => {
  stationery().noteAssetName("user:mono", "Monogram.png");
  stationery().addPiece("Menus");
  expect(stationery().assetNames["user:mono"]).toBe("Monogram.png");
  expect(stored().assetNames).toEqual({ "user:mono": "Monogram.png" });
});

test("a copied piece keeps the design and who shares a card, under its own name", () => {
  stationery().combineRows([0, 1]);
  const template = stationery().template;
  stationery().duplicatePiece("place-cards");
  expect(stationery().pieces.map((p) => p.name)).toEqual(["Place cards", "Place cards (copy)"]);
  expect(stationery().template).toEqual(template);
  expect(stationery().rows.map((row) => row["Name"])).toEqual(["Charis Smith & Eleanor Vane"]);
  expect(stationery().pieceId).not.toBe("place-cards");
});

test("undoing a new piece takes it away and shows the first", () => {
  stationery().addPiece("Escort cards");
  shared().undo();
  expect(stationery().pieces.map((p) => p.name)).toEqual(["Place cards"]);
  expect(stationery().pieceId).toBe("place-cards");
});

test("removing the piece on screen shows its neighbour, and the last piece cannot go", () => {
  stationery().addPiece("Board");
  stationery().removePiece(stationery().pieceId);
  expect(stationery().pieces.map((p) => p.name)).toEqual(["Place cards"]);
  expect(stationery().pieceId).toBe("place-cards");
  expect(() => stationery().removePiece("place-cards")).toThrow(/last piece/);
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
  expect(stationery().pieces).toEqual([{ id: "place-cards", name: "Place cards" }]);
  expect(stationery().rows.map((row) => row["Table"])).toEqual(["Table 1", "Table 2"]);
  expect(stationery().template.overrides).toEqual({ g2: { [name]: { fontSizePt: 11 } } });

  stationery().setBackground("#fdfbf7");
  expect(stored().version).toBe(3);
  expect(piece()).not.toHaveProperty("rows");
  expect(piece().template.overrides).toEqual({ g2: { [name]: { fontSizePt: 11 } } });
});

test("a guest seated in the room is on the card at once, on any piece", () => {
  stationery().addPiece("Escort cards");
  const seating = { tables: { ...TABLES, t2: { ...TABLES.t2, label: "Top table" } } };
  shared().setSlice("seating", seating, { label: "the room" });
  expect(stationery().rows.map((row) => row["Table"])).toEqual(["Table 1", "Top table"]);
});

test("asked for a piece by its design, makes it once from the gallery, and opens it after that", () => {
  stationery().openPiece("floor-plan");
  expect(stationery().pieces.map((p) => p.name)).toEqual(["Place cards", "Floor plan"]);
  expect(stationery().pieceId).toBe("floor-plan");
  expect(stationery().template.elements.some((el) => el.kind === "room")).toBe(true);
  expect(stationery().sheet.page).toBe("FIT");

  stationery().switchPiece("place-cards");
  stationery().openPiece("floor-plan");
  expect(stationery().pieces).toHaveLength(2);
  expect(stationery().pieceId).toBe("floor-plan");
  expect(() => stationery().openPiece("nonsense")).toThrow(/No piece or design/);
});
