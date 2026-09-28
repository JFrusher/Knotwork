import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const signInWithOtp = vi.fn(async (_: unknown) => ({ error: null }));
vi.mock("@/lib/accounts/browserClient", () => ({
  browserClient: () => ({ auth: { signInWithOtp } }),
}));

const { default: LoginPage } = await import("./page");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("the sign-in link returns to where the person was going", async () => {
  vi.stubGlobal("location", { ...window.location, origin: "https://app.example", search: "?next=%2Finvite%2Fabc123" });
  await act(async () => {
    render(<LoginPage />);
  });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "sam@example.com" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /sign-in link/i }));
  });
  expect(signInWithOtp).toHaveBeenCalledWith({
    email: "sam@example.com",
    options: { emailRedirectTo: `https://app.example/auth/callback?next=${encodeURIComponent("/invite/abc123")}` },
  });
});
