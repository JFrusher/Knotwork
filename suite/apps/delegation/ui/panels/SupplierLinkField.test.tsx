// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined }));
vi.mock("@/lib/accounts/browserClient", () => ({ browserClient: () => ({}) }));

const { useKnotworkStore } = await import("@/lib/store/useKnotworkStore");
const { useSupplierLinks } = await import("@/lib/suppliers/links");
const { ConfirmProvider } = await import("@/components/ui/Confirm");
const { SupplierLinkField } = await import("./SupplierLinkField");

afterEach(() => cleanup());

const field = () =>
  render(
    <ConfirmProvider>
      <SupplierLinkField teamId="team-photo" name="Eleanor Vane Photography" />
    </ConfirmProvider>,
  );
const link = (confirmedAt: string | null, publishedAt = "2026-09-28T12:00:00Z") => ({
  teamId: "team-photo",
  token: "t".repeat(32),
  key: "k".repeat(43),
  fingerprint: "f",
  publishedAt,
  confirmedAt,
});

test("off the account, it says a link needs one", () => {
  useKnotworkStore.setState({ weddingId: null });
  field();
  expect(screen.getByText(/to send Eleanor Vane Photography a link to their own call sheet/)).toBeTruthy();
});

test("with no link yet, one press makes one", () => {
  useKnotworkStore.setState({ weddingId: "w1" });
  useSupplierLinks.setState({ links: [], problem: null });
  field();
  expect(screen.getByRole("button", { name: "Make Eleanor Vane Photography a link" })).toBeTruthy();
});

test("a link shows itself, and that they have not confirmed through it yet", () => {
  useKnotworkStore.setState({ weddingId: "w1" });
  useSupplierLinks.setState({ links: [link(null)], problem: null });
  field();
  expect((screen.getByLabelText("Eleanor Vane Photography's link") as HTMLInputElement).value).toBe(
    `${window.location.origin}/supplier/${"t".repeat(32)}#k=${"k".repeat(43)}`,
  );
  expect(screen.getByRole("status").textContent).toMatch(/^Not confirmed through it yet\./);
  expect(screen.getByRole("button", { name: "Take it down" })).toBeTruthy();
});

test("once they confirm, it says when — and if their sheet has changed since", () => {
  useKnotworkStore.setState({ weddingId: "w1" });
  useSupplierLinks.setState({ links: [link("2026-09-28T15:00:00Z")], problem: null });
  const first = field();
  expect(screen.getByRole("status").textContent).toMatch(/^Confirmed 28 September 2026\. /);
  first.unmount();

  useSupplierLinks.setState({ links: [link("2026-09-28T15:00:00Z", "2026-09-29T09:00:00Z")], problem: null });
  field();
  expect(screen.getByRole("status").textContent).toMatch(/^Confirmed 28 September 2026 — their sheet has changed since\./);
});
