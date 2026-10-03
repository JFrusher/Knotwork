// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, expect, test, vi } from "vitest";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const SYNC_MIGRATION = join(process.cwd(), "..", "supabase", "migrations", "20260830000001_suite_sync.sql");
const ACCOUNTS_MIGRATION = join(process.cwd(), "..", "supabase", "migrations", "20260902000001_accounts.sql");
const DOCUMENTS_MIGRATION = join(process.cwd(), "..", "supabase", "migrations", "20260903000001_wedding_documents.sql");
const ROLES_MIGRATION = join(process.cwd(), "..", "supabase", "migrations", "20260928000001_roles.sql");
const PEOPLE_EMAIL_MIGRATION = join(process.cwd(), "..", "supabase", "migrations", "20261003000001_wedding_people_email.sql");

/**
 * A minimal stand-in for Supabase's own `auth` schema: just enough for
 * `auth.uid()`, `auth.users`, and the foreign keys this migration's tables
 * hold against it. Real Supabase provides all of this; PGlite does not.
 */
async function authStub(db: PGlite): Promise<void> {
  await db.exec(`
    create schema if not exists auth;
    -- varchar(255), as Supabase declares it: a stand-in that is looser than
    -- the real table hides exactly the type errors it exists to catch.
    create table auth.users (id uuid primary key, email varchar(255) not null);
    create or replace function auth.uid() returns uuid
      language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  `);
}

async function databaseWith(): Promise<PGlite> {
  const db = await PGlite.create();
  await db.exec("create role anon; create role authenticated;");
  await authStub(db);
  // The sync migration's tables are not used by these tests, but the accounts
  // migration must apply cleanly alongside it, the way Supabase applies every
  // migration file in order against one real database.
  await db.exec(readFileSync(SYNC_MIGRATION, "utf8"));
  await db.exec(readFileSync(ACCOUNTS_MIGRATION, "utf8"));
  await db.exec(readFileSync(DOCUMENTS_MIGRATION, "utf8"));
  // Every test here runs on the schema as it is now: the partner rules the
  // tests above were written for must still hold with roles added.
  await db.exec(readFileSync(ROLES_MIGRATION, "utf8"));
  await db.exec(readFileSync(PEOPLE_EMAIL_MIGRATION, "utf8"));
  return db;
}

let db: PGlite;

/** Insert a fake authenticated user. Only Supabase Auth itself writes this table. */
async function userExists(email: string): Promise<string> {
  const id = crypto.randomUUID();
  // Reset role first: a prior test step may have left the session as
  // `authenticated`, which (correctly, matching real Supabase) has no grants
  // on `auth.users` at all.
  await db.exec("reset role;");
  await db.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);
  return id;
}

async function asUser(id: string): Promise<void> {
  await db.exec("set role authenticated;");
  // `is_local = false` (session-scoped), not `true`: PGlite auto-commits each
  // separate `.query()`/`.exec()` call as its own transaction, so a
  // transaction-local setting made here would not survive into the next call
  // that actually invokes a function reading `auth.uid()`. Real PostgREST
  // wraps one whole HTTP request in a single transaction and uses `true` for
  // exactly that reason; there is no equivalent single transaction spanning
  // these calls here, so this needs to persist for the rest of the session.
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
}

async function asSuperuser(): Promise<void> {
  await db.exec("reset role;");
}

beforeEach(async () => {
  db = await databaseWith();
});

test("a user can create a wedding and becomes its member", async () => {
  const alice = await userExists("alice@example.com");
  await asUser(alice);

  const { rows } = await db.query<{ create_wedding: string }>("select create_wedding()");
  const weddingId = rows[0]?.create_wedding;
  expect(weddingId).toBeTruthy();

  const membership = await db.query("select * from wedding_members where user_id = $1", [alice]);
  expect(membership.rows).toHaveLength(1);
});

test("a user cannot create a second wedding", async () => {
  const alice = await userExists("alice@example.com");
  await asUser(alice);
  await db.query("select create_wedding()");

  await expect(db.query("select create_wedding()")).rejects.toThrow();
});

test("a non-member cannot read someone else's wedding", async () => {
  const alice = await userExists("alice@example.com");
  await asUser(alice);
  const { rows } = await db.query<{ create_wedding: string }>("select create_wedding()");
  const weddingId = rows[0]?.create_wedding;

  const bob = await userExists("bob@example.com");
  await asUser(bob);
  const seen = await db.query("select * from account_weddings where id = $1", [weddingId]);
  expect(seen.rows).toHaveLength(0);
});

