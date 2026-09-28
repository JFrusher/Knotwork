// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";
import { memoryStore } from "@/lib/documents/store";

/**
 * The route itself, with only the Supabase seams faked.
 *
 * `lib/documents/handlers.ts` is already tested against the in-memory store,
 * and the migration against a real Postgres — but nothing covered the route:
 * the ordering of auth against the rate limit, the membership lookup, the
 * shape of the 429. Those are exactly the joins that break.
 */

const store = memoryStore();
let currentUserResult: { id: string; email: string } | null = { id: "user-1", email: "a@example.com" };
let membership: { weddingId: string } | null = { weddingId: "wedding-1" };

vi.mock("@/lib/env", () => ({ accountsConfigured: () => true }));

vi.mock("@/lib/accounts/serverClient", () => ({
  currentUser: async () => currentUserResult,
  serverClient: async () => ({}),
}));

vi.mock("@/lib/accounts/supabaseStore", () => ({
  accountsStore: () => ({
    membersOf: async (weddingId: string) =>
      membership?.weddingId === weddingId && currentUserResult ? [{ userId: currentUserResult.id }] : [],
  }),
}));

vi.mock("@/lib/documents/supabaseStore", () => ({
  documentStore: () => store,
}));

const route = await import("./route");

const put = (document: unknown, expectedVersion: number) =>
  route.PUT(
    new Request(`http://localhost/api/documents?wedding=${membership?.weddingId ?? "not-mine"}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ document, expectedVersion }),
    }),
  );

// A fresh account and wedding per test, because both the in-memory store and
// the limiter's window map are shared across this file.
beforeEach(() => {
  currentUserResult = { id: `user-${Math.random()}`, email: "a@example.com" };
  membership = { weddingId: `wedding-${Math.random()}` };
});

test("a signed-in member can save, and the version advances", async () => {
  const first = await put({ kind: "trousseau", version: 1 }, 0);
  expect(first.status).toBe(200);
  expect(await first.json()).toMatchObject({ version: 1 });
});

test("a stale expected version comes back as a conflict, with the true state", async () => {
  await put({ kind: "trousseau", version: 1 }, 0);
  const second = await put({ kind: "trousseau", version: 1 }, 0);
  expect(second.status).toBe(409);
  expect(await second.json()).toMatchObject({ version: 1 });
});

test("a signed-out caller is refused before any document work", async () => {
  currentUserResult = null;
  const response = await put({ kind: "trousseau", version: 1 }, 0);
  expect(response.status).toBe(401);
});

test("a wedding the caller is not on gets 404, not a crash", async () => {
  membership = null;
  const response = await put({ kind: "trousseau", version: 1 }, 0);
  expect(response.status).toBe(404);
});

test("writes past the limit are throttled, and the budget is per account", async () => {
  // WRITE_LIMIT is 600 a minute. Spend it, then confirm the next is refused.
  let version = 0;
  for (let i = 0; i < 600; i += 1) {
    const response = await put({ kind: "trousseau", version: 1 }, version);
    if (response.status === 200) version += 1;
  }
  const refused = await put({ kind: "trousseau", version: 1 }, version);
  expect(refused.status).toBe(429);

  // A different account is unaffected — this is the point of keying by user.
  currentUserResult = { id: "someone-else", email: "b@example.com" };
  membership = { weddingId: "someone-elses-wedding" };
  const other = await put({ kind: "trousseau", version: 1 }, 0);
  expect(other.status).toBe(200);
});

test("a request that names no wedding gets 404 — an account may be on several", async () => {
  const response = await route.GET(new Request("http://localhost/api/documents"));
  expect(response.status).toBe(404);
});

test("the wedding travels with its document", async () => {
  await put({ kind: "trousseau", version: 1 }, 0);
  const response = await route.GET(new Request(`http://localhost/api/documents?wedding=${membership!.weddingId}`));
  expect(await response.json()).toMatchObject({ weddingId: membership!.weddingId, version: 1 });
});
