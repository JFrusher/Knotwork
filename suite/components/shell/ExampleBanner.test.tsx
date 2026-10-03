import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined }));

const { useKnotworkStore } = await import("@/lib/store/useKnotworkStore");
const { useCopies } = await import("@/lib/store/copies");
const { ExampleBanner } = await import("./ExampleBanner");

afterEach(cleanup);

test("when the example cannot be kept, it says so and the example stays", async () => {
  const example = { exampleWedding: true, event: { coupleNames: "Alex & Sam" } };
  useKnotworkStore.setState({ status: "ready", raw: example });
  vi.spyOn(useCopies.getState(), "keep").mockRejectedValue(new Error("The disk is full."));

  render(<ExampleBanner />);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: /Start your own wedding/ })));

  expect(screen.getByRole("alert").textContent).toContain("The disk is full.");
  expect(useKnotworkStore.getState().raw).toBe(example);
});
