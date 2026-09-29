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

test("removes which of the wedding's photos the Binder has ticked off, and keeps that this device has seen the tour", async () => {
  localStorage.setItem("trousseau.binder.taken.w1", '["shot-1"]');
  localStorage.setItem("trousseau.binder.taken.this-device", '["shot-2"]');
  localStorage.setItem("trousseau.tour.seen", "1");
  await removeWeddingFromDevice();
  expect(Object.keys(localStorage)).toEqual(["trousseau.tour.seen"]);
});
