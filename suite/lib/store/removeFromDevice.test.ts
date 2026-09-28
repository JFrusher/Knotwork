import { expect, test, vi } from "vitest";

const idb = new Map<string, unknown>();
vi.mock("idb-keyval", () => ({
  keys: async () => [...idb.keys()],
  del: async (key: string) => void idb.delete(key),
}));

const { removeWeddingFromDevice } = await import("./removeFromDevice");

test("removes the wedding and everything it left, and keeps the printer's calibration", async () => {
  for (const key of [
    "trousseau.document",
    "trousseau.cloud.link",
    "trousseau.copies",
    "trousseau.blob.font-1",
    "plaque.images",
    "plaque.printers",
    "plaque.printer.active",
  ]) {
    idb.set(key, {});
  }
  await removeWeddingFromDevice();
  expect([...idb.keys()]).toEqual(["plaque.printers", "plaque.printer.active"]);
});
