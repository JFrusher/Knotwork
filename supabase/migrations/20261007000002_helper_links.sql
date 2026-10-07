-- A link for each day-of helper to their own sheet: the run of the day, their
-- jobs and their team's, the boxes, the group shots, and the crew's numbers.
-- Spec: docs/superpowers/specs/2026-10-07-helper-binder-link.md.
--
-- The same shape as supplier_links (20260929000002_supplier_links.sql): a
-- sealed snapshot, readable only with the key after the link's `#`; the key
-- kept with the wedding so any member can republish; token and key fixed at
-- the first publish. One per person in the wedding's crew, so each can be
-- taken down alone. No confirmation: a helper has nothing to say back.
--
-- A link stops working once the day after the wedding has ended everywhere on
-- earth — midnight at UTC+14 — read from the wedding's own date, so it moves
-- if the date does and nobody's client can say otherwise. No date, no end.
create table if not exists public.helper_links (
  wedding_id   uuid not null references public.account_weddings (id) on delete cascade,
  -- The person's id in the wedding's crew. Not a foreign key: the crew lives
  -- in the wedding's document.
  person_id    text not null check (char_length(person_id) between 1 and 100),
  token        text not null unique,
  share_key    text not null,
  ciphertext   text not null,
  iv           text not null,
  fingerprint  text not null,
  published_at timestamptz not null default now(),
  published_by uuid references auth.users (id) on delete set null,
  primary key (wedding_id, person_id)
);

alter table public.helper_links enable row level security;
grant select on public.helper_links to authenticated;
revoke insert, update, delete on public.helper_links from authenticated;
revoke all on public.helper_links from anon;

drop policy if exists "members can read their wedding's helper links" on public.helper_links;
create policy "members can read their wedding's helper links"
  on public.helper_links for select
  using (public.is_wedding_member(wedding_id));

/**
 * When the helper links of a wedding on `p_date` stop working: the end of the
 * next day at UTC+14 (`Etc/GMT-14` — POSIX names the sign backwards). For a
 * wedding on 1 June, 10:00 UTC on 2 June.
 */
create or replace function public.helper_links_end(p_date date)
returns timestamptz
language sql
immutable
as $$
  select (p_date + 2)::timestamp at time zone 'Etc/GMT-14';
$$;

/** Invalid calendar dates in an imported document have no expiration. */
create or replace function public.helper_link_date(p_date text)
returns date
language plpgsql
immutable
as $$
begin
  return p_date::date;
exception when invalid_datetime_format or datetime_field_overflow then
  return null;
end;
$$;

/** Whether a wedding's helper links have run out. False with no date, or no document yet. */
create or replace function public.helper_links_expired(p_wedding_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select now() >= public.helper_links_end(public.helper_link_date(d.document -> 'event' ->> 'date'))
      from public.wedding_documents d
     where d.wedding_id = p_wedding_id
       and d.document -> 'event' ->> 'date' ~ '^\d{4}-\d{2}-\d{2}$'
  ), false);
$$;
revoke all on function public.helper_links_expired(uuid) from public, anon, authenticated;

/**
 * Publish or republish one helper's sheet. The token and key never change
 * once published; a republish under another key changes nothing and returns
 * no row, and the caller reads the link again and seals with its key.
 */
create or replace function public.publish_helper_link(
  p_wedding_id  uuid,
  p_person_id   text,
  p_share_key   text,
  p_ciphertext  text,
  p_iv          text,
  p_fingerprint text
)
returns table (token text, published_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_wedding_member(p_wedding_id) then
    raise exception 'not a member of that wedding' using errcode = '42501';
  end if;

  return query
    insert into public.helper_links as l
      (wedding_id, person_id, token, share_key, ciphertext, iv, fingerprint, published_at, published_by)
    values (
      p_wedding_id, p_person_id,
      replace(gen_random_uuid()::text, '-', ''),
      p_share_key, p_ciphertext, p_iv, p_fingerprint, now(), auth.uid()
    )
    on conflict (wedding_id, person_id) do update
      set ciphertext   = excluded.ciphertext,
          iv           = excluded.iv,
          fingerprint  = excluded.fingerprint,
          published_at = excluded.published_at,
          published_by = excluded.published_by
      where l.share_key = excluded.share_key
    returning l.token, l.published_at;
end;
$$;
revoke all on function public.publish_helper_link(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.publish_helper_link(uuid, text, text, text, text, text) to authenticated;

/** Take one helper's link down. Their copy stops working at once. */
create or replace function public.take_down_helper_link(p_wedding_id uuid, p_person_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_wedding_member(p_wedding_id) then
    raise exception 'not a member of that wedding' using errcode = '42501';
  end if;
  delete from public.helper_links where wedding_id = p_wedding_id and person_id = p_person_id;
end;
$$;
revoke all on function public.take_down_helper_link(uuid, text) from public, anon;
grant execute on function public.take_down_helper_link(uuid, text) to authenticated;

/**
 * What a helper's link fetches: the sealed sheet and when it was published.
 * Not the key, not the wedding — and nothing once the link has run out.
 */
create or replace function public.read_helper_link(p_token text)
returns table (ciphertext text, iv text, published_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select l.ciphertext, l.iv, l.published_at
    from public.helper_links l
   where l.token = p_token and not public.helper_links_expired(l.wedding_id);
$$;

revoke all on function public.read_helper_link(text) from public;
grant execute on function public.read_helper_link(text) to anon, authenticated;

/** Tidies away links that have run out. For the daily sweep, never a client. */
create or replace function public.sweep_helper_links()
returns integer
language sql
security definer
set search_path = public
as $$
  with gone as (
    delete from public.helper_links l where public.helper_links_expired(l.wedding_id) returning 1
  )
  select count(*)::integer from gone;
$$;
revoke all on function public.sweep_helper_links() from public, anon, authenticated;
