import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => undefined }));

const { useKnotworkStore } = await import("@/lib/store/useKnotworkStore");
const { WhenDocumentReady } = await import("./WhenDocumentReady");

afterEach(() => {
  // No global afterEach in the "suite" project, so Testing Library does not
  // unmount by itself — see StoreHydrator.test.tsx.
  cleanup();
});

const gate = () =>
  render(
    <WhenDocumentReady>
      <p>Seating</p>
    </WhenDocumentReady>,
  );

test("shows nothing until the stored wedding has been read, then the tool", () => {
  useKnotworkStore.setState({ status: "loading", error: null });
  gate();
  expect(screen.queryByText("Seating")).toBeNull();

  act(() => useKnotworkStore.setState({ status: "ready" }));
  expect(screen.getByText("Seating")).toBeTruthy();
});

test("says so when the stored wedding cannot be read, and shows no tool to act on it", () => {
  useKnotworkStore.setState({ status: "error", error: "The saved wedding could not be read: bad bytes" });
  gate();
  expect(screen.getByRole("alert").textContent).toMatch(/bad bytes/);
  expect(screen.queryByText("Seating")).toBeNull();
});
