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

const publish = (wedding: string, key: string, ciphertext: string) =>
  db.query<{ token: string }>("select * from publish_share($1, $2, false, $3, 'iv', 'fp')", [wedding, key, ciphertext]);

test("a member publishes without any passphrase, and a guest reads only the sealed snapshot by its token", async () => {
  const { wedding } = await coupleWithWedding();
  const { rows } = await publish(wedding, "key-1", "sealed-1");
  const token = rows[0]!.token;
  expect(token).toMatch(/^[0-9a-f]{32}$/);

  await actAs(db, null);
  const read = await db.query("select * from read_share($1)", [token]);
  expect(read.rows).toEqual([{ ciphertext: "sealed-1", iv: "iv" }]);
  // Nothing else is open to a guest: not the row, not its key.
  await expect(db.query("select * from wedding_shares")).rejects.toThrow();
});

test("republishing keeps the token and key every guest's link carries", async () => {
  const { wedding } = await coupleWithWedding();
  const first = (await publish(wedding, "key-1", "sealed-1")).rows[0]!.token;
  const again = (await publish(wedding, "key-1", "sealed-2")).rows[0]!.token;
  expect(again).toBe(first);

  await actAs(db, null);
  expect((await db.query("select ciphertext from read_share($1)", [first])).rows).toEqual([{ ciphertext: "sealed-2" }]);
});

test("a republish sealed with another key changes nothing, rather than breaking every link", async () => {
  const { wedding } = await coupleWithWedding();
  const token = (await publish(wedding, "key-1", "sealed-1")).rows[0]!.token;
  expect((await publish(wedding, "key-2", "sealed-with-2")).rows).toEqual([]);

  await actAs(db, null);
  expect((await db.query("select ciphertext from read_share($1)", [token])).rows).toEqual([{ ciphertext: "sealed-1" }]);
});

test("members read the key to republish; nobody else can publish or read it", async () => {
  const { wedding } = await coupleWithWedding();
  await publish(wedding, "key-1", "sealed-1");
  expect((await db.query("select share_key from wedding_shares")).rows).toEqual([{ share_key: "key-1" }]);

  const eve = await userExists(db, "eve@example.com");
  await actAs(db, eve);
  expect((await db.query("select * from wedding_shares")).rows).toEqual([]);
  await expect(publish(wedding, "key-1", "defaced")).rejects.toThrow(/not a member/);
  await expect(db.query("select take_down_share($1)", [wedding])).rejects.toThrow(/not a member/);
});

test("taking it down stops every copy of the link at once", async () => {
  const { wedding } = await coupleWithWedding();
  const token = (await publish(wedding, "key-1", "sealed-1")).rows[0]!.token;
  await db.query("select take_down_share($1)", [wedding]);
  await actAs(db, null);
  expect((await db.query("select * from read_share($1)", [token])).rows).toEqual([]);
});

test("the passphrase sync's tables are gone", async () => {
  await actAs(db, null);
  await db.exec("reset role;");
  const { rows } = await db.query<{ table_name: string }>(
    "select table_name from information_schema.tables where table_schema = 'public' and table_name in ('weddings','slices','shares','blobs')",
  );
  expect(rows).toEqual([]);
});
