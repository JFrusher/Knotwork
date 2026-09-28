-- The guest link, on the account wedding — and the passphrase sync it
-- outlived, removed.
--
-- The link used to ride on 20260830000001_suite_sync.sql's own `weddings` row
-- for storage and authorisation, so publishing one asked a signed-in couple
-- for a second credential: a passphrase nobody could recover. Now it belongs
-- to `account_weddings` like everything else, and any member may publish it.
--
-- What guests receive is still sealed: the server stores ciphertext, and the
-- key travels in the link after the `#`, which browsers never send. Members
-- can read the key (they need it to republish as seats change); the public
-- read below returns ciphertext only.

create table if not exists public.wedding_shares (
  wedding_id   uuid primary key references public.account_weddings (id) on delete cascade,
  token        text not null unique,
  share_key    text not null,
  show_plan    boolean not null default false,
  ciphertext   text not null,
  iv           text not null,
  -- Of the snapshot as sealed, so a device can tell whether what guests see is
  -- current without decrypting it.
  fingerprint  text not null,
  published_at timestamptz not null default now(),
  published_by uuid references auth.users (id) on delete set null
);

alter table public.wedding_shares enable row level security;
grant select on public.wedding_shares to authenticated;
revoke insert, update, delete on public.wedding_shares from authenticated;
revoke all on public.wedding_shares from anon;

drop policy if exists "members can read their wedding's guest link" on public.wedding_shares;
create policy "members can read their wedding's guest link"
  on public.wedding_shares for select
  using (public.is_wedding_member(wedding_id));

/**
 * Publish or republish the wedding's guest link.
 *
 * The token and key are fixed at the first publish and never change after:
 * every guest's link carries both. A republish sealed with a different key —
 * two devices publishing for the first time at once — changes nothing and
 * returns no row, and the caller reads the link again and seals with its key.
 */
create or replace function public.publish_share(
  p_wedding_id  uuid,
  p_share_key   text,
  p_show_plan   boolean,
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
    insert into public.wedding_shares as s
      (wedding_id, token, share_key, show_plan, ciphertext, iv, fingerprint, published_at, published_by)
    values (
      p_wedding_id,
      replace(gen_random_uuid()::text, '-', ''),
      p_share_key, p_show_plan, p_ciphertext, p_iv, p_fingerprint, now(), auth.uid()
    )
    on conflict (wedding_id) do update
      set show_plan    = excluded.show_plan,
          ciphertext   = excluded.ciphertext,
          iv           = excluded.iv,
          fingerprint  = excluded.fingerprint,
          published_at = excluded.published_at,
          published_by = excluded.published_by
      where s.share_key = excluded.share_key
    returning s.token, s.published_at;
end;
$$;

/** Take the link down. Every copy of it stops working at once. */
create or replace function public.take_down_share(p_wedding_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_wedding_member(p_wedding_id) then
    raise exception 'not a member of that wedding' using errcode = '42501';
  end if;
  delete from public.wedding_shares where wedding_id = p_wedding_id;
end;
$$;

/**
 * What a guest's link fetches: the sealed snapshot, and nothing else — not
 * the key, not the wedding. Open to anyone holding the token, which is 128
 * random bits and useless without the key after the `#`.
 */
create or replace function public.read_share(p_token text)
returns table (ciphertext text, iv text)
language sql
stable
security definer
set search_path = public
as $$
  select s.ciphertext, s.iv from public.wedding_shares s where s.token = p_token;
$$;

revoke all on function public.publish_share(uuid, text, boolean, text, text, text) from public;
revoke all on function public.take_down_share(uuid) from public;
revoke all on function public.read_share(text) from public;
grant execute on function public.publish_share(uuid, text, boolean, text, text, text) to authenticated;
grant execute on function public.take_down_share(uuid) to authenticated;
grant execute on function public.read_share(text) to anon, authenticated;

-- The passphrase sync, which nothing uses now. Its tables cascade what they
-- hold; its data was sealed with keys the server never had.
drop function if exists public.put_slice(text, text, text, text, integer);
drop table if exists public.blobs cascade;
drop table if exists public.shares cascade;
drop table if exists public.slices cascade;
drop table if exists public.weddings cascade;
