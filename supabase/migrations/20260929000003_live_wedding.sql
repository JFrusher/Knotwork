-- A wedding's live channel: the moment its document moves, every member who
-- has it open is told, and each can see who else is there.
--
-- Over Supabase Realtime, on a private channel per wedding, `wedding:<id>`.
-- What goes over it is deliberately small. A save announces only its new
-- version number — never the document, its guests or their names — and each
-- open window then fetches the document through the same members-only route
-- it always has. Presence carries the member's email and which window they
-- are in, and only to the wedding's other members.
--
-- This replaces the 20-second poll: an accepted save announces itself from
-- the database, whoever made it, so no window has to ask.

-- Whether the caller may follow `topic`: a wedding channel, and theirs.
create or replace function public.may_follow_wedding(topic text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- CASE rather than AND: Postgres does not promise to test the shape before
  -- the cast, and a topic that is not a wedding's must be refused, not fail.
  select case
    when topic ~ '^wedding:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_wedding_member(substring(topic from 9)::uuid)
    else false
  end;
$$;

revoke all on function public.may_follow_wedding(text) from public;
grant execute on function public.may_follow_wedding(text) to authenticated;

-- Receiving: the announcements and the presence of a wedding's channel, for
-- its members only.
drop policy if exists "members follow their wedding" on realtime.messages;
create policy "members follow their wedding"
  on realtime.messages for select
  to authenticated
  using (public.may_follow_wedding(realtime.topic()));

-- Sending: presence only. Announcements come from the database alone, so a
-- member's window cannot claim a save that did not happen.
drop policy if exists "members say they are here" on realtime.messages;
create policy "members say they are here"
  on realtime.messages for insert
  to authenticated
  with check (extension = 'presence' and public.may_follow_wedding(realtime.topic()));

-- Every accepted save, announced by its version alone.
create or replace function public.announce_wedding_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('version', new.version),
    'moved',
    'wedding:' || new.wedding_id::text,
    true
  );
  return null;
end;
$$;

revoke all on function public.announce_wedding_document() from public;

drop trigger if exists announce_wedding_document on public.wedding_documents;
create trigger announce_wedding_document
  after insert or update of version on public.wedding_documents
  for each row execute function public.announce_wedding_document();
