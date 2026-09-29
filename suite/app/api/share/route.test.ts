// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";
import { memoryStore } from "@/lib/share/store";

/** The routes' wiring, with only the Supabase seams faked. The rules are the database's. */

const store = memoryStore();
const WEDDING = "0b7c2d36-5a3e-4f0e-9d1a-2c6b8e4f1a90";
let user: { id: string; email: string } | null = { id: "alice", email: "alice@example.com" };
let members = ["alice"];

vi.mock("@/lib/env", () => ({ accountsConfigured: () => true }));
vi.mock("@/lib/accounts/serverClient", () => ({ currentUser: async () => user, serverClient: async () => ({}) }));
vi.mock("@/lib/accounts/supabaseStore", () => ({
  accountsStore: () => ({ membersOf: async () => members.map((userId) => ({ userId })) }),
}));
vi.mock("@/lib/share/supabaseStore", () => ({ shareStore: () => store }));

const route = await import("./route");
const byToken = await import("./[token]/route");

const KEY = "a".repeat(43);
const put = (body: Record<string, unknown>) =>
  route.PUT(new Request("http://localhost/api/share", { method: "PUT", body: JSON.stringify(body) }));
const publishing = (key = KEY, ciphertext = "c2VhbGVk") => ({ weddingId: WEDDING, key, showPlan: false, ciphertext, iv: "aXY=", fingerprint: "fp" });

beforeEach(async () => {
  user = { id: "alice", email: "alice@example.com" };
  members = ["alice"];
  await store.takeDown(WEDDING);
});

test("a member publishes, and a guest reads the sealed snapshot by token — nothing else", async () => {
  const published = await put(publishing());
  expect(published.status).toBe(200);
  const { token } = (await published.json()) as { token: string };

  const read = await byToken.GET(new Request(`http://localhost/api/share/${token}`), { params: Promise.resolve({ token }) });
  expect(await read.json()).toEqual({ ciphertext: "c2VhbGVk", iv: "aXY=" });
});

test("members read the link with its key; anyone else is told it is not theirs", async () => {
  await put(publishing());
  const mine = await route.GET(new Request(`http://localhost/api/share?wedding=${WEDDING}`));
  expect(((await mine.json()) as { link: { key: string } }).link.key).toBe(KEY);

  members = [];
  expect((await route.GET(new Request(`http://localhost/api/share?wedding=${WEDDING}`))).status).toBe(404);
  expect((await put(publishing())).status).toBe(404);
});

test("a republish under another key is refused, so the next seal uses the published one", async () => {
  await put(publishing());
  expect((await put(publishing("b".repeat(43)))).status).toBe(409);
});

test("a token that is not one is simply not found", async () => {
  const response = await byToken.GET(new Request("http://localhost/api/share/nope"), { params: Promise.resolve({ token: "../x" }) });
  expect(response.status).toBe(404);
});

test("taking it down stops the link", async () => {
  const { token } = (await (await put(publishing())).json()) as { token: string };
  await route.DELETE(new Request("http://localhost/api/share", { method: "DELETE", body: JSON.stringify({ weddingId: WEDDING }) }));
  const read = await byToken.GET(new Request(`http://localhost/api/share/${token}`), { params: Promise.resolve({ token }) });
  expect(read.status).toBe(404);
});
