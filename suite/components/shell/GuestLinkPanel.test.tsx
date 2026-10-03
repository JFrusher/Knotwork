import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined }));
vi.mock("@/lib/accounts/browserClient", () => ({ browserClient: () => ({}) }));

const { useKnotworkStore } = await import("@/lib/store/useKnotworkStore");
const { useGuestLink } = await import("@/lib/share/guestLink");
const { ConfirmProvider } = await import("@/components/ui/Confirm");
const { GuestLinkPanel } = await import("./GuestLinkPanel");

afterEach(() => cleanup());

const panel = () =>
  render(
    <ConfirmProvider>
      <GuestLinkPanel />
    </ConfirmProvider>,
  );

test("off the account, it says where a link lives — and asks for no passphrase", () => {
  useKnotworkStore.setState({ weddingId: null });
  panel();
  expect(screen.getByText(/It lives on your account/)).toBeTruthy();
  expect(screen.queryByLabelText(/passphrase/i)).toBeNull();
});

test("on the account with no link, one press publishes", () => {
  useKnotworkStore.setState({ weddingId: "w1" });
  useGuestLink.setState({ link: null, problem: null });
  panel();
  expect(screen.getByRole("button", { name: "Publish a link" })).toBeTruthy();
});

test("a published link shows itself, when it was last updated, and that it keeps itself current", () => {
  useKnotworkStore.setState({ weddingId: "w1" });
  useGuestLink.setState({
    link: { token: "t".repeat(32), key: "k".repeat(43), showPlan: false, fingerprint: "f", publishedAt: "2026-09-28T12:00:00Z" },
    problem: null,
  });
  panel();
  expect((screen.getByLabelText("The guest link") as HTMLInputElement).value).toBe(
    `${window.location.origin}/seat/${"t".repeat(32)}#k=${"k".repeat(43)}`,
  );
  expect(screen.getByRole("status").textContent).toMatch(/It updates itself as seats change/);
  expect(screen.getByRole("button", { name: "Take it down" })).toBeTruthy();
});
