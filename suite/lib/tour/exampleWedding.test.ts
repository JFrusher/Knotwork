import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.mock("idb-keyval", () => ({
  get: async () => undefined,
  set: async () => undefined,
  del: async () => undefined,
}));

const { useKnotworkStore } = await import("@/lib/store/useKnotworkStore");
const { isExampleWedding, isWeddingEmpty, loadExampleWedding, startYourOwnWedding } = await import("./exampleWedding");
const { emptyKnotwork } = await import("@jfrusher/knotwork");
const { useCopies } = await import("@/lib/store/copies");

const example = { event: { coupleNames: "Alex & Sam" }, guests: { g1: { id: "g1" } } };

beforeEach(() => {
  const doc = emptyKnotwork();
  useKnotworkStore.setState({
    status: "ready",
    error: null,
    raw: doc as unknown as Record<string, unknown>,
    doc,
    past: [],
    future: [],
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => example })) as unknown as typeof fetch,
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("an untouched wedding is empty, and loads without asking anything", async () => {
  const confirmed = vi.fn(async () => false);

  expect(isWeddingEmpty()).toBe(true);
  await expect(loadExampleWedding(confirmed)).resolves.toBe("loaded");
  // Nothing to lose, so nothing to ask about.
  expect(confirmed).not.toHaveBeenCalled();
});

test("a wedding with guests in it is never replaced without a yes", async () => {
  const doc = { ...emptyKnotwork(), guests: { a: { id: "a" } } };
  useKnotworkStore.setState({ raw: doc as unknown as Record<string, unknown>, doc });
  expect(isWeddingEmpty()).toBe(false);
  await expect(loadExampleWedding(async () => false)).resolves.toBe("cancelled");
  // The refusal has to leave the document exactly as it was.
  expect(Object.keys(useKnotworkStore.getState().doc.guests)).toEqual(["a"]);
});

test("a wedding with only group shots planned is never replaced without a yes", async () => {
  const empty = emptyKnotwork();
  const doc = {
    ...empty,
    shots: { ...empty.shots, sections: [{ id: "s", name: "Family", shots: [{ id: "x", label: "Everyone", members: [], notes: "" }] }] },
  };
  useKnotworkStore.setState({ raw: doc as unknown as Record<string, unknown>, doc });
  const confirmed = vi.fn(async () => false);
  await expect(loadExampleWedding(confirmed)).resolves.toBe("cancelled");
  expect(confirmed).toHaveBeenCalled();
});

test("saying yes replaces it, without becoming an undo step", async () => {
  const doc = { ...emptyKnotwork(), guests: { a: { id: "a" } } };
  useKnotworkStore.setState({ raw: doc as unknown as Record<string, unknown>, doc, past: [] });
  await expect(loadExampleWedding(async () => true)).resolves.toBe("loaded");
  expect(useKnotworkStore.getState().doc.event.coupleNames).toBe("Alex & Sam");
  // Silent: offering to undo would offer to restore what the user was just
  // warned they were replacing.
  expect(useKnotworkStore.getState().past).toEqual([]);
  // What it replaced is kept, to put back from Data.
  expect(useCopies.getState().copies.map((copy) => Object.keys(copy.document["guests"] as object))).toEqual([["a"]]);
});

test("the example is marked as the example, and the mark survives an edit", async () => {
  await loadExampleWedding(async () => true);
  expect(isExampleWedding(useKnotworkStore.getState().raw)).toBe(true);

  useKnotworkStore.getState().setSlice("guests", { g2: { id: "g2" } });
  expect(isExampleWedding(useKnotworkStore.getState().raw)).toBe(true);
});

test("starting your own leaves an empty wedding, keeps the example, and can be undone", async () => {
  const keep = vi.spyOn(useCopies.getState(), "keep").mockResolvedValue();
  await loadExampleWedding(async () => true);

  await startYourOwnWedding();

  const { raw } = useKnotworkStore.getState();
  expect(isExampleWedding(raw)).toBe(false);
  expect(isWeddingEmpty()).toBe(true);
  expect(keep).toHaveBeenCalledWith(expect.objectContaining({ exampleWedding: true }), expect.any(String));

  useKnotworkStore.getState().undo();
  expect(isExampleWedding(useKnotworkStore.getState().raw)).toBe(true);
});
