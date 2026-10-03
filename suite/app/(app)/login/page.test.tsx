import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const signInWithOtp = vi.fn(async (_: unknown) => ({ error: null }));
const verifyOtp = vi.fn(async (_: unknown) => ({ error: null }));
const signInWithOAuth = vi.fn(async (_: unknown): Promise<{ error: { message: string } | null }> => ({ error: null }));
const client = { auth: { signInWithOtp, verifyOtp, signInWithOAuth } };
vi.mock("@/lib/accounts/browserClient", () => ({ browserClient: () => client }));
const enabledProviders = vi.fn(async (): Promise<string[]> => ["google", "apple"]);
vi.mock("@/lib/accounts/providers", () => ({ enabledProviders }));

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

test("verifies the code, then finishes the sign-in through the callback", async () => {
  vi.stubGlobal("location", { ...window.location, origin: "https://app.example", search: "?next=%2Finvite%2Fabc123", assign: vi.fn() });
  await act(async () => render(<LoginPage />));
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "sam@example.com" } });
  await act(async () => fireEvent.submit(screen.getByRole("button", { name: /send me a code/i }).closest("form")!));
  fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: "123456" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: /verify code/i })));
  expect(verifyOtp).toHaveBeenCalledWith({ email: "sam@example.com", token: "123456", type: "email" });
  expect(window.location.assign).toHaveBeenCalledWith("https://app.example/auth/callback?next=%2Finvite%2Fabc123");
});

test("Google returns through the callback, carrying where the person was going", async () => {
  vi.stubGlobal("location", { ...window.location, origin: "https://app.example", search: "?next=%2Finvite%2Fabc123" });
  await act(async () => render(<LoginPage />));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: /continue with google/i })));
  expect(signInWithOAuth).toHaveBeenCalledWith({
    provider: "google",
    options: { redirectTo: "https://app.example/auth/callback?next=%2Finvite%2Fabc123" },
  });
});

test("Apple asks for the name and email scopes", async () => {
  vi.stubGlobal("location", { ...window.location, origin: "https://app.example", search: "" });
  await act(async () => render(<LoginPage />));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: /continue with apple/i })));
  expect(signInWithOAuth).toHaveBeenCalledWith({
    provider: "apple",
    options: { redirectTo: "https://app.example/auth/callback", scopes: "name email" },
  });
});

test("a provider that cannot start says so and frees the buttons", async () => {
  signInWithOAuth.mockResolvedValueOnce({ error: { message: "Provider is not enabled" } });
  vi.stubGlobal("location", { ...window.location, origin: "https://app.example", search: "" });
  await act(async () => render(<LoginPage />));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: /continue with google/i })));
  expect(screen.getByRole("alert").textContent).toBe("Provider is not enabled");
  expect(screen.getByRole("button", { name: /continue with google/i })).toHaveProperty("disabled", false);
});

test("on the way to an invite, warns that Apple's hidden address will not match it", async () => {
  vi.stubGlobal("location", { ...window.location, origin: "https://app.example", search: "?next=%2Finvite%2Fabc123" });
  await act(async () => render(<LoginPage />));
  expect(screen.getByText(/Sign in with the address your invite was sent to/)).toBeTruthy();
  expect(screen.getByText("Share My Email")).toBeTruthy();
});

test("an ordinary sign-in says nothing about invites", async () => {
  vi.stubGlobal("location", { ...window.location, origin: "https://app.example", search: "" });
  await act(async () => render(<LoginPage />));
  expect(screen.queryByText("Share My Email")).toBeNull();
});

test("only the providers switched on in Supabase are offered", async () => {
  enabledProviders.mockResolvedValueOnce(["google"]);
  vi.stubGlobal("location", { ...window.location, origin: "https://app.example", search: "" });
  await act(async () => render(<LoginPage />));
  expect(screen.getByRole("button", { name: /continue with google/i })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /continue with apple/i })).toBeNull();
});

test("with none switched on there are no buttons and no 'or' — just the email code", async () => {
  enabledProviders.mockResolvedValueOnce([]);
  vi.stubGlobal("location", { ...window.location, origin: "https://app.example", search: "" });
  await act(async () => render(<LoginPage />));
  expect(screen.queryByRole("button", { name: /continue with/i })).toBeNull();
  expect(screen.queryByRole("separator")).toBeNull();
  expect(screen.getByRole("button", { name: /send me a code/i })).toBeTruthy();
});

test("settings that cannot be read offer no buttons, and the email code still works", async () => {
  enabledProviders.mockRejectedValueOnce(new Error("Auth settings answered 500."));
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubGlobal("location", { ...window.location, origin: "https://app.example", search: "" });
  await act(async () => render(<LoginPage />));
  expect(screen.queryByRole("button", { name: /continue with/i })).toBeNull();
  expect(screen.getByRole("button", { name: /send me a code/i })).toBeTruthy();
});

test("the Share My Email advice appears only when Apple is offered", async () => {
  enabledProviders.mockResolvedValueOnce(["google"]);
  vi.stubGlobal("location", { ...window.location, origin: "https://app.example", search: "?next=%2Finvite%2Fabc123" });
  await act(async () => render(<LoginPage />));
  expect(screen.getByText(/Sign in with the address your invite was sent to/)).toBeTruthy();
  expect(screen.queryByText("Share My Email")).toBeNull();
});
