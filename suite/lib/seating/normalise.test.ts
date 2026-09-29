import { expect, test, vi } from "vitest";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined }));

const { useTrousseauStore } = await import("@/lib/store/useTrousseauStore");
const { emptyTrousseau, migrate } = await import("@jfrusher/trousseau");
const { reconcileLoadedDocument } = await import("./normalise");

/**
 * What an older version stored differently is converted once, as the wedding
 * loads — so the stored document says what every reader already sees.
 */
function load(raw: Record<string, unknown>) {
  useTrousseauStore.setState({
    status: "ready",
    error: null,
    raw,
    doc: migrate(raw),
    past: [],
    future: [],
  });
  reconcileLoadedDocument();
  return useTrousseauStore.getState().raw as Record<string, Record<string, unknown>>;
}

test("a diet stored as the file's words is stored as its key", () => {
  const raw = load({ ...emptyTrousseau(), guests: { g1: { id: "g1", firstName: "Ann", dietary: "Vegetarian" } } });
  expect(raw["guests"]!["g1"]).toMatchObject({ dietary: "vegetarian", dietaryRaw: "Vegetarian" });
});

test("sides stored as bride and groom are stored as the partners'", () => {
  const raw = load({
    ...emptyTrousseau(),
    guests: { g1: { id: "g1", side: "bride" }, g2: { id: "g2", side: "groom" }, g3: { id: "g3", side: "both" } },
  });
  const guests = raw["guests"] as Record<string, { side: string }>;
  expect([guests["g1"]!.side, guests["g2"]!.side, guests["g3"]!.side]).toEqual(["a", "b", "both"]);
});

test("group-shot roles stored as bride and groom are stored as the partners'", () => {
  const raw = load({
    ...emptyTrousseau(),
    shots: {
      cast: { bride: ["g1"], "grooms-mother": ["g2"] },
      customRoles: [],
      sections: [{ id: "s", name: "Family", shots: [{ id: "x", label: "", notes: "", members: [{ kind: "role", ref: "groomsmen" }] }] }],
    },
  });
  const shots = raw["shots"] as { cast: Record<string, string[]>; sections: Array<{ shots: Array<{ members: unknown[] }> }> };
  expect(shots.cast["a"]).toEqual(["g1"]);
  expect(shots.cast["b-mother"]).toEqual(["g2"]);
  expect(shots.cast["bride"]).toBeUndefined();
  expect(shots.sections[0]!.shots[0]!.members).toEqual([{ kind: "role", ref: "b-party" }]);
});

test("a wedding titled with two names learns who the two partners are", () => {
  const doc = emptyTrousseau();
  const raw = load({ ...doc, event: { ...doc.event, coupleNames: "Alex & Sam" } });
  expect(raw["event"]!["partners"]).toEqual(["Alex", "Sam"]);
});

test("a title that does not name two people is left for the couple", () => {
  const doc = emptyTrousseau();
  const raw = load({ ...doc, event: { ...doc.event, coupleNames: "The Smiths" } });
  expect(raw["event"]!["partners"]).toEqual(["", ""]);
});

test("a wedding with nothing to convert is not written at all", () => {
  const doc = emptyTrousseau();
  const stored = {
    ...doc,
    event: { ...doc.event, coupleNames: "Alex & Sam", partners: ["Alex", "Sam"] },
    guests: { g1: { id: "g1", firstName: "Ann", dietary: "vegan", dietaryRaw: "", side: "a" } },
  };
  const raw = load(stored);
  expect(raw).toBe(stored);
});
