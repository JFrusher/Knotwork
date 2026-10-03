import { beforeEach, expect, test, vi } from "vitest";

const db = new Map<string, unknown>();
vi.mock("idb-keyval", () => ({
  get: async (key: string) => db.get(key),
  set: async (key: string, value: unknown) => void db.set(key, value),
  del: async (key: string) => void db.delete(key),
  keys: async () => [...db.keys()],
}));

const { openWedding } = await import("./openWedding");

beforeEach(() => {
  db.clear();
  localStorage.clear();
});

const linkTo = (weddingId: string) => ({ weddingId, version: 3, agreed: {} });

test("opened straight after the rename, the wedding being left is put aside, not mistaken for the one opened", async () => {
  // A device last used before the rename: wedding A, under the old keys.
  db.set("trousseau.document", { event: { coupleNames: "A" } });
  db.set("trousseau.cloud.link", linkTo("A"));

  await openWedding("B");

  expect(db.get("knotwork.wedding.A")).toEqual({ document: { event: { coupleNames: "A" } }, link: linkTo("A") });
  expect(db.has("knotwork.document")).toBe(false);
  expect(db.has("knotwork.cloud.link")).toBe(false);
  expect(db.get("knotwork.cloud.open")).toBe("B");
});