test("a full invite-and-accept flow adds the invited user as a member", async () => {
  const alice = await userExists("alice@example.com");
  await asUser(alice);
  const created = await db.query<{ create_wedding: string }>("select create_wedding()");
  const weddingId = created.rows[0]?.create_wedding;

  const invite = await db.query<{ id: string; token: string }>(
    "select * from create_invite($1, $2)",
    [weddingId, "bob@example.com"],
  );
  const token = invite.rows[0]?.token;

  const bob = await userExists("bob@example.com");
  await asUser(bob);
  const accepted = await db.query<{ accepted: boolean; reason: string | null; wedding_id: string }>(
    "select * from accept_invite($1)",
    [token],
  );
  expect(accepted.rows[0]?.accepted).toBe(true);
  expect(accepted.rows[0]?.wedding_id).toBe(weddingId);

  const membership = await db.query("select * from wedding_members where wedding_id = $1", [weddingId]);
  expect(membership.rows).toHaveLength(2);
});

test("accepting with the wrong email is rejected with a specific reason", async () => {
  const alice = await userExists("alice@example.com");
  await asUser(alice);
  const created = await db.query<{ create_wedding: string }>("select create_wedding()");
  const weddingId = created.rows[0]?.create_wedding;
  const invite = await db.query<{ token: string }>("select * from create_invite($1, $2)", [
    weddingId,
    "bob@example.com",
  ]);

  const eve = await userExists("eve@example.com");
  await asUser(eve);
  const result = await db.query<{ accepted: boolean; reason: string }>(
    "select * from accept_invite($1)",
    [invite.rows[0]?.token],
  );
  expect(result.rows[0]?.accepted).toBe(false);
  expect(result.rows[0]?.reason).toBe("wrong-email");
});

test("an unknown token is refused as a normal reason, not an exception", async () => {
  const bob = await userExists("bob@example.com");
  await asUser(bob);

  const result = await db.query<{ accepted: boolean; reason: string; wedding_id: string | null }>(
    "select * from accept_invite($1)",
    ["nosuchtoken"],
  );
  expect(result.rows[0]?.accepted).toBe(false);
  expect(result.rows[0]?.reason).toBe("not-found");
  expect(result.rows[0]?.wedding_id).toBeNull();
});

test("the invitee, who cannot read the invites row at all, still gets its email back", async () => {
  const alice = await userExists("alice@example.com");
  await asUser(alice);
  const created = await db.query<{ create_wedding: string }>("select create_wedding()");
  const invite = await db.query<{ token: string }>("select * from create_invite($1, $2)", [
    created.rows[0]?.create_wedding,
    "bob@example.com",
  ]);
  const token = invite.rows[0]?.token;

  const eve = await userExists("eve@example.com");
  await asUser(eve);
  // RLS hides the row itself — this is exactly why accept_invite has to
  // report `invited_email` for the "sent to someone else" message.
  const direct = await db.query("select * from invites where token = $1", [token]);
  expect(direct.rows).toHaveLength(0);

  const result = await db.query<{ reason: string; invited_email: string }>(
    "select * from accept_invite($1)",
    [token],
  );
  expect(result.rows[0]?.reason).toBe("wrong-email");
  expect(result.rows[0]?.invited_email).toBe("bob@example.com");
});

test("someone who already has their own wedding is refused, not left to a unique violation", async () => {
  const alice = await userExists("alice@example.com");
  await asUser(alice);
  const created = await db.query<{ create_wedding: string }>("select create_wedding()");
  const invite = await db.query<{ token: string }>("select * from create_invite($1, $2)", [
    created.rows[0]?.create_wedding,
    "bob@example.com",
  ]);

  const bob = await userExists("bob@example.com");
  await asUser(bob);
  await db.query("select create_wedding()");

  const result = await db.query<{ accepted: boolean; reason: string }>(
    "select * from accept_invite($1)",
    [invite.rows[0]?.token],
  );
  expect(result.rows[0]?.accepted).toBe(false);
  expect(result.rows[0]?.reason).toBe("already-in-a-wedding");
});

test("deleting a user who sent an invite cascades that invite away", async () => {
  const alice = await userExists("alice@example.com");
  await asUser(alice);
  const created = await db.query<{ create_wedding: string }>("select create_wedding()");
  const weddingId = created.rows[0]?.create_wedding;
  const invite = await db.query<{ token: string }>("select * from create_invite($1, $2)", [
    weddingId,
    "bob@example.com",
  ]);
  const bob = await userExists("bob@example.com");
  await asUser(bob);
  await db.query("select * from accept_invite($1)", [invite.rows[0]?.token]);

  // Alice leaves; the wedding survives for bob, so nothing cascades via
  // `wedding_id` — the invite she created must go via `created_by` instead,
  // or deleting her auth.users row fails on the foreign key.
  await asUser(alice);
  await db.query("select delete_my_account()");
  await asSuperuser();
  await db.query("delete from auth.users where id = $1", [alice]);

  const invites = await db.query("select * from invites where wedding_id = $1", [weddingId]);
  expect(invites.rows).toHaveLength(0);
});

