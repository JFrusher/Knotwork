import { act, cleanup, render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

let user: { id: string } | null = null;
vi.mock("@/lib/accounts/browserClient", () => ({
  browserClient: () => ({ auth: { getUser: async () => ({ data: { user } }) } }),
}));

const { default: InvitePage } = await import("./page");

const assign = vi.fn();
beforeEach(() => {
  user = null;
  assign.mockClear();
  vi.stubGlobal("location", { ...window.location, search: "", assign });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function open(token: string) {
  const params = Promise.resolve({ token });
  await act(async () => {
    render(
      <Suspense>
        <InvitePage params={params} />
      </Suspense>,
    );
  });
}

test("signing in from an invite comes back to the invite", async () => {
  await open("abc123");
  const link = await screen.findByRole("link", { name: "Sign in" });
  expect(link.getAttribute("href")).toBe(`/login?next=${encodeURIComponent("/invite/abc123")}`);
});

test("a link opened in another browser says so, rather than just asking to sign in", async () => {
  vi.stubGlobal("location", { ...window.location, search: "?signin=failed", assign });
  await open("abc123");
  expect(await screen.findByText(/did not sign you in/i)).toBeTruthy();
});

test("accepting opens the wedding afresh, so it starts syncing at once", async () => {
  user = { id: "u1" };
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ weddingId: "w1" }), { status: 200 })));
  await open("abc123");
  await vi.waitFor(() => expect(assign).toHaveBeenCalledWith("/open/w1"));
});
