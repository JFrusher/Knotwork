import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

/**
 * A Postgres with every migration applied, in the order Supabase applies
 * them, over just enough of Supabase's own `auth` and `storage` schemas for
 * them to run. For tests that need the database as it is now, not as one
 * migration left it.
 */
export async function everyMigration(): Promise<PGlite> {
  const db = await PGlite.create();
  await db.exec("create role anon; create role authenticated;");
  await db.exec(`
    create schema if not exists auth;
    create table if not exists auth.users (id uuid primary key, email text not null);
    create or replace function auth.uid() returns uuid
      language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create schema if not exists storage;
    create table if not exists storage.buckets (id text primary key, name text not null, public boolean not null default false);
    create table if not exists storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets (id),
      name text not null
    );
    create or replace function storage.foldername(name text) returns text[]
      language sql immutable
      as $$ select string_to_array(name, '/') $$;
  `);
  const dir = join(process.cwd(), "..", "supabase", "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }
  return db;
}

/** A signed-up user. Only Supabase Auth writes this table. */
export async function userExists(db: PGlite, email: string): Promise<string> {
  const id = crypto.randomUUID();
  await db.exec("reset role;");
  await db.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);
  return id;
}

/** Act as a signed-in user — or, with null, as nobody (`anon`). */
export async function actAs(db: PGlite, id: string | null): Promise<void> {
  await db.exec(id ? "set role authenticated;" : "set role anon;");
  // Session-scoped: PGlite commits each call separately. See
  // lib/accounts/migrations.test.ts.
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? ""]);
}
