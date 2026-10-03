import { beforeEach, expect, test, vi } from "vitest";

const db = new Map<string, unknown>();
vi.mock("idb-keyval", () => ({
  get: async (key: string) => db.get(key),
  set: async (key: string, value: unknown) => void db.set(key, value),
  del: async (key: string) => void db.delete(key),
  keys: async () => [...db.keys()],
}));

const { STORAGE_KEY, flushPersist, selectGuestCount, useKnotworkStore } = await import(
  "./useKnotworkStore"
);
const { emptyKnotwork } = await import("@jfrusher/knotwork");

beforeEach(() => {
  db.clear();
  const doc = emptyKnotwork();
  useKnotworkStore.setState({
    status: "idle",
    error: null,
    savedAt: null,
    raw: doc as unknown as Record<string, unknown>,
    doc,
  });
});

test("an empty store hydrates to a fresh wedding", async () => {
  await useKnotworkStore.getState().hydrate();
  expect(useKnotworkStore.getState().status).toBe("ready");
  expect(selectGuestCount(useKnotworkStore.getState())).toBe(0);
});

test("a write to one slice leaves every other key byte-for-byte", async () => {
  // A slice belonging to a tool that does not exist yet. Losing it is the one
  // failure the whole envelope design exists to prevent.
  db.set(STORAGE_KEY, {
    ...emptyKnotwork(),
    guests: { g1: { id: "g1", name: "Charis" } },
    photobooth: { props: ["hat"] },
  });
  await useKnotworkStore.getState().hydrate();

  useKnotworkStore.getState().setSlice("guests", {
    g1: { id: "g1", name: "Charis" },
    g2: { id: "g2", name: "Alexander" },
  });
  await flushPersist();

  expect(selectGuestCount(useKnotworkStore.getState())).toBe(2);
  const stored = db.get(STORAGE_KEY) as Record<string, unknown>;
  expect(stored["photobooth"]).toEqual({ props: ["hat"] });
});

test("an unreadable document is refused, never overwritten", async () => {
  db.set(STORAGE_KEY, { kind: "knotwork", version: 1, event: { date: 42 } });
  await useKnotworkStore.getState().hydrate();

  expect(useKnotworkStore.getState().status).toBe("error");

  // A write while unreadable must not reach storage.
  useKnotworkStore.getState().setSlice("guests", { g1: { id: "g1" } });
  await new Promise((resolve) => setTimeout(resolve, 400));
  expect(db.get(STORAGE_KEY)).toEqual({
    kind: "knotwork",
    version: 1,
    event: { date: 42 },
  });
});

test("an edit starts its local write at once, not on a timer", async () => {
  await useKnotworkStore.getState().hydrate();

  // What a tool does from `beforeunload`: hand over its last edit and let the
  // page go. A write deferred to a timer never runs, because the page is gone
  // before the timer fires — which lost every Seating edit made in the
  // half-minute before a reload.
  useKnotworkStore.getState().setSlice("event", { coupleNames: "Charis & Jacob" });

  const stored = db.get(STORAGE_KEY) as Record<string, unknown> | undefined;
  expect(stored?.["event"]).toEqual({ coupleNames: "Charis & Jacob" });
});
