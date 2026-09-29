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

const save = (owner: string, name = "Summer day") =>
  db.query<{ id: string }>("insert into library_items (owner, kind, name, content) values ($1, 'day', $2, '{}') returning id", [owner, name]);

test("a planner keeps a design and nobody else can see it, take it or add to their library", async () => {
  const planner = await userExists(db, "planner@example.com");
  const other = await userExists(db, "other@example.com");

  await actAs(db, planner);
  const id = (await save(planner)).rows[0]!.id;
  expect((await db.query("select name from library_items")).rows).toEqual([{ name: "Summer day" }]);

  await actAs(db, other);
  expect((await db.query("select * from library_items")).rows).toEqual([]);
  expect((await db.query("delete from library_items where id = $1", [id])).affectedRows).toBe(0);
  // Not into someone else's library, either.
  await expect(save(planner)).rejects.toThrow();

  await actAs(db, null);
  await expect(db.query("select * from library_items")).rejects.toThrow();

  await actAs(db, planner);
  expect((await db.query("select count(*)::int as n from library_items")).rows).toEqual([{ n: 1 }]);
});

test("a saved design is removed, never edited in place", async () => {
  const planner = await userExists(db, "planner@example.com");
  await actAs(db, planner);
  const id = (await save(planner)).rows[0]!.id;
  await expect(db.query("update library_items set name = 'Changed' where id = $1", [id])).rejects.toThrow();
  expect((await db.query("delete from library_items where id = $1", [id])).affectedRows).toBe(1);
});

test("a name is required, and only the four kinds are kept", async () => {
  const planner = await userExists(db, "planner@example.com");
  await actAs(db, planner);
  await expect(save(planner, "")).rejects.toThrow();
  await expect(
    db.query("insert into library_items (owner, kind, name, content) values ($1, 'guests', 'All of them', '{}')", [planner]),
  ).rejects.toThrow();
});
