// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined }));
vi.mock("@/lib/accounts/browserClient", () => ({ browserClient: () => ({}) }));

const { useKnotworkStore } = await import("@/lib/store/useKnotworkStore");
const { useHelperLinks } = await import("@/lib/helpers/links");
const { ConfirmProvider } = await import("@/components/ui/Confirm");
const { HelperLinkField } = await import("./HelperLinkField");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const field = (personId = "per-ines", name = "Ines Ashdown") =>
  render(
    <ConfirmProvider>
      <HelperLinkField personId={personId} name={name} />
    </ConfirmProvider>,
  );
const link = (personId: string, token: string) => ({ personId, token, key: "k".repeat(43), fingerprint: "f", publishedAt: "2026-10-07T12:00:00Z" });

test("off the account, it says a link needs one", () => {
  useKnotworkStore.setState({ weddingId: null });
  field();
  expect(screen.getByText(/to send Ines Ashdown a link to their own sheet for the day/)).toBeTruthy();
});

test("with no link yet, one press makes one", () => {
  useKnotworkStore.setState({ weddingId: "w1" });
  useHelperLinks.setState({ links: [], problem: null });
  field();
  expect(screen.getByRole("button", { name: "Make Ines Ashdown a link" })).toBeTruthy();
});

test("a link shows itself, and says it updates and when it stops", () => {
  useKnotworkStore.setState({ weddingId: "w1" });
  useHelperLinks.setState({ links: [link("per-ines", "a".repeat(32))], problem: null });
  field();
  expect((screen.getByLabelText("Ines Ashdown's link") as HTMLInputElement).value).toBe(
    `${window.location.origin}/helper/${"a".repeat(32)}#k=${"k".repeat(43)}`,
  );
  expect(screen.getByText(/stops working the day after the wedding/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Take it down" })).toBeTruthy();
});

test("taking one helper's link down leaves the others", async () => {
  const fetch = vi.fn(async () => Response.json({}));
  vi.stubGlobal("fetch", fetch);
  useHelperLinks.setState({ weddingId: "w1", links: [link("per-ines", "a".repeat(32)), link("per-tom", "b".repeat(32))], problem: null });

  await useHelperLinks.getState().takeDown("per-ines");

  expect(fetch).toHaveBeenCalledWith("/api/helpers", expect.objectContaining({ method: "DELETE", body: JSON.stringify({ weddingId: "w1", personId: "per-ines" }) }));
  expect(useHelperLinks.getState().links?.map((entry) => entry.personId)).toEqual(["per-tom"]);
});


test("clipboard failure offers manual copying; a successful retry still says Copied", async () => {
  const writeText = vi.fn().mockRejectedValueOnce(new Error("denied")).mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  useKnotworkStore.setState({ weddingId: "w1" });
  useHelperLinks.setState({ weddingId: "w1", links: [link("per-ines", "a".repeat(32))], problem: null });
  field();
  fireEvent.click(screen.getByRole("button", { name: "Copy" }));
  expect((await screen.findByRole("alert")).textContent).toContain("copy it manually");
  const input = screen.getByLabelText("Ines Ashdown's link") as HTMLInputElement;
  expect(input.readOnly).toBe(true);
  expect(input.value).toContain("#k=");
  fireEvent.click(screen.getByRole("button", { name: "Copy" }));
  expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
});
