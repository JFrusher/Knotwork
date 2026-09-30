import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

/**
 * A Postgres with every migration applied, in the order Supabase applies
 * them, over just enough of Supabase's own `auth`, `storage` and `realtime` schemas for
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
    grant usage on schema auth to anon, authenticated;
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
    -- Realtime's channel authorisation, as Supabase keeps it: a message table
    -- whose row-level security decides who may join a topic, the topic being
    -- joined read from a setting, and send() writing an announcement into it.
    create schema if not exists realtime;
    create table if not exists realtime.messages (
      id bigserial primary key,
      topic text not null,
      extension text not null,
      event text,
      payload jsonb,
      private boolean not null default true
    );
    alter table realtime.messages enable row level security;
    grant usage on schema realtime to authenticated, anon;
    grant select, insert on realtime.messages to authenticated;
    grant usage on sequence realtime.messages_id_seq to authenticated;
    create or replace function realtime.topic() returns text
      language sql stable
      as $$ select nullif(current_setting('realtime.topic', true), '') $$;
    create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void
      language sql
      as $$ insert into realtime.messages (topic, extension, event, payload, private) values (topic, 'broadcast', event, payload, private) $$;
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
