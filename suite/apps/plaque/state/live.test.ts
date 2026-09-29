import { beforeEach, expect, test, vi } from "vitest";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined }));

const { emptyTrousseau, migrate } = await import("@jfrusher/trousseau");
const { useTrousseauStore } = await import("@/lib/store/useTrousseauStore");
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

const shared = () => useTrousseauStore.getState();
const plaque = () => usePlaque.getState();
const stored = () => (shared().raw as Raw).stationery as Raw;

beforeEach(() => {
  const raw = emptyTrousseau() as unknown as Raw;
  useTrousseauStore.setState({ status: "ready", raw, doc: migrate(raw), past: [], future: [] });
  plaque().setCsv({ headers: HEADERS, rows: ROWS, issues: [], fileName: "guests.csv" });
});

test("an edit is in the wedding the moment it is made", () => {
  plaque().setBackground("#fdfbf7");
  expect(stored().template.backgroundHex).toBe("#fdfbf7");
});

test("a change to the stationery from elsewhere is what the editor shows", () => {
  shared().setSlice("stationery", { ...stored(), template: { ...stored().template, backgroundHex: "#112233" } }, { label: "a design from the library" });
  expect(plaque().template.backgroundHex).toBe("#112233");
});

test("the header's undo takes a Place cards edit back, on the wedding's one history", () => {
  plaque().addElement("rect");
  expect(shared().past.at(-1)?.label).toBe("adding to the card");
  const count = stored().template.elements.length;

  shared().undo();
  expect(stored().template.elements.length).toBe(count - 1);
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
  shared().setSlice("stationery", { ...stored(), card: { ...stored().card, widthMm: "85" } }, { silent: true });
  expect(plaque().designProblem).toMatch(/widthMm.*Starting fresh/);

  plaque().setBackground("#fdfbf7");
  expect(plaque().designProblem).toBeNull();
  expect(stored().card.widthMm).toBe(85);
});
