import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const signInWithOtp = vi.fn(async (_: unknown) => ({ error: null }));
const verifyOtp = vi.fn(async (_: unknown) => ({ error: null }));
vi.mock("@/lib/accounts/browserClient", () => ({
  browserClient: () => ({ auth: { signInWithOtp, verifyOtp } }),
}));

const { default: LoginPage } = await import("./page");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("requests an email OTP without a redirect URL", async () => {
  vi.stubGlobal("location", { ...window.location, origin: "https://app.example", search: "?next=%2Finvite%2Fabc123" });
  await act(async () => {
    render(<LoginPage />);
  });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "sam@example.com" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /send me a code/i }));
  });
  expect(signInWithOtp).toHaveBeenCalledWith({ email: "sam@example.com" });
  expect(screen.getByLabelText("Verification code")).toBeTruthy();
});

test("verifies the code and returns to the requested page", async () => {
  vi.stubGlobal("location", { ...window.location, origin: "https://app.example", search: "?next=%2Finvite%2Fabc123", assign: vi.fn() });
  await act(async () => render(<LoginPage />));
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "sam@example.com" } });
  await act(async () => fireEvent.submit(screen.getByRole("button", { name: /send me a code/i }).closest("form")!));
  fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: "123456" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: /verify code/i })));
  expect(verifyOtp).toHaveBeenCalledWith({ email: "sam@example.com", token: "123456", type: "email" });
  expect(window.location.assign).toHaveBeenCalledWith("/invite/abc123");
});