test("a third invite is refused once the wedding already has two members", async () => {
  const alice = await userExists("alice@example.com");
  await asUser(alice);
  const created = await db.query<{ create_wedding: string }>("select create_wedding()");
  const weddingId = created.rows[0]?.create_wedding;
  const firstInvite = await db.query<{ token: string }>("select * from create_invite($1, $2)", [
    weddingId,
    "bob@example.com",
  ]);
  const bob = await userExists("bob@example.com");
  await asUser(bob);
  await db.query("select * from accept_invite($1)", [firstInvite.rows[0]?.token]);

  await asUser(alice);
  await expect(
    db.query("select * from create_invite($1, $2)", [weddingId, "carol@example.com"]),
  ).rejects.toThrow();
});

test("deleting the last member removes the wedding entirely", async () => {
  const alice = await userExists("alice@example.com");
  await asUser(alice);
  const created = await db.query<{ create_wedding: string }>("select create_wedding()");
  const weddingId = created.rows[0]?.create_wedding;

  await db.query("select delete_my_account()");

  await asSuperuser();
  const remaining = await db.query("select * from account_weddings where id = $1", [weddingId]);
  expect(remaining.rows).toHaveLength(0);
});

test("deleting one of two members leaves the wedding intact for the other", async () => {
  const alice = await userExists("alice@example.com");
  await asUser(alice);
  const created = await db.query<{ create_wedding: string }>("select create_wedding()");
  const weddingId = created.rows[0]?.create_wedding;
  const invite = await db.query<{ token: string }>("select * from create_invite($1, $2)", [
    weddingId,
    "bob@example.com",
  ]);
  const bob = await userExists("bob@example.com");
  await asUser(bob);
  await db.query("select * from accept_invite($1)", [invite.rows[0]?.token]);

  await db.query("select delete_my_account()"); // bob leaves

  await asUser(alice);
  const stillThere = await db.query("select * from account_weddings where id = $1", [weddingId]);
  expect(stillThere.rows).toHaveLength(1);
});

// Roles ---------------------------------------------------------------------

async function newWedding(role: "partner" | "planner" = "partner"): Promise<string> {
  const { rows } = await db.query<{ create_wedding: string }>("select create_wedding($1)", [role]);
  return rows[0]!.create_wedding;
}

async function invite(weddingId: string, email: string, role: "partner" | "planner"): Promise<string> {
  const { rows } = await db.query<{ token: string }>("select * from create_invite($1, $2, $3)", [weddingId, email, role]);
  return rows[0]!.token;
}

async function accept(token: string): Promise<{ accepted: boolean; reason: string | null }> {
  const { rows } = await db.query<{ accepted: boolean; reason: string | null }>("select * from accept_invite($1)", [token]);
  return rows[0]!;
}

test("a planner can start a wedding for each of their clients", async () => {
  const pat = await userExists("pat@planners.example");
  await asUser(pat);
  await newWedding("planner");
  await newWedding("planner");
  await newWedding("planner");
  const { rows } = await db.query("select * from wedding_members where user_id = $1 and role = 'planner'", [pat]);
  expect(rows).toHaveLength(3);
});

test("one of a couple can also plan other people's weddings, but has only one of their own", async () => {
  const alice = await userExists("alice@example.com");
  await asUser(alice);
  await newWedding("partner");
  await newWedding("planner");
  await expect(newWedding("partner")).rejects.toThrow();
});

test("a wedding takes two partners and one planner, and no more", async () => {
  const alice = await userExists("alice@example.com");
  await asUser(alice);
  const wedding = await newWedding("partner");
  const toBob = await invite(wedding, "bob@example.com", "partner");
  const toPat = await invite(wedding, "pat@planners.example", "planner");

  await expect(invite(wedding, "quinn@planners.example", "planner")).resolves.toBeTruthy();

  const bob = await userExists("bob@example.com");
  await asUser(bob);
  expect(await accept(toBob)).toMatchObject({ accepted: true });
  const pat = await userExists("pat@planners.example");
  await asUser(pat);
  expect(await accept(toPat)).toMatchObject({ accepted: true });

  await asUser(alice);
  await expect(invite(wedding, "carol@example.com", "partner")).rejects.toThrow(/two partners/);
  await expect(invite(wedding, "quinn@planners.example", "planner")).rejects.toThrow(/a planner/);
});

