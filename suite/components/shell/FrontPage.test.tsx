import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined }));
vi.mock("./Welcome", () => ({ Welcome: () => <p>welcome</p> }));

const { useKnotworkStore } = await import("@/lib/store/useKnotworkStore");
const { emptyKnotwork } = await import("@jfrusher/knotwork");
const { FrontPage } = await import("./FrontPage");

afterEach(cleanup);

function show(status: "loading" | "ready", raw: Record<string, unknown>) {
  useKnotworkStore.setState({ status, raw });
  render(<FrontPage dashboard={<p>dashboard</p>} />);
}

const empty = () => emptyKnotwork() as unknown as Record<string, unknown>;

test("an empty wedding is welcomed rather than shown six empty cards", () => {
  show("ready", empty());
  expect(screen.getByText("welcome")).toBeTruthy();
  expect(screen.queryByText("dashboard")).toBeNull();
});

test("anything in the wedding brings the dashboard back", () => {
  show("ready", { ...empty(), event: { ...emptyKnotwork().event, coupleNames: "Alex" } });
  expect(screen.getByText("dashboard")).toBeTruthy();
});

test("nothing is decided before the stored wedding has been read", () => {
  show("loading", empty());
  expect(screen.queryByText("welcome")).toBeNull();
  expect(screen.queryByText("dashboard")).toBeNull();
});
