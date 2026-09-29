// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { actAs, everyMigration, userExists } from "@/lib/testing/database";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

/**
 * A wedding's live channel, as the database decides it: what a save
 * announces, and who may follow a wedding's channel or say they are there.
 */

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

const save = (wedding: string, document: unknown, expected: number) =>
  db.query("select * from save_wedding_document($1, $2, $3)", [wedding, JSON.stringify(document), expected]);

/** The messages the caller would receive on `topic`. */
async function follow(topic: string): Promise<Array<{ event: string | null; payload: unknown }>> {
  await db.query("select set_config('realtime.topic', $1, false)", [topic]);
  return (await db.query<{ event: string | null; payload: unknown }>("select event, payload from realtime.messages order by id")).rows;
}

const saying = (topic: string, extension: string) =>
  db
    .query("select set_config('realtime.topic', $1, false)", [topic])
    .then(() => db.query("insert into realtime.messages (topic, extension, payload) values ($1, $2, '{}')", [topic, extension]));

test("a save announces its version, and nothing of the wedding itself", async () => {
  const { wedding } = await coupleWithWedding();
  const document = { guests: { g1: { id: "g1", firstName: "Eleanor", lastName: "Vane" } } };
  await save(wedding, document, 0);
  await save(wedding, document, 1);

  const heard = await follow(`wedding:${wedding}`);
  expect(heard).toEqual([
    { event: "moved", payload: { version: 1 } },
    { event: "moved", payload: { version: 2 } },
  ]);
});

test("a refused save announces nothing", async () => {
  const { wedding } = await coupleWithWedding();
  await save(wedding, {}, 0);
  await save(wedding, {}, 0);
  expect(await follow(`wedding:${wedding}`)).toHaveLength(1);
});

test("only a wedding's members follow its channel", async () => {
  const { wedding } = await coupleWithWedding();
  await save(wedding, {}, 0);

  const mallory = await userExists(db, "mallory@example.com");
  await actAs(db, mallory);
  expect(await follow(`wedding:${wedding}`)).toEqual([]);
  // Not a wedding's channel at all: refused, rather than an error.
  expect(await follow("wedding:not-a-wedding")).toEqual([]);
  expect(await follow("lobby")).toEqual([]);

  await actAs(db, null);
  await expect(follow(`wedding:${wedding}`)).rejects.toThrow();
});

test("a member may say they are there, but not announce a save", async () => {
  const { alice, wedding } = await coupleWithWedding();
  const topic = `wedding:${wedding}`;
  await expect(saying(topic, "presence")).resolves.toBeDefined();
  await expect(saying(topic, "broadcast")).rejects.toThrow();

  const mallory = await userExists(db, "mallory@example.com");
  await actAs(db, mallory);
  await expect(saying(topic, "presence")).rejects.toThrow();

  await actAs(db, alice);
  expect((await follow(topic)).length).toBe(1);
});
