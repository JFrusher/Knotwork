import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { migrate } from "@jfrusher/knotwork";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => undefined }));

const { useKnotworkStore } = await import("@/lib/store/useKnotworkStore");
const { readCrew } = await import("@/lib/model/slices");
const { money } = await import("@/lib/money/money");
const { barSum } = await import("@/lib/bar/sum");
const { MoneyPage } = await import("./MoneyPage");

afterEach(() => cleanup());

test("the example wedding's drinks are shown as planned, and leave committed and paid alone", () => {
  const raw = JSON.parse(readFileSync(join(process.cwd(), "public", "fixtures", "example-wedding.knotwork.json"), "utf8"));
  const doc = migrate(raw);
  useKnotworkStore.setState({ status: "ready", raw, doc });
  render(<MoneyPage />);

  const accounts = money(readCrew(doc));
  const figure = (label: string) => screen.getByText(label, { selector: "span" }).nextElementSibling?.textContent;
  expect(figure("Committed")).toBe(accounts.committed.toLocaleString());
  expect(figure("Paid")).toBe(accounts.paid.toLocaleString());

  const line = screen.getByText(/Drinks, estimated by the/);
  expect(line.textContent).toContain(`about ${Math.round(barSum(doc).spend).toLocaleString()}, planned`);
  expect(screen.getByRole("link", { name: "Bar" }).getAttribute("href")).toBe("/bar");
});
