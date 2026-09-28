// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";
import { memoryStore } from "@/lib/accounts/store";

const store = memoryStore();
let currentUserResult: { id: string; email: string } | null = { id: "user-1", email: "a@example.com" };

vi.mock("@/lib/env", () => ({ accountsConfigured: () => true }));
vi.mock("@/lib/accounts/serverClient", () => ({
  currentUser: async () => currentUserResult,
  serverClient: async () => ({}),
}));
vi.mock("@/lib/accounts/supabaseStore", () => ({ accountsStore: () => store }));

const { POST } = await import("./route");

const start = (role: "partner" | "planner") =>
  POST(
    new Request("http://localhost/api/accounts/weddings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role }),
    }),
  );

beforeEach(() => {
  currentUserResult = { id: "same-user", email: "a@example.com" };
});

test("wedding creation past the limit is throttled, per account", async () => {
  // CREATE_LIMIT is 5 an hour. The store also refuses a second partner
  // wedding for the same user (createWeddingHandler's 409), so with the SAME
  // user id the first call succeeds and calls 2-5 come back 409, not 200 —
  // but allow() still counts all five toward the budget. Call 6 must be
  // throttled specifically (429), not merely non-200, or a regression that
  // throttles too early would pass a looser assertion.
  const first = await start("partner");
  expect(first.status).toBe(200);

  for (let i = 0; i < 4; i += 1) {
    const again = await start("partner");
    expect(again.status).toBe(409);
  }

  const sixth = await start("planner");
  expect(sixth.status).toBe(429);
});
