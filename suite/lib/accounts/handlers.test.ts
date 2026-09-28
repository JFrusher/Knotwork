import { describe, expect, it } from "vitest";
import {
  acceptInviteHandler,
  createInviteHandler,
  createWeddingHandler,
  deleteAccountHandler,
  firstSignInHandler,
  listWeddingsHandler,
  peopleHandler,
  removeMemberHandler,
} from "./handlers";
import { memoryStore } from "./store";
import { memoryStore as memoryDocuments } from "@/lib/documents/store";

function seededStore() {
  const store = memoryStore() as ReturnType<typeof memoryStore> & {
    _seedEmail(userId: string, email: string): void;
    _expire(token: string): void;
  };
  return store;
}

describe("createWeddingHandler", () => {
  it("creates a wedding and returns its id", async () => {
    const store = seededStore();
    const reply = await createWeddingHandler(store, "alice", "partner");
    expect(reply.status).toBe(200);
    expect((reply.body as { weddingId: string }).weddingId).toBeTruthy();
  });

  it("refuses a second wedding for the same user", async () => {
    const store = seededStore();
    await createWeddingHandler(store, "alice", "partner");
    const reply = await createWeddingHandler(store, "alice", "partner");
    expect(reply.status).toBe(409);
  });
});

describe("createInviteHandler", () => {
  it("creates an invite for a member of the wedding", async () => {
    const store = seededStore();
    const created = await createWeddingHandler(store, "alice", "partner");
    const weddingId = (created.body as { weddingId: string }).weddingId;

    const reply = await createInviteHandler(store, weddingId, "alice", "bob@example.com", "partner");
    expect(reply.status).toBe(200);
    expect((reply.body as { token: string }).token).toBeTruthy();
  });

  it("refuses someone who is not a member of the wedding", async () => {
    const store = seededStore();
    const created = await createWeddingHandler(store, "alice", "partner");
    const weddingId = (created.body as { weddingId: string }).weddingId;

    const reply = await createInviteHandler(store, weddingId, "mallory", "bob@example.com", "partner");
    expect(reply.status).toBe(403);
  });

  it("refuses a third invite once the wedding already has two members", async () => {
    const store = seededStore();
    store._seedEmail("bob", "bob@example.com");
    const created = await createWeddingHandler(store, "alice", "partner");
    const weddingId = (created.body as { weddingId: string }).weddingId;
    const invite = await createInviteHandler(store, weddingId, "alice", "bob@example.com", "partner");
    const token = (invite.body as { token: string }).token;
    await acceptInviteHandler(store, token, "bob");

    const reply = await createInviteHandler(store, weddingId, "alice", "carol@example.com", "partner");
    expect(reply.status).toBe(409);
  });
});

