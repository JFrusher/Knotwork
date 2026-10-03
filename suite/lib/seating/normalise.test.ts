import { expect, test, vi } from "vitest";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined }));

const { useKnotworkStore } = await import("@/lib/store/useKnotworkStore");
const { emptyKnotwork, migrate } = await import("@jfrusher/knotwork");
const { reconcileLoadedDocument } = await import("./normalise");

/**
 * What an older version stored differently is converted once, as the wedding
 * loads — so the stored document says what every reader already sees.
 */
function load(raw: Record<string, unknown>) {
  useKnotworkStore.setState({
    status: "ready",
    error: null,
    raw,
    doc: migrate(raw),
    past: [],
    future: [],
  });
  reconcileLoadedDocument();
  return useKnotworkStore.getState().raw as Record<string, Record<string, unknown>>;
}

test("a seat the guest and the table disagree about is the table's", () => {
  const doc = emptyKnotwork();
  const table = (id: string, seated: string[]) => ({ id, label: id, type: "round", capacity: 8, x: 0, y: 0, rotation: 0, seatMode: "table", assignedGuestIds: seated });
  const raw = load({
    ...doc,
    guests: { g1: { id: "g1", firstName: "Ann", assignedTableId: "t2" }, g2: { id: "g2", firstName: "Bo", assignedTableId: "t1" } },
    seating: { ...(doc.seating as object), tables: { t1: table("t1", ["g1"]), t2: table("t2", []) } },
  });
  const guests = raw["guests"] as Record<string, { assignedTableId: string | null }>;
  expect(guests["g1"]!.assignedTableId).toBe("t1");
  expect(guests["g2"]!.assignedTableId).toBeNull();
});

test("a diet stored as the file's words is stored as its key", () => {
  const raw = load({ ...emptyKnotwork(), guests: { g1: { id: "g1", firstName: "Ann", dietary: "Vegetarian" } } });
  expect(raw["guests"]!["g1"]).toMatchObject({ dietary: "vegetarian", dietaryRaw: "Vegetarian" });
});

test("sides stored as bride and groom are stored as the partners'", () => {
  const raw = load({
    ...emptyKnotwork(),
    guests: { g1: { id: "g1", side: "bride" }, g2: { id: "g2", side: "groom" }, g3: { id: "g3", side: "both" } },
  });
  const guests = raw["guests"] as Record<string, { side: string }>;
  expect([guests["g1"]!.side, guests["g2"]!.side, guests["g3"]!.side]).toEqual(["a", "b", "both"]);
});

test("group-shot roles stored as bride and groom are stored as the partners'", () => {
  const raw = load({
    ...emptyKnotwork(),
    shots: {
      cast: { bride: ["g1"], "grooms-mother": ["g2"] },
      customRoles: [],
      sections: [{ id: "s", name: "Family", shots: [{ id: "x", label: "", notes: "", members: [{ kind: "role", ref: "groomsmen" }] }] }],
    },
  });
  const shots = raw["shots"] as { sections: Array<{ shots: Array<{ members: unknown[] }> }> };
  const cast = raw["cast"] as { roles: Record<string, string[]> };
  expect(cast.roles["a"]).toEqual(["g1"]);
  expect(cast.roles["b-mother"]).toEqual(["g2"]);
  expect(cast.roles["bride"]).toBeUndefined();
  expect(shots.sections[0]!.shots[0]!.members).toEqual([{ kind: "role", ref: "b-party" }]);
});

test("a cast kept inside the shots moves to a slice of its own, without an undo step", () => {
  const raw = load({
    ...emptyKnotwork(),
    shots: {
      cast: { "a-mother": ["g1"] },
      customRoles: [{ id: "crole-1", name: "Readers", guestIds: ["g2"] }],
      sections: [],
    },
  });
  expect(raw["cast"]).toMatchObject({
    roles: { "a-mother": ["g1"] },
    customRoles: [{ id: "crole-1", name: "Readers", guestIds: ["g2"] }],
  });
  expect(raw["shots"]).toEqual({ sections: [] });
  expect(useKnotworkStore.getState().past).toEqual([]);
});

test("a wedding titled with two names learns who the two partners are", () => {
  const doc = emptyKnotwork();
  const raw = load({ ...doc, event: { ...doc.event, coupleNames: "Alex & Sam" } });
  expect(raw["event"]!["partners"]).toEqual(["Alex", "Sam"]);
});

test("a title that does not name two people is left for the couple", () => {
  const doc = emptyKnotwork();
  const raw = load({ ...doc, event: { ...doc.event, coupleNames: "The Smiths" } });
  expect(raw["event"]!["partners"]).toEqual(["", ""]);
});

test("a wedding with nothing to convert is not written at all", () => {
  const doc = emptyKnotwork();
  const stored = {
    ...doc,
    event: { ...doc.event, coupleNames: "Alex & Sam", partners: ["Alex", "Sam"] },
    guests: { g1: { id: "g1", firstName: "Ann", dietary: "vegan", dietaryRaw: "", side: "a" } },
  };
  const raw = load(stored);
  expect(raw).toBe(stored);
});
