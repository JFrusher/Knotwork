// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, expect, test, vi } from "vitest";
import { actAs, everyMigration, userExists } from "@/lib/testing/database";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

let db: PGlite;
beforeEach(async () => {
  db = await everyMigration();
});

async function weddingOf(user: string): Promise<string> {
  await actAs(db, user);
  return (await db.query<{ create_wedding: string }>("select public.create_wedding()")).rows[0]!.create_wedding;
}

async function save(wedding: string, names: string, expected: number): Promise<void> {
  await db.query("select * from public.save_wedding_document($1, $2::jsonb, $3)", [wedding, JSON.stringify({ event: { coupleNames: names } }), expected]);
}

async function entries(wedding: string) {
  await db.exec("reset role;");
  return (
    await db.query<{ names: string; saved_by: string }>(
      "select document->'event'->>'coupleNames' as names, saved_by from public.wedding_document_history where wedding_id = $1 order by saved_at",
      [wedding],
    )
  ).rows;
}

test("one person's saves within ten minutes are one entry in the history, holding the latest", async () => {
  const alex = await userExists(db, "alex@example.com");
  const wedding = await weddingOf(alex);
  await save(wedding, "v1", 0);
  await save(wedding, "v2", 1);
  await save(wedding, "v3", 2);
  expect((await entries(wedding)).map((entry) => entry.names)).toEqual(["v3"]);
});

test("the other partner's save, or a save ten minutes on, starts a new entry", async () => {
  const alex = await userExists(db, "alex@example.com");
  const wedding = await weddingOf(alex);
  const invite = await db.query<{ token: string }>("select * from public.create_invite($1, 'sam@example.com')", [wedding]);
  const sam = await userExists(db, "sam@example.com");
  await actAs(db, sam);
  await db.query("select * from public.accept_invite($1)", [invite.rows[0]!.token]);

  await actAs(db, alex);
  await save(wedding, "alex's", 0);
  await actAs(db, sam);
  await save(wedding, "sam's", 1);
  // Alex again: the latest entry is Sam's, so Alex's first is left as it was.
  await actAs(db, alex);
  await save(wedding, "alex's again", 2);
  expect((await entries(wedding)).map((entry) => entry.names)).toEqual(["alex's", "sam's", "alex's again"]);

  // Eleven minutes after Alex opened the latest entry, a save opens another.
  await db.query("update public.wedding_document_history set opened_at = opened_at - interval '11 minutes' where wedding_id = $1", [wedding]);
  await actAs(db, alex);
  await save(wedding, "later", 3);
  expect((await entries(wedding)).map((entry) => entry.names)).toEqual(["alex's", "sam's", "alex's again", "later"]);
});

test("beyond 30 days a wedding keeps the last entry of each day, thinned when a new entry is opened", async () => {
  const alex = await userExists(db, "alex@example.com");
  const wedding = await weddingOf(alex);
  await save(wedding, "first", 0);
  await db.exec("reset role;");
  const old = (days: number, hour: number, names: string) =>
    db.query(
      `insert into public.wedding_document_history (wedding_id, document, saved_at, saved_by, opened_at)
       values ($1, $2::jsonb, date_trunc('day', now()) - make_interval(days => $3) + make_interval(hours => $4), $5,
               date_trunc('day', now()) - make_interval(days => $3) + make_interval(hours => $4))`,
      [wedding, JSON.stringify({ event: { coupleNames: names } }), days, hour, alex],
    );
  await old(40, 9, "40 days ago, morning");
  await old(40, 18, "40 days ago, evening");
  await old(35, 10, "35 days ago, only");
  await old(10, 9, "10 days ago, morning");
  await old(10, 18, "10 days ago, evening");
  await db.query("update public.wedding_document_history set opened_at = opened_at - interval '11 minutes' where document->'event'->>'coupleNames' = 'first'");

  await actAs(db, alex);
  await save(wedding, "today", 1);
  expect((await entries(wedding)).map((entry) => entry.names)).toEqual([
    "40 days ago, evening",
    "35 days ago, only",
    "10 days ago, morning",
    "10 days ago, evening",
    "first",
    "today",
  ]);
});

test("the history is indexed for its panel, for deleting a wedding and for deleting an account", async () => {
  const indexes = await db.query<{ indexdef: string }>("select indexdef from pg_indexes where tablename = 'wedding_document_history'");
  const defs = indexes.rows.map((row) => row.indexdef);
  expect(defs.some((def) => def.includes("(wedding_id, saved_at DESC)"))).toBe(true);
  expect(defs.some((def) => def.includes("(saved_by)"))).toBe(true);
});

test("removing a member refuses a caller with no session, and the wedding stays", async () => {
  const alex = await userExists(db, "alex@example.com");
  const wedding = await weddingOf(alex);
  // The function itself, apart from who may call it: run as its owner, with no session.
  await db.exec("reset role;");
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
  await expect(db.query("select public.remove_member($1, $2)", [wedding, alex])).rejects.toThrow("sign in first");
  expect((await db.query("select 1 from public.account_weddings where id = $1", [wedding])).rows).toHaveLength(1);
});

test("with Supabase's default grants, nobody signed out may call a function meant for signed-in people", async () => {
  await db.exec("reset role;");
  // A Supabase project grants new functions to anon by default privileges,
  // which `revoke … from public` does not undo. Stand that in, then apply the fix again.
  await db.exec("grant execute on all functions in schema public to anon, authenticated;");
  await db.exec(readFileSync(join(process.cwd(), "..", "supabase", "migrations", "20260929000008_signed_in_callers.sql"), "utf8"));
  await db.exec(readFileSync(join(process.cwd(), "..", "supabase", "migrations", "20260929000007_bounded_history.sql"), "utf8"));

  const can = async (role: string, fn: string) =>
    (await db.query<{ ok: boolean }>("select has_function_privilege($1, $2, 'execute') as ok", [role, fn])).rows[0]!.ok;
  for (const fn of [
    "public.remove_member(uuid,uuid)",
    "public.save_wedding_document(uuid,jsonb,integer)",
    "public.create_wedding(text)",
    "public.create_invite(uuid,text,text)",
    "public.accept_invite(text)",
    "public.delete_my_account()",
    "public.wedding_people(uuid)",
    "public.publish_share(uuid,text,boolean,text,text,text)",
    "public.take_down_share(uuid)",
    "public.publish_supplier_link(uuid,text,text,text,text,text)",
    "public.take_down_supplier_link(uuid,text)",
    "public.wedding_role_count(uuid,text)",
  ]) {
    expect(await can("anon", fn), fn).toBe(false);
  }
  expect(await can("authenticated", "public.wedding_role_count(uuid,text)")).toBe(false);
  expect(await can("authenticated", "public.remove_member(uuid,uuid)")).toBe(true);
  // A link is for anyone who has it.
  expect(await can("anon", "public.read_share(text)")).toBe(true);
  expect(await can("anon", "public.confirm_supplier_link(text)")).toBe(true);
});