test("a second planner invite sent before the first was accepted finds the place taken", async () => {
  const alice = await userExists("alice@example.com");
  await asUser(alice);
  const wedding = await newWedding("partner");
  const toPat = await invite(wedding, "pat@planners.example", "planner");
  const toQuinn = await invite(wedding, "quinn@planners.example", "planner");

  const pat = await userExists("pat@planners.example");
  await asUser(pat);
  expect(await accept(toPat)).toMatchObject({ accepted: true });
  const quinn = await userExists("quinn@planners.example");
  await asUser(quinn);
  expect(await accept(toQuinn)).toMatchObject({ accepted: false, reason: "wedding-full" });
});

test("a planner already in other weddings can join another; one of a couple cannot join a second as a partner", async () => {
  const pat = await userExists("pat@planners.example");
  await asUser(pat);
  await newWedding("planner");

  const alice = await userExists("alice@example.com");
  await asUser(alice);
  const wedding = await newWedding("partner");
  const toPat = await invite(wedding, "pat@planners.example", "planner");
  const toBob = await invite(wedding, "bob@example.com", "partner");

  await asUser(pat);
  expect(await accept(toPat)).toMatchObject({ accepted: true });

  const bob = await userExists("bob@example.com");
  await asUser(bob);
  await newWedding("partner");
  expect(await accept(toBob)).toMatchObject({ accepted: false, reason: "already-in-a-wedding" });
});

test("someone already on the wedding is told so, not added twice", async () => {
  const alice = await userExists("alice@example.com");
  await asUser(alice);
  const wedding = await newWedding("partner");
  const toAlice = await invite(wedding, "alice@example.com", "planner");
  expect(await accept(toAlice)).toMatchObject({ accepted: false, reason: "already-a-member" });
});

test("the couple can remove their planner, who then cannot read the wedding at all", async () => {
  const alice = await userExists("alice@example.com");
  await asUser(alice);
  const wedding = await newWedding("partner");
  await db.query("select * from save_wedding_document($1, $2, 0)", [wedding, JSON.stringify({ guests: { g1: {} } })]);
  const toPat = await invite(wedding, "pat@planners.example", "planner");
  const pat = await userExists("pat@planners.example");
  await asUser(pat);
  await accept(toPat);
  expect((await db.query("select * from wedding_documents where wedding_id = $1", [wedding])).rows).toHaveLength(1);

  await asUser(alice);
  await db.query("select remove_member($1, $2)", [wedding, pat]);

  await asUser(pat);
  expect((await db.query("select * from wedding_documents where wedding_id = $1", [wedding])).rows).toHaveLength(0);
  await expect(db.query("select * from save_wedding_document($1, $2, 1)", [wedding, "{}"])).rejects.toThrow();
});

test("a planner cannot remove one of the couple", async () => {
  const alice = await userExists("alice@example.com");
  await asUser(alice);
  const wedding = await newWedding("partner");
  const toPat = await invite(wedding, "pat@planners.example", "planner");
  const pat = await userExists("pat@planners.example");
  await asUser(pat);
  await accept(toPat);

  await expect(db.query("select remove_member($1, $2)", [wedding, alice])).rejects.toThrow(/only the couple/);
});

test("a planner can leave a client's wedding, and the last one out takes the wedding with them", async () => {
  const pat = await userExists("pat@planners.example");
  await asUser(pat);
  const wedding = await newWedding("planner");
  await db.query("select remove_member($1, $2)", [wedding, pat]);
  await asSuperuser();
  expect((await db.query("select * from account_weddings where id = $1", [wedding])).rows).toHaveLength(0);
});

test("who has access is listed with addresses and roles, for members only", async () => {
  const alice = await userExists("alice@example.com");
  await asUser(alice);
  const wedding = await newWedding("partner");
  const toPat = await invite(wedding, "pat@planners.example", "planner");
  const pat = await userExists("pat@planners.example");
  await asUser(pat);
  await accept(toPat);

  const { rows } = await db.query<{ email: string; role: string }>("select email, role from wedding_people($1)", [wedding]);
  expect(rows).toEqual([
    { email: "alice@example.com", role: "partner" },
    { email: "pat@planners.example", role: "planner" },
  ]);

  const eve = await userExists("eve@example.com");
  await asUser(eve);
  await expect(db.query("select * from wedding_people($1)", [wedding])).rejects.toThrow(/not a member/);
});

test("deleting a planner's account leaves each client's wedding with its couple, and removes the planner's own", async () => {
  const alice = await userExists("alice@example.com");
  await asUser(alice);
  const clients = await newWedding("partner");
  const toPat = await invite(clients, "pat@planners.example", "planner");
  const pat = await userExists("pat@planners.example");
  await asUser(pat);
  await accept(toPat);
  const started = await newWedding("planner");

  await db.query("select delete_my_account()");

  await asSuperuser();
  const left = await db.query<{ id: string }>("select id from account_weddings where id = any($1)", [[clients, started]]);
  expect(left.rows.map((row) => row.id)).toEqual([clients]);
});