describe("acceptInviteHandler", () => {
  it("adds the invited user as a member on a matching-email accept", async () => {
    const store = seededStore();
    store._seedEmail("bob", "bob@example.com");
    const created = await createWeddingHandler(store, "alice", "partner");
    const weddingId = (created.body as { weddingId: string }).weddingId;
    const invite = await createInviteHandler(store, weddingId, "alice", "bob@example.com", "partner");
    const token = (invite.body as { token: string }).token;

    const reply = await acceptInviteHandler(store, token, "bob");
    expect(reply.status).toBe(200);

    const members = await store.membersOf(weddingId);
    expect(members).toHaveLength(2);
  });

  it("rejects with a specific reason when the authenticating email doesn't match", async () => {
    const store = seededStore();
    store._seedEmail("eve", "eve@example.com");
    const created = await createWeddingHandler(store, "alice", "partner");
    const weddingId = (created.body as { weddingId: string }).weddingId;
    const invite = await createInviteHandler(store, weddingId, "alice", "bob@example.com", "partner");
    const token = (invite.body as { token: string }).token;

    const reply = await acceptInviteHandler(store, token, "eve");
    expect(reply.status).toBe(409);
    expect((reply.body as { reason: string }).reason).toBe("wrong-email");
    // The address comes back from the accept itself — the invitee can never
    // read the invite row to find it out.
    expect((reply.body as { error: string }).error).toContain("bob@example.com");
  });

  it("rejects someone who already has a wedding of their own", async () => {
    const store = seededStore();
    store._seedEmail("bob", "bob@example.com");
    const alice = await createWeddingHandler(store, "alice", "partner");
    const weddingId = (alice.body as { weddingId: string }).weddingId;
    const invite = await createInviteHandler(store, weddingId, "alice", "bob@example.com", "partner");
    await createWeddingHandler(store, "bob", "partner"); // bob set up his own wedding first

    const reply = await acceptInviteHandler(store, (invite.body as { token: string }).token, "bob");
    expect(reply.status).toBe(409);
    expect((reply.body as { reason: string }).reason).toBe("already-in-a-wedding");
  });

  it("rejects an unknown token with 404", async () => {
    const store = seededStore();
    const reply = await acceptInviteHandler(store, "does-not-exist", "bob");
    expect(reply.status).toBe(404);
  });

  it("rejects accepting the same invite twice", async () => {
    const store = seededStore();
    store._seedEmail("bob", "bob@example.com");
    const created = await createWeddingHandler(store, "alice", "partner");
    const weddingId = (created.body as { weddingId: string }).weddingId;
    const invite = await createInviteHandler(store, weddingId, "alice", "bob@example.com", "partner");
    const token = (invite.body as { token: string }).token;
    await acceptInviteHandler(store, token, "bob");

    store._seedEmail("bob2", "bob@example.com");
    const reply = await acceptInviteHandler(store, token, "bob2");
    expect(reply.status).toBe(409);
    expect((reply.body as { reason: string }).reason).toBe("already-accepted");
  });

  it("rejects an expired invite", async () => {
    const store = seededStore();
    store._seedEmail("bob", "bob@example.com");
    const created = await createWeddingHandler(store, "alice", "partner");
    const weddingId = (created.body as { weddingId: string }).weddingId;
    const invite = await createInviteHandler(store, weddingId, "alice", "bob@example.com", "partner");
    const token = (invite.body as { token: string }).token;

    store._expire(token);

    const reply = await acceptInviteHandler(store, token, "bob");
    expect(reply.status).toBe(409);
    expect((reply.body as { reason: string }).reason).toBe("expired");
  });

  it("rejects an accept once the wedding filled up between two outstanding invites", async () => {
    const store = seededStore();
    store._seedEmail("bob", "bob@example.com");
    store._seedEmail("carol", "carol@example.com");
    const created = await createWeddingHandler(store, "alice", "partner");
    const weddingId = (created.body as { weddingId: string }).weddingId;

    const inviteBob = await createInviteHandler(store, weddingId, "alice", "bob@example.com", "partner");
    const inviteCarol = await createInviteHandler(store, weddingId, "alice", "carol@example.com", "partner");
    await acceptInviteHandler(store, (inviteBob.body as { token: string }).token, "bob");

    const reply = await acceptInviteHandler(store, (inviteCarol.body as { token: string }).token, "carol");
    expect(reply.status).toBe(409);
    expect((reply.body as { reason: string }).reason).toBe("wedding-full");
  });
});

describe("deleteAccountHandler", () => {
  it("leaves the wedding intact for a remaining partner", async () => {
    const store = seededStore();
    store._seedEmail("bob", "bob@example.com");
    const created = await createWeddingHandler(store, "alice", "partner");
    const weddingId = (created.body as { weddingId: string }).weddingId;
    const invite = await createInviteHandler(store, weddingId, "alice", "bob@example.com", "partner");
    const token = (invite.body as { token: string }).token;
    await acceptInviteHandler(store, token, "bob");

    await deleteAccountHandler(store, "bob");

    const remaining = await store.membershipsOf("alice");
    expect(remaining.map((m) => m.weddingId)).toEqual([weddingId]);
  });

  it("removes the wedding entirely once its last member is deleted", async () => {
    const store = seededStore();
    const created = await createWeddingHandler(store, "alice", "partner");
    const weddingId = (created.body as { weddingId: string }).weddingId;

    await deleteAccountHandler(store, "alice");

    const members = await store.membersOf(weddingId);
    expect(members).toHaveLength(0);
  });
});

