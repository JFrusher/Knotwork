// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { HelperPage } from "./HelperPage";
import { unseal } from "@/lib/share/crypto";

vi.mock("@/lib/share/crypto", () => ({ importShareKey: vi.fn(), unseal: vi.fn() }));
vi.mock("@/lib/offline", () => ({ keepForOffline: vi.fn() }));
const sheet = {
  wedding: { names: "Alex & Sam", date: "2028-06-01", venue: "The Old Granary" },
  helper: { name: "Ines", team: "" }, day: [], jobs: [], boxes: [], shots: [], crew: [],
};
const publishedAt = "2026-10-07T12:00:00Z";
const key = "knotwork.helper.token";
beforeEach(() => { localStorage.clear(); window.location.hash = "#k=key"; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

test.each([null, {}, { ...sheet, shots: [{}] }])("invalid decrypted data uses the opening error and is never cached: %j", async (invalid) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ publishedAt })));
  vi.mocked(unseal).mockResolvedValue(invalid);
  render(<HelperPage token="token" />);
  expect(await screen.findByText(/This link could not be opened/)).toBeTruthy();
  expect(localStorage.getItem(key)).toBeNull();
});

test.each(["{", "null", JSON.stringify({ sheet: {} , publishedAt }), JSON.stringify({ sheet, publishedAt: "bad-date" })])("invalid cached data uses the opening error: %s", async (stored) => {
  localStorage.setItem(key, stored);
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(<HelperPage token="token" />);
  expect(await screen.findByText(/This link could not be opened/)).toBeTruthy();
});

test.each([false, true])("valid sheets open online and offline (offline: %s)", async (offline) => {
  localStorage.setItem(key, JSON.stringify({ sheet, publishedAt }));
  vi.stubGlobal("fetch", offline ? vi.fn().mockRejectedValue(new Error("offline")) : vi.fn().mockResolvedValue(Response.json({ publishedAt })));
  vi.mocked(unseal).mockResolvedValue(sheet);
  render(<HelperPage token="token" />);
  expect(await screen.findByRole("heading", { name: "Alex & Sam" })).toBeTruthy();
  if (offline) expect(screen.getByRole("status").textContent).toContain("No signal");
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual({ sheet, publishedAt });
});

test("a missing offline copy retains the no-signal message", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(<HelperPage token="token" />);
  expect(await screen.findByText(/this link has not been opened on this phone before/)).toBeTruthy();
});
