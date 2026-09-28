import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => undefined }));

const { useTrousseauStore } = await import("@/lib/store/useTrousseauStore");
const { HOLDS } = await import("@/lib/store/toolGeneration");
const { WhenDocumentReady } = await import("./WhenDocumentReady");

afterEach(() => {
  // No global afterEach in the "suite" project, so Testing Library does not
  // unmount by itself — see StoreHydrator.test.tsx.
  cleanup();
});

/**
 * The gate is what tells the store a tool is open and what it copied, so a
 * write from anywhere else can send that tool back to re-read.
 */
test("declares what the tool holds while it is open, and nothing once it closes", () => {
  const { unmount } = render(
    <WhenDocumentReady tool="tableaux">
      <p>Seating</p>
    </WhenDocumentReady>,
  );
  expect(useTrousseauStore.getState().held["tableaux"]).toEqual(HOLDS.tableaux);

  unmount();
  expect(useTrousseauStore.getState().held["tableaux"]).toBeUndefined();
});
