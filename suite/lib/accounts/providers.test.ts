import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { enabledProviders } from "./providers";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function settings(body: unknown, ok = true) {
  const fetch = vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => body }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

test("asks Auth's public settings, with the anon key", async () => {
  const fetch = settings({ external: { google: true, apple: true } });
  await enabledProviders();
  expect(fetch).toHaveBeenCalledWith("https://project.supabase.co/auth/v1/settings", { headers: { apikey: "anon-key" } });
});

test("offers only what is switched on, in the page's order", async () => {
  settings({ external: { apple: true, google: false, github: true, email: true } });
  await expect(enabledProviders()).resolves.toEqual(["apple"]);
});

test("nothing switched on is nothing offered", async () => {
  settings({ external: {} });
  await expect(enabledProviders()).resolves.toEqual([]);
});

test("settings that cannot be read are an error, not a guess", async () => {
  settings({}, false);
  await expect(enabledProviders()).rejects.toThrow(/500/);
});
