import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined }));
vi.mock("next/navigation", () => ({ usePathname: () => "/seating" }));
const client = { current: null as unknown };
vi.mock("@/lib/accounts/browserClient", () => ({ browserClient: () => client.current }));

const { fakeClient } = await import("@/lib/testing/realtime");
const { usePresence } = await import("@/lib/documents/live");
const { useTrousseauStore } = await import("@/lib/store/useTrousseauStore");
const { LiveWedding } = await import("./LiveWedding");
const { WhoIsHere } = await import("./WhoIsHere");

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const pull = vi.fn(async () => {});

beforeEach(() => {
  pull.mockClear();
  usePresence.setState({ others: [] });
  useTrousseauStore.setState({ weddingId: "w1", cloudVersion: 3, pullFromCloud: pull });
});
afterEach(cleanup);

test("a save from elsewhere is pulled the moment it is announced; its own is not", async () => {
  const fake = fakeClient();
  client.current = fake.client;
  render(<LiveWedding />);
  await settle();
  await settle();

  fake.joined();
  expect(pull).toHaveBeenCalledTimes(1);

  fake.moved(3);
  expect(pull).toHaveBeenCalledTimes(1);
  fake.moved(4);
  expect(pull).toHaveBeenCalledTimes(2);
  expect(fake.channel.track).toHaveBeenCalledWith({ email: "alex@example.com", where: "Seating" });
});

test("nobody signed in, nothing followed", async () => {
  const fake = fakeClient(null);
  client.current = fake.client;
  render(<LiveWedding />);
  await settle();
  await settle();
  expect(fake.client.channel).not.toHaveBeenCalled();
});

test("who else is here is shown by initial, and named in full", () => {
  const { container } = render(<WhoIsHere />);
  expect(container.innerHTML).toBe("");

  cleanup();
  usePresence.setState({ others: [{ email: "sam@example.com", where: "Timeline" }, { email: "planner@example.com", where: null }] });
  render(<WhoIsHere />);
  const list = screen.getByRole("list", { name: "Also here" });
  expect(list.textContent).toContain("sam@example.com, in Timeline");
  expect(list.textContent).toContain("planner@example.com");
});
