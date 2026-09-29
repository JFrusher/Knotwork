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

async function coupleWithWedding(): Promise<{ alice: string; wedding: string }> {
  const alice = await userExists(db, "alice@example.com");
  await actAs(db, alice);
  const { rows } = await db.query<{ create_wedding: string }>("select create_wedding('partner')");
  return { alice, wedding: rows[0]!.create_wedding };
}

const publish = (wedding: string, team: string, key: string, sealed: string) =>
  db.query<{ token: string }>("select * from publish_supplier_link($1, $2, $3, $4, 'iv', 'fp')", [wedding, team, key, sealed]);

test("a member publishes each supplier's sheet; the supplier reads only theirs, by its token", async () => {
  const { wedding } = await coupleWithWedding();
  const florist = (await publish(wedding, "team-florist", "key-1", "sealed-florist")).rows[0]!.token;
  const band = (await publish(wedding, "team-band", "key-2", "sealed-band")).rows[0]!.token;
  expect(florist).not.toBe(band);

  await actAs(db, null);
  const read = await db.query<{ ciphertext: string; confirmed_at: string | null }>("select * from read_supplier_link($1)", [florist]);
  expect(read.rows).toMatchObject([{ ciphertext: "sealed-florist", confirmed_at: null }]);
  // Not the table, and so not the key or anyone else's sheet.
  await expect(db.query("select * from supplier_links")).rejects.toThrow();
});

test("a supplier confirms through their link, and a republish keeps the confirmation and the token", async () => {
  const { alice, wedding } = await coupleWithWedding();
  const token = (await publish(wedding, "team-florist", "key-1", "sealed-1")).rows[0]!.token;

  await actAs(db, null);
  const confirmed = await db.query<{ confirm_supplier_link: string | null }>("select confirm_supplier_link($1)", [token]);
  expect(confirmed.rows[0]!.confirm_supplier_link).not.toBeNull();
  expect((await db.query<{ confirm_supplier_link: string | null }>("select confirm_supplier_link('nosuchtoken')")).rows[0]!.confirm_supplier_link).toBeNull();

  await actAs(db, alice);
  expect((await publish(wedding, "team-florist", "key-1", "sealed-2")).rows[0]!.token).toBe(token);
  const members = await db.query<{ confirmed_at: string | null }>("select confirmed_at from supplier_links");
  expect(members.rows[0]!.confirmed_at).not.toBeNull();
});

test("a republish under another key changes nothing; nobody else can publish, read or take one down", async () => {
  const { wedding } = await coupleWithWedding();
  await publish(wedding, "team-florist", "key-1", "sealed-1");
  expect((await publish(wedding, "team-florist", "key-2", "sealed-other")).rows).toEqual([]);

  const mallory = await userExists(db, "mallory@example.com");
  await actAs(db, mallory);
  await expect(publish(wedding, "team-florist", "key-1", "sealed-by-mallory")).rejects.toThrow();
  await expect(db.query("select take_down_supplier_link($1, 'team-florist')", [wedding])).rejects.toThrow();
  expect((await db.query("select * from supplier_links")).rows).toEqual([]);
});

test("a wedding deleted with its last member's account takes its suppliers' links with it", async () => {
  const { wedding } = await coupleWithWedding();
  const token = (await publish(wedding, "team-florist", "key-1", "sealed-1")).rows[0]!.token;

  await db.query("select delete_my_account()");
  await actAs(db, null);
  expect((await db.query("select * from read_supplier_link($1)", [token])).rows).toEqual([]);
});
