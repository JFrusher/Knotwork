-- A planner's library: a card design, a running order, a room or a checklist
-- saved from one wedding to use in another.
--
-- Owned by one account and seen by nobody else. Nothing personal is kept —
-- the application strips a design of its rows, a day of its date, a room of
-- its guests and a checklist of its dates before it is saved — so a wedding's
-- guests never travel into another through here.
create table if not exists public.library_items (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('cards', 'day', 'room', 'checklist')),
  name       text not null check (char_length(name) between 1 and 120),
  content    jsonb not null,
  created_at timestamptz not null default now(),
  -- A design, not a wedding: generous, and well under what a document may be.
  constraint library_items_size check (pg_column_size(content) < 1048576)
);

create index if not exists library_items_owner on public.library_items (owner, created_at desc);

alter table public.library_items enable row level security;

revoke all on public.library_items from anon;
-- Saved and removed, never edited in place: a changed design is saved again.
grant select, insert, delete on public.library_items to authenticated;

drop policy if exists "owners read their library" on public.library_items;
create policy "owners read their library"
  on public.library_items for select
  using (owner = auth.uid());

drop policy if exists "owners add to their library" on public.library_items;
create policy "owners add to their library"
  on public.library_items for insert
  with check (owner = auth.uid());

drop policy if exists "owners remove from their library" on public.library_items;
create policy "owners remove from their library"
  on public.library_items for delete
  using (owner = auth.uid());