describe("roles", () => {
  async function weddingWithPlanner() {
    const store = seededStore();
    store._seedEmail("alice", "alice@example.com");
    store._seedEmail("pat", "pat@planners.example");
    const created = await createWeddingHandler(store, "alice", "partner");
    const weddingId = (created.body as { weddingId: string }).weddingId;
    const invite = await createInviteHandler(store, weddingId, "alice", "pat@planners.example", "planner");
    await acceptInviteHandler(store, (invite.body as { token: string }).token, "pat");
    return { store, weddingId };
  }

  it("a first sign-in starts the couple's wedding, and a later one starts nothing", async () => {
    const store = seededStore();
    const first = await firstSignInHandler(store, "alice");
    expect((first.body as { weddingId: string | null }).weddingId).toBeTruthy();
    const again = await firstSignInHandler(store, "alice");
    expect((again.body as { weddingId: string | null }).weddingId).toBeNull();
    expect(await store.membershipsOf("alice")).toHaveLength(1);
  });

  it("a planner signing in is not handed a wedding of their own", async () => {
    const store = seededStore();
    await createWeddingHandler(store, "pat", "planner");
    await firstSignInHandler(store, "pat");
    expect((await store.membershipsOf("pat")).map((m) => m.role)).toEqual(["planner"]);
  });

  it("a planner starts as many client weddings as they like", async () => {
    const store = seededStore();
    for (const _ of [1, 2, 3]) expect((await createWeddingHandler(store, "pat", "planner")).status).toBe(200);
  });

  it("a second planner is refused before an invite is ever sent", async () => {
    const { store, weddingId } = await weddingWithPlanner();
    const reply = await createInviteHandler(store, weddingId, "alice", "quinn@planners.example", "planner");
    expect(reply.status).toBe(409);
    expect((reply.body as { error: string }).error).toMatch(/already has a planner/);
  });

  it("the couple sees who has access, with addresses and roles", async () => {
    const { store, weddingId } = await weddingWithPlanner();
    const reply = await peopleHandler(store, weddingId, "alice");
    expect((reply.body as { people: Array<{ email: string; role: string }> }).people.map((p) => [p.email, p.role])).toEqual([
      ["alice@example.com", "partner"],
      ["pat@planners.example", "planner"],
    ]);
    expect((await peopleHandler(store, weddingId, "mallory")).status).toBe(403);
  });

  it("the couple can remove their planner; the planner cannot remove the couple", async () => {
    const { store, weddingId } = await weddingWithPlanner();
    expect((await removeMemberHandler(store, weddingId, "pat", "alice")).status).toBe(403);
    expect((await removeMemberHandler(store, weddingId, "alice", "pat")).status).toBe(200);
    expect((await store.membersOf(weddingId)).map((m) => m.userId)).toEqual(["alice"]);
  });

  it("anyone can leave", async () => {
    const { store, weddingId } = await weddingWithPlanner();
    expect((await removeMemberHandler(store, weddingId, "pat", "pat")).status).toBe(200);
    expect(await store.membershipsOf("pat")).toEqual([]);
  });
});

describe("listWeddingsHandler", () => {
  it("lists a planner's clients with how each stands: what is left, what is next, what is owed", async () => {
    const accounts = seededStore();
    const documents = memoryDocuments();
    const client = ((await createWeddingHandler(accounts, "planner-1", "planner")).body as { weddingId: string }).weddingId;
    await documents.saveDocument(
      client,
      {
        event: { coupleNames: "Robin & Kit", date: "2028-06-01" },
        guests: { r1: { id: "r1", firstName: "Robin", assignedTableId: null } },
        seating: { tables: { t1: { id: "t1", label: "Table 1", assignedGuestIds: [] } } },
        crew: { teams: [{ id: "band", name: "The Sundays", cost: 2200, deposit: 500, depositPaidOn: "2027-01-01" }] },
      },
      0,
    );

    const reply = await listWeddingsHandler(accounts, documents, "planner-1", "2026-09-28");

    expect(reply.body).toEqual({
      weddings: [
        {
          weddingId: client,
          role: "planner",
          names: "Robin & Kit",
          date: "2028-06-01",
          savedAt: expect.any(String),
          state: { left: 1, blocking: 0, next: "Robin has no table yet.", owed: 1700 },
        },
      ],
    });
  });
});
