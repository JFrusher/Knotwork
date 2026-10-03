import { beforeEach, expect, test, vi } from "vitest";

const db = new Map<string, unknown>();
vi.mock("idb-keyval", () => ({
  get: async (key: string) => db.get(key),
  set: async (key: string, value: unknown) => void db.set(key, value),
  del: async (key: string) => void db.delete(key),
  keys: async () => [...db.keys()],
}));

const { migrateLegacyKeys } = await import("./migrateKeys");

beforeEach(() => {
  db.clear();
  localStorage.clear();
});

test("everything stored while it was called Trousseau comes across", async () => {
  db.set("trousseau.document", { guests: { g1: {} } });
  db.set("trousseau.blob.abc123", new Uint8Array([1]));
  db.set("trousseau.copies", [{ id: "c1" }]);
  db.set("trousseau.cloud.link", { weddingId: "w1" });
  db.set("trousseau.wedding.w1", { kept: true });

  await migrateLegacyKeys();

  expect(db.get("knotwork.document")).toEqual({ guests: { g1: {} } });
  expect(db.get("knotwork.blob.abc123")).toEqual(new Uint8Array([1]));
  expect(db.get("knotwork.copies")).toEqual([{ id: "c1" }]);
  expect(db.get("knotwork.cloud.link")).toEqual({ weddingId: "w1" });
  expect(db.get("knotwork.wedding.w1")).toEqual({ kept: true });
  expect([...db.keys()].some((k) => k.startsWith("trousseau."))).toBe(false);
});

test("the tour and binder flags in localStorage come across", async () => {
  localStorage.setItem("trousseau.tour.seen", "1");
  localStorage.setItem("trousseau.binder.taken.w1", "[\"a\"]");

  await migrateLegacyKeys();

  expect(localStorage.getItem("knotwork.tour.seen")).toBe("1");
  expect(localStorage.getItem("knotwork.binder.taken.w1")).toBe("[\"a\"]");
  expect(localStorage.getItem("trousseau.tour.seen")).toBeNull();
});

test("a wedding stored under the old name is moved, not lost", async () => {
  db.set("tableaux.suite.document", { guests: { g1: {} } });

  await migrateLegacyKeys();

  expect(db.get("knotwork.document")).toEqual({ guests: { g1: {} } });
  expect(db.has("tableaux.suite.document")).toBe(false);
});

test("uploaded fonts and artwork come across too", async () => {
  db.set("tableaux.suite.blob.abc123", new Uint8Array([1, 2, 3]));
  db.set("tableaux.suite.blob.def456", new Uint8Array([4]));

  await migrateLegacyKeys();

  expect(db.get("knotwork.blob.abc123")).toEqual(new Uint8Array([1, 2, 3]));
  expect(db.get("knotwork.blob.def456")).toEqual(new Uint8Array([4]));
  expect([...db.keys()].some((k) => k.startsWith("tableaux."))).toBe(false);
});

test("a device that has already migrated is left alone", async () => {
  db.set("knotwork.document", { current: true });
  db.set("tableaux.suite.document", { stale: true });

  await migrateLegacyKeys();

  // The new key is the truth; the stale copy must not overwrite it.
  expect(db.get("knotwork.document")).toEqual({ current: true });
});

test("nothing to move is not an error", async () => {
  await expect(migrateLegacyKeys()).resolves.toEqual({ moved: [] });
});

test("keys belonging to anything else are untouched", async () => {
  db.set("something.else", { keep: true });
  await migrateLegacyKeys();
  expect(db.get("something.else")).toEqual({ keep: true });
});

test("a migration that fails does not stop the document loading", async () => {
  // Housekeeping must never brick the app. A store whose `keys()` throws — an
  // old browser, a locked database — should still open the wedding under the
  // current key.
  vi.resetModules();
  vi.doMock("idb-keyval", () => ({
    get: async (key: string) => (key === "knotwork.document" ? { guests: {} } : undefined),
    set: async () => undefined,
    del: async () => undefined,
    keys: async () => {
      throw new Error("this browser will not enumerate keys");
    },
  }));

  const { useKnotworkStore } = await import("./useKnotworkStore");
  await useKnotworkStore.getState().hydrate();

  expect(useKnotworkStore.getState().status).toBe("ready");
  expect(useKnotworkStore.getState().error).toBeNull();
  vi.doUnmock("idb-keyval");
});
