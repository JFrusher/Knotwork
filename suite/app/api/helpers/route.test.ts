// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";
import { memoryStore } from "@/lib/helpers/store";

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
vi.mock("@/lib/helpers/supabaseStore", () => ({ helperStore: () => store }));

const route = await import("./route");
const byToken = await import("./[token]/route");

const KEY = "a".repeat(43);
const put = (body: Record<string, unknown>) =>
  route.PUT(new Request("http://localhost/api/helpers", { method: "PUT", body: JSON.stringify(body) }));
const publishing = (personId = "per-ines", key = KEY) => ({ weddingId: WEDDING, personId, key, ciphertext: "c2VhbGVk", iv: "aXY=", fingerprint: "fp" });
const at = (token: string) => ({ params: Promise.resolve({ token }) });
const takeDown = (personId: string) =>
  route.DELETE(new Request("http://localhost/api/helpers", { method: "DELETE", body: JSON.stringify({ weddingId: WEDDING, personId }) }));

beforeEach(async () => {
  user = { id: "alice", email: "alice@example.com" };
  members = ["alice"];
  for (const link of await store.linksOf(WEDDING)) await store.takeDown(WEDDING, link.personId);
});

test("a member publishes, and the helper reads their sealed sheet by token — nothing else", async () => {
  const { token } = (await (await put(publishing())).json()) as { token: string };
  const read = (await (await byToken.GET(new Request("http://localhost"), at(token))).json()) as Record<string, unknown>;
  expect(Object.keys(read).sort()).toEqual(["ciphertext", "iv", "publishedAt"]);
  expect(read.ciphertext).toBe("c2VhbGVk");
});

test("each helper has their own link, and taking one down leaves the others working", async () => {
  const ines = (await (await put(publishing("per-ines"))).json()) as { token: string };
  const tom = (await (await put(publishing("per-tom", "b".repeat(43)))).json()) as { token: string };
  expect(ines.token).not.toBe(tom.token);

  await takeDown("per-ines");
  expect((await byToken.GET(new Request("http://localhost"), at(ines.token))).status).toBe(404);
  expect((await byToken.GET(new Request("http://localhost"), at(tom.token))).status).toBe(200);
});

test("anyone not on the wedding is told it is not theirs", async () => {
  members = [];
  expect((await route.GET(new Request(`http://localhost/api/helpers?wedding=${WEDDING}`))).status).toBe(404);
  expect((await put(publishing())).status).toBe(404);
  expect((await takeDown("per-ines")).status).toBe(404);
  user = null;
  expect((await put(publishing())).status).toBe(401);
});

test("a republish under another key is refused", async () => {
  await put(publishing());
  expect((await put(publishing("per-ines", "b".repeat(43)))).status).toBe(409);
});

test("a token that is not one is simply not found", async () => {
  expect((await byToken.GET(new Request("http://localhost"), at("../x"))).status).toBe(404);
});
