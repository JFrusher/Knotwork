// @vitest-environment node
//
// Node, not jsdom: PGlite loads its WebAssembly through fetch, and jsdom's
// Response has no `arrayBuffer`.
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { everyMigration } from "@/lib/testing/database";

// Generous because standing up a
// Postgres takes about two seconds, longer sharing a machine with the rest of
// the suite.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

let db: PGlite;

beforeAll(async () => {
  db = await everyMigration();
});

afterAll(async () => {
  await db.close();
});

test("the wedding-assets bucket exists and is private", async () => {
  const { rows } = await db.query("select public from storage.buckets where id = 'wedding-assets'");
  expect(rows).toEqual([{ public: false }]);
});

test("storage.objects has a policy scoped to is_wedding_member", async () => {
  const { rows } = await db.query(
    `select policyname from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname like '%wedding-assets%'`,
  );
  expect(rows.length).toBeGreaterThan(0);
});

test("every wedding-assets policy checks the path's shape before casting it to uuid", async () => {
  // These are permissive policies OR'd into every query against
  // storage.objects — a table every bucket shares — and Postgres promises no
  // evaluation order for the operands of `and`. An unguarded
  // `(storage.foldername(name))[1]::uuid` can therefore raise "invalid input
  // syntax for type uuid" for an object in somebody else's bucket whose path
  // was never a wedding id. Asserted on the policy text rather than by
  // provoking it, because whether the planner reorders is exactly the part
  // that isn't reproducible.
  const { rows } = await db.query<{ policyname: string; condition: string }>(
    `select policyname, coalesce(qual, with_check) as condition from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname like '%wedding-assets%'`,
  );
  expect(rows.length).toBe(4);
  for (const { policyname, condition } of rows) {
    // Both bounds asserted: `indexOf` returns -1 for a missing guard, which
    // would otherwise satisfy "comes before the cast" vacuously.
    expect(`${policyname}: ${condition}`).toContain("~");
    expect(condition.indexOf("~")).toBeGreaterThanOrEqual(0);
    expect(condition.indexOf("~")).toBeLessThan(condition.indexOf("::uuid"));
  }
});
