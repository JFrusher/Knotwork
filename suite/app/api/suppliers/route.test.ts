// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";
import { memoryStore } from "@/lib/suppliers/store";

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
vi.mock("@/lib/suppliers/supabaseStore", () => ({ supplierStore: () => store }));

const route = await import("./route");
const byToken = await import("./[token]/route");

const KEY = "a".repeat(43);
const put = (body: Record<string, unknown>) =>
  route.PUT(new Request("http://localhost/api/suppliers", { method: "PUT", body: JSON.stringify(body) }));
const publishing = (teamId = "team-photo", key = KEY) => ({ weddingId: WEDDING, teamId, key, ciphertext: "c2VhbGVk", iv: "aXY=", fingerprint: "fp" });
const at = (token: string) => ({ params: Promise.resolve({ token }) });

beforeEach(async () => {
  user = { id: "alice", email: "alice@example.com" };
  members = ["alice"];
  for (const link of await store.linksOf(WEDDING)) await store.takeDown(WEDDING, link.teamId);
});

test("a member publishes, and the supplier reads their sealed sheet by token — nothing else", async () => {
  const { token } = (await (await put(publishing())).json()) as { token: string };
  const read = (await (await byToken.GET(new Request("http://localhost"), at(token))).json()) as Record<string, unknown>;
  expect(Object.keys(read).sort()).toEqual(["ciphertext", "confirmedAt", "iv", "publishedAt"]);
  expect(read.ciphertext).toBe("c2VhbGVk");
  expect(read.confirmedAt).toBeNull();
});

test("each supplier has their own link", async () => {
  const photo = (await (await put(publishing("team-photo"))).json()) as { token: string };
  const flowers = (await (await put(publishing("team-flowers", "b".repeat(43)))).json()) as { token: string };
  expect(photo.token).not.toBe(flowers.token);
  const listed = (await (await route.GET(new Request(`http://localhost/api/suppliers?wedding=${WEDDING}`))).json()) as {
    links: { teamId: string; key: string }[];
  };
  expect(listed.links.map((link) => [link.teamId, link.key]).sort()).toEqual([
    ["team-flowers", "b".repeat(43)],
    ["team-photo", KEY],
  ]);
});

test("the supplier confirms through their link, and members see when", async () => {
  const { token } = (await (await put(publishing())).json()) as { token: string };
  const confirmed = (await (await byToken.POST(new Request("http://localhost", { method: "POST" }), at(token))).json()) as {
    confirmedAt: string;
  };
  const listed = (await (await route.GET(new Request(`http://localhost/api/suppliers?wedding=${WEDDING}`))).json()) as {
    links: { confirmedAt: string }[];
  };
  expect(listed.links[0].confirmedAt).toBe(confirmed.confirmedAt);
});

test("anyone not on the wedding is told it is not theirs", async () => {
  members = [];
  expect((await route.GET(new Request(`http://localhost/api/suppliers?wedding=${WEDDING}`))).status).toBe(404);
  expect((await put(publishing())).status).toBe(404);
  user = null;
  expect((await put(publishing())).status).toBe(401);
});

test("a republish under another key is refused", async () => {
  await put(publishing());
  expect((await put(publishing("team-photo", "b".repeat(43)))).status).toBe(409);
});

test("a token that is not one, or a link taken down, is simply not found", async () => {
  expect((await byToken.GET(new Request("http://localhost"), at("../x"))).status).toBe(404);
  expect((await byToken.POST(new Request("http://localhost", { method: "POST" }), at("../x"))).status).toBe(404);

  const { token } = (await (await put(publishing())).json()) as { token: string };
  await route.DELETE(
    new Request("http://localhost/api/suppliers", { method: "DELETE", body: JSON.stringify({ weddingId: WEDDING, teamId: "team-photo" }) }),
  );
  expect((await byToken.GET(new Request("http://localhost"), at(token))).status).toBe(404);
  expect((await byToken.POST(new Request("http://localhost", { method: "POST" }), at(token))).status).toBe(404);
});
