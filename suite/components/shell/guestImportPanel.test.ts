import { expect, test, vi } from "vitest";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined }));

const { liveWedding, useGuestImport } = await import("./guestImportPanel");

/*
 * `show` is handed straight to `onClick` in Seating and the Data panel, so it
 * is called with the click event. When it took an optional target, the event
 * became the target and the importer never opened — a mistake TypeScript
 * accepts, since a function with an optional parameter fits `() => void`.
 */
test("opening the importer from a click imports into the wedding, whatever the click passes", () => {
  (useGuestImport.getState().show as (event: unknown) => void)(new MouseEvent("click"));
  expect(useGuestImport.getState()).toMatchObject({ open: true, target: liveWedding });
});

test("setup opens it into its own draft", () => {
  const draft = { read: () => ({ event: {} as never, guests: {}, seating: {} }), commit: () => undefined };
  useGuestImport.getState().showInto(draft);
  expect(useGuestImport.getState().target).toBe(draft);
});
