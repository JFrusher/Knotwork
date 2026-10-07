// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { actAs, everyMigration, userExists } from "@/lib/testing/database";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

let db: PGlite;
beforeEach(async () => {
  db = await everyMigration();
});
afterEach(async () => {
  await db.close();
});

/** Alice's wedding, on `date` ("" for none). Leaves the session as Alice. */
async function weddingOn(date: string): Promise<{ alice: string; wedding: string }> {
  const alice = await userExists(db, "alice@example.com");
  await actAs(db, alice);
  const { rows } = await db.query<{ create_wedding: string }>("select create_wedding('partner')");
  const wedding = rows[0]!.create_wedding;
  await db.query("select * from save_wedding_document($1, $2, 0)", [wedding, JSON.stringify({ event: { date } })]);
  return { alice, wedding };
}

/** `days` from today, UTC, as the document stores a date. */
const day = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const publish = (wedding: string, person: string, key: string, sealed: string) =>
  db.query<{ token: string }>("select * from publish_helper_link($1, $2, $3, $4, 'iv', 'fp')", [wedding, person, key, sealed]);
const read = (token: string) => db.query<{ ciphertext: string }>("select * from read_helper_link($1)", [token]);

test("a member publishes each helper's sheet; the helper reads only theirs, by its token", async () => {
  const { wedding } = await weddingOn(day(30));
  const ines = (await publish(wedding, "per-ines", "key-1", "sealed-ines")).rows[0]!.token;
  const tom = (await publish(wedding, "per-tom", "key-2", "sealed-tom")).rows[0]!.token;
  expect(ines).not.toBe(tom);

  await actAs(db, null);
  expect((await read(ines)).rows).toMatchObject([{ ciphertext: "sealed-ines" }]);
  // Not the table, and so not the key or anyone else's sheet.
  await expect(db.query("select * from helper_links")).rejects.toThrow();
});

test("taking one helper's link down leaves the others working", async () => {
  const { wedding } = await weddingOn(day(30));
  const ines = (await publish(wedding, "per-ines", "key-1", "sealed-ines")).rows[0]!.token;
  const tom = (await publish(wedding, "per-tom", "key-2", "sealed-tom")).rows[0]!.token;
  await db.query("select take_down_helper_link($1, 'per-ines')", [wedding]);

  await actAs(db, null);
  expect((await read(ines)).rows).toEqual([]);
  expect((await read(tom)).rows).toHaveLength(1);
});

test("a republish keeps the token; under another key it changes nothing; nobody else can publish or take one down", async () => {
  const { wedding } = await weddingOn(day(30));
  const token = (await publish(wedding, "per-ines", "key-1", "sealed-1")).rows[0]!.token;
  expect((await publish(wedding, "per-ines", "key-1", "sealed-2")).rows[0]!.token).toBe(token);
  expect((await publish(wedding, "per-ines", "key-2", "sealed-other")).rows).toEqual([]);

  const mallory = await userExists(db, "mallory@example.com");
  await actAs(db, mallory);
  await expect(publish(wedding, "per-ines", "key-1", "sealed-by-mallory")).rejects.toThrow();
  await expect(db.query("select take_down_helper_link($1, 'per-ines')", [wedding])).rejects.toThrow();
  await actAs(db, null);
  expect((await read(token)).rows).toMatchObject([{ ciphertext: "sealed-2" }]);
});

test("a link ends when the day after the wedding has ended at UTC+14", async () => {
  const { rows } = await db.query<{ ends: Date }>("select helper_links_end('2028-06-01') as ends");
  expect(rows[0]!.ends.toISOString()).toBe("2028-06-02T10:00:00.000Z");
});

test("a link reads until it ends, and not after; with no date, until it is taken down", async () => {
  const today = await weddingOn(day(0));
  const live = (await publish(today.wedding, "per-ines", "key-1", "sealed")).rows[0]!.token;

  const bob = await userExists(db, "bob@example.com");
  await actAs(db, bob);
  const past = (await db.query<{ create_wedding: string }>("select create_wedding('partner')")).rows[0]!.create_wedding;
  await db.query("select * from save_wedding_document($1, $2, 0)", [past, JSON.stringify({ event: { date: day(-2) } })]);
  const expired = (await publish(past, "per-ines", "key-1", "sealed")).rows[0]!.token;

  const carol = await userExists(db, "carol@example.com");
  await actAs(db, carol);
  const undated = (await db.query<{ create_wedding: string }>("select create_wedding('partner')")).rows[0]!.create_wedding;
  await db.query("select * from save_wedding_document($1, $2, 0)", [undated, JSON.stringify({ event: { date: "" } })]);
  const forever = (await publish(undated, "per-ines", "key-1", "sealed")).rows[0]!.token;

  await actAs(db, null);
  expect((await read(live)).rows).toHaveLength(1);
  expect((await read(expired)).rows).toEqual([]);
  expect((await read(forever)).rows).toHaveLength(1);
});

test("the sweep deletes only the links that have run out", async () => {
  const today = await weddingOn(day(0));
  await publish(today.wedding, "per-ines", "key-1", "sealed");
  const bob = await userExists(db, "bob@example.com");
  await actAs(db, bob);
  const past = (await db.query<{ create_wedding: string }>("select create_wedding('partner')")).rows[0]!.create_wedding;
  await db.query("select * from save_wedding_document($1, $2, 0)", [past, JSON.stringify({ event: { date: day(-2) } })]);
  await publish(past, "per-ines", "key-1", "sealed");

  await expect(db.query("select sweep_helper_links()")).rejects.toThrow();
  await actAs(db, null);
  await db.exec("reset role;");
  expect((await db.query<{ sweep_helper_links: number }>("select sweep_helper_links()")).rows[0]!.sweep_helper_links).toBe(1);
  expect((await db.query<{ wedding_id: string }>("select wedding_id from helper_links")).rows.map((row) => row.wedding_id)).toEqual([today.wedding]);
});

test("a wedding deleted with its last member's account takes its helpers' links with it", async () => {
  const { wedding } = await weddingOn(day(30));
  const token = (await publish(wedding, "per-ines", "key-1", "sealed")).rows[0]!.token;
  await db.query("select delete_my_account()");
  await actAs(db, null);
  expect((await read(token)).rows).toEqual([]);
});


test("an impossible wedding date neither expires a link nor breaks reads and sweeps", async () => {
  const { wedding } = await weddingOn("2028-02-30");
  const token = (await publish(wedding, "per-ines", "key-1", "sealed")).rows[0]!.token;
  await actAs(db, null);
  expect((await read(token)).rows).toHaveLength(1);
  await db.exec("reset role");
  expect((await db.query("select helper_link_date('2028-02-30') as date, helper_links_expired($1) as expired", [wedding])).rows).toEqual([{ date: null, expired: false }]);
  expect((await db.query("select sweep_helper_links() as swept")).rows).toEqual([{ swept: 0 }]);
});

test("only the helper reader's intended client roles have execution access", async () => {
  await db.exec("create role unrelated_client");
  const { rows } = await db.query("select has_function_privilege('anon', 'read_helper_link(text)', 'execute') as anon, has_function_privilege('authenticated', 'read_helper_link(text)', 'execute') as authenticated, has_function_privilege('unrelated_client', 'read_helper_link(text)', 'execute') as unrelated");
  expect(rows).toEqual([{ anon: true, authenticated: true, unrelated: false }]);
});
