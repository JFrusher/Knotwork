-- A link for each supplier to their own call sheet, and a way for them to say
-- they have it.
--
-- The same shape as the guest link (20260928000002_guest_link.sql): a sealed
-- snapshot, readable only with the key after the link's `#`, which browsers
-- never send; the key kept with the wedding so any member can republish; the
-- token and key fixed at the first publish, so a link already sent keeps
-- working. One per supplier rather than one per wedding.
--
-- A supplier confirming through their link records the time here and nothing
-- else. The wedding itself is only ever written by its members' own devices,
-- which read confirmations back and put them on the supplier.
create table if not exists public.supplier_links (
  wedding_id   uuid not null references public.account_weddings (id) on delete cascade,
  -- The supplier's id in the wedding's crew. Not a foreign key: the crew lives
  -- in the wedding's document.
  team_id      text not null check (char_length(team_id) between 1 and 100),
  token        text not null unique,
  share_key    text not null,
  ciphertext   text not null,
  iv           text not null,
  fingerprint  text not null,
  published_at timestamptz not null default now(),
  published_by uuid references auth.users (id) on delete set null,
  -- Set by the supplier through their link; kept across a republish, so the
  -- page can say the sheet has changed since they confirmed.
  confirmed_at timestamptz,
  primary key (wedding_id, team_id)
);

alter table public.supplier_links enable row level security;
grant select on public.supplier_links to authenticated;
revoke insert, update, delete on public.supplier_links from authenticated;
revoke all on public.supplier_links from anon;

drop policy if exists "members can read their wedding's supplier links" on public.supplier_links;
create policy "members can read their wedding's supplier links"
  on public.supplier_links for select
  using (public.is_wedding_member(wedding_id));

/**
 * Publish or republish one supplier's call sheet. The token and key never
 * change once published; a republish under another key changes nothing and
 * returns no row, and the caller reads the link again and seals with its key.
 */
create or replace function public.publish_supplier_link(
  p_wedding_id  uuid,
  p_team_id     text,
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
    insert into public.supplier_links as l
      (wedding_id, team_id, token, share_key, ciphertext, iv, fingerprint, published_at, published_by)
    values (
      p_wedding_id, p_team_id,
      replace(gen_random_uuid()::text, '-', ''),
      p_share_key, p_ciphertext, p_iv, p_fingerprint, now(), auth.uid()
    )
    on conflict (wedding_id, team_id) do update
      set ciphertext   = excluded.ciphertext,
          iv           = excluded.iv,
          fingerprint  = excluded.fingerprint,
          published_at = excluded.published_at,
          published_by = excluded.published_by
      where l.share_key = excluded.share_key
    returning l.token, l.published_at;
end;
$$;

/** Take one supplier's link down. Their copy of it stops working at once. */
create or replace function public.take_down_supplier_link(p_wedding_id uuid, p_team_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_wedding_member(p_wedding_id) then
    raise exception 'not a member of that wedding' using errcode = '42501';
  end if;
  delete from public.supplier_links where wedding_id = p_wedding_id and team_id = p_team_id;
end;
$$;

/**
 * What a supplier's link fetches: the sealed sheet, when it was last
 * published, and when they confirmed it. Not the key, not the wedding.
 */
create or replace function public.read_supplier_link(p_token text)
returns table (ciphertext text, iv text, published_at timestamptz, confirmed_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select l.ciphertext, l.iv, l.published_at, l.confirmed_at from public.supplier_links l where l.token = p_token;
$$;

/** The supplier says they have it. Returns when, or nothing for no such link. */
create or replace function public.confirm_supplier_link(p_token text)
returns timestamptz
language sql
security definer
set search_path = public
as $$
  update public.supplier_links set confirmed_at = now() where token = p_token returning confirmed_at;
$$;

revoke all on function public.publish_supplier_link(uuid, text, text, text, text, text) from public;
revoke all on function public.take_down_supplier_link(uuid, text) from public;
revoke all on function public.read_supplier_link(text) from public;
revoke all on function public.confirm_supplier_link(text) from public;
grant execute on function public.publish_supplier_link(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.take_down_supplier_link(uuid, text) to authenticated;
grant execute on function public.read_supplier_link(text) to anon, authenticated;
grant execute on function public.confirm_supplier_link(text) to anon, authenticated;
