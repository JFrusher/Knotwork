import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => undefined }));
vi.mock("@/lib/seating/normalise", () => ({ reconcileLoadedDocument: async () => {} }));

const { useTrousseauStore } = await import("./useTrousseauStore");
const { StoreHydrator } = await import("./StoreHydrator");

beforeEach(() => {
  vi.useFakeTimers();
  useTrousseauStore.setState({
    status: "idle",
    hydrate: vi.fn(async () => {
      useTrousseauStore.setState({ status: "ready" });
    }),
    startCloudSync: vi.fn(async () => {
      useTrousseauStore.setState({ cloudStatus: "idle" });
    }),
    pullFromCloud: vi.fn(async () => {}),
  });
});

afterEach(() => {
  // The "suite" vitest project has no global afterEach, so Testing Library
  // does not auto-unmount between tests here (unlike "tableaux", which opts
  // into that via `globals: true`). Without this, the previous test's
  // visibilitychange listener stays live and double-counts.
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// The account's copy is followed live (LiveWedding), not polled.
test("does not poll the account while the tab is open", async () => {
  render(<StoreHydrator />);
  // flush the hydrate().then(...).then(startCloudSync) chain
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();

  await vi.advanceTimersByTimeAsync(120_000);
  expect(useTrousseauStore.getState().pullFromCloud).not.toHaveBeenCalled();
});

test("pulls when the tab becomes visible again", async () => {
  render(<StoreHydrator />);
  // flush the hydrate().then(...).then(startCloudSync) chain
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();

  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));

  expect(useTrousseauStore.getState().pullFromCloud).toHaveBeenCalledTimes(1);
});

test("does not pull on visibilitychange while the tab is hidden", async () => {
  render(<StoreHydrator />);
  // flush the hydrate().then(...).then(startCloudSync) chain
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();

  Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));

  expect(useTrousseauStore.getState().pullFromCloud).not.toHaveBeenCalled();
});
