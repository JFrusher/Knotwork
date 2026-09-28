-- Roles: a wedding has up to two partners and one planner, and an account may
-- be a partner in one wedding and a planner in any number.
--
-- Until now `wedding_members.user_id` alone was the primary key — one wedding
-- per account, enforced by the schema. That rule now holds for partners only,
-- so the key widens to (wedding_id, user_id) and the per-role rules become two
-- partial unique indexes. The two-partner cap is a count, which no index can
-- say; it is checked under the wedding's row lock, as it already was.

alter table public.wedding_members
  add column if not exists role text not null default 'partner'
  constraint wedding_members_role check (role in ('partner', 'planner'));

alter table public.wedding_members drop constraint if exists wedding_members_pkey;
alter table public.wedding_members add primary key (wedding_id, user_id);

-- A partner in one wedding at a time: their own.
create unique index if not exists wedding_members_one_partner_wedding
  on public.wedding_members (user_id) where role = 'partner';
-- One planner per wedding, in v1.
create unique index if not exists wedding_members_one_planner
  on public.wedding_members (wedding_id) where role = 'planner';

alter table public.invites
  add column if not exists role text not null default 'partner'
  constraint invites_role check (role in ('partner', 'planner'));

/**
 * Start a wedding, as one of the couple or as their planner.
 *
 * A second partner wedding fails on `wedding_members_one_partner_wedding`;
 * a planner may start as many as they have clients.
 */
drop function if exists public.create_wedding();
create or replace function public.create_wedding(p_role text default 'partner')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wedding_id uuid;
begin
  insert into public.account_weddings default values returning id into v_wedding_id;
  insert into public.wedding_members (user_id, wedding_id, role) values (auth.uid(), v_wedding_id, p_role);
  return v_wedding_id;
end;
$$;

/** How many of a role a wedding has. For the caps, under the wedding's lock. */
create or replace function public.wedding_role_count(p_wedding_id uuid, p_role text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.wedding_members m
   where m.wedding_id = p_wedding_id and m.role = p_role;
$$;
revoke all on function public.wedding_role_count(uuid, text) from public;

/**
 * Invite someone to the wedding as a partner or as its planner. Any member
 * may: a couple invites their planner, and a planner who started a wedding
 * for a client invites the couple.
 */
drop function if exists public.create_invite(uuid, text);
create or replace function public.create_invite(p_wedding_id uuid, p_invited_email text, p_role text default 'partner')
returns table (id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_token text;
  v_expires timestamptz;
begin
  if not public.is_wedding_member(p_wedding_id) then
    raise exception 'not a member of that wedding' using errcode = '42501';
  end if;

  perform 1 from public.account_weddings where account_weddings.id = p_wedding_id for update;
  if p_role = 'partner' and public.wedding_role_count(p_wedding_id, 'partner') >= 2 then
    raise exception 'wedding already has two partners' using errcode = 'P0001';
  end if;
  if p_role = 'planner' and public.wedding_role_count(p_wedding_id, 'planner') >= 1 then
    raise exception 'wedding already has a planner' using errcode = 'P0001';
  end if;

  -- See 20260902000001_accounts.sql for why two stripped UUIDs.
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_expires := now() + interval '14 days';

  insert into public.invites (wedding_id, invited_email, token, created_by, expires_at, role)
  values (p_wedding_id, lower(p_invited_email), v_token, auth.uid(), v_expires, p_role)
  returning invites.id, invites.token, invites.expires_at into v_id, v_token, v_expires;

  return query select v_id, v_token, v_expires;
end;
$$;

/**
 * Accept an invite, in the role it was sent for. Every "no" is a reason, not
 * an exception — see 20260902000001_accounts.sql.
 */
create or replace function public.accept_invite(p_token text)
returns table (accepted boolean, reason text, wedding_id uuid, invited_email text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites%rowtype;
  v_caller_email text;
begin
  select * into v_invite from public.invites where token = p_token;
  if not found then
    return query select false, 'not-found', null::uuid, null::text;
    return;
  end if;

  select email into v_caller_email from auth.users where id = auth.uid();

  if v_invite.accepted_at is not null then
    return query select false, 'already-accepted', v_invite.wedding_id, v_invite.invited_email;
    return;
  end if;
  if v_invite.expires_at < now() then
    return query select false, 'expired', v_invite.wedding_id, v_invite.invited_email;
    return;
  end if;
  if lower(v_caller_email) <> v_invite.invited_email then
    return query select false, 'wrong-email', v_invite.wedding_id, v_invite.invited_email;
    return;
  end if;

  -- The lock serialises two acceptances racing for the last place.
  perform 1 from public.account_weddings where id = v_invite.wedding_id for update;

  if exists (
    select 1 from public.wedding_members m where m.wedding_id = v_invite.wedding_id and m.user_id = auth.uid()
  ) then
    return query select false, 'already-a-member', v_invite.wedding_id, v_invite.invited_email;
    return;
  end if;
  if (v_invite.role = 'partner' and public.wedding_role_count(v_invite.wedding_id, 'partner') >= 2)
     or (v_invite.role = 'planner' and public.wedding_role_count(v_invite.wedding_id, 'planner') >= 1) then
    return query select false, 'wedding-full', v_invite.wedding_id, v_invite.invited_email;
    return;
  end if;
  if v_invite.role = 'partner' and exists (
    select 1 from public.wedding_members m where m.user_id = auth.uid() and m.role = 'partner'
  ) then
    return query select false, 'already-in-a-wedding', v_invite.wedding_id, v_invite.invited_email;
    return;
  end if;

  insert into public.wedding_members (user_id, wedding_id, role)
  values (auth.uid(), v_invite.wedding_id, v_invite.role);
  update public.invites set accepted_at = now() where token = p_token;

  return query select true, null::text, v_invite.wedding_id, v_invite.invited_email;
end;
$$;

/**
 * Take someone off a wedding: yourself, from any wedding (leaving), or its
 * planner, by one of the couple. The couple always decides who else sees
 * their plans; a planner does not decide for them. RLS reads membership, so
 * removal takes effect on the very next request.
 *
 * The last member leaving deletes the wedding, as deleting an account does.
 */
create or replace function public.remove_member(p_wedding_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_role text;
begin
  select m.role into v_target_role from public.wedding_members m
   where m.wedding_id = p_wedding_id and m.user_id = p_user_id;
  if v_target_role is null then
    raise exception 'not a member of that wedding' using errcode = 'P0002';
  end if;

  if p_user_id <> auth.uid() and not (
    v_target_role = 'planner' and exists (
      select 1 from public.wedding_members m
       where m.wedding_id = p_wedding_id and m.user_id = auth.uid() and m.role = 'partner'
    )
  ) then
    raise exception 'only the couple can remove their planner' using errcode = '42501';
  end if;

  perform 1 from public.account_weddings where id = p_wedding_id for update;
  delete from public.wedding_members m where m.wedding_id = p_wedding_id and m.user_id = p_user_id;
  if not exists (select 1 from public.wedding_members m where m.wedding_id = p_wedding_id) then
    delete from public.account_weddings where id = p_wedding_id;
  end if;
end;
$$;

/**
 * Who has access to a wedding, with their addresses — which only this
 * function can read, `auth.users` being closed to clients. Members only.
 */
create or replace function public.wedding_people(p_wedding_id uuid)
returns table (user_id uuid, email text, role text, joined_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_wedding_member(p_wedding_id) then
    raise exception 'not a member of that wedding' using errcode = '42501';
  end if;
  return query
    select m.user_id, u.email, m.role, m.joined_at
      from public.wedding_members m
      join auth.users u on u.id = m.user_id
     where m.wedding_id = p_wedding_id
     -- The couple first ('partner' sorts before 'planner').
     order by m.role, m.joined_at;
end;
$$;

/**
 * Leave every wedding, deleting each one this was the last member of. The
 * auth user itself is removed by the caller, as before.
 */
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wedding_id uuid;
begin
  for v_wedding_id in
    select m.wedding_id from public.wedding_members m where m.user_id = auth.uid()
  loop
    delete from public.wedding_members m where m.wedding_id = v_wedding_id and m.user_id = auth.uid();
    -- See 20260902000001_accounts.sql for why the lock comes before the count.
    perform 1 from public.account_weddings where id = v_wedding_id for update;
    if not exists (select 1 from public.wedding_members m where m.wedding_id = v_wedding_id) then
      delete from public.account_weddings where id = v_wedding_id;
    end if;
  end loop;
end;
$$;

revoke all on function public.create_wedding(text) from public;
revoke all on function public.create_invite(uuid, text, text) from public;
revoke all on function public.remove_member(uuid, uuid) from public;
revoke all on function public.wedding_people(uuid) from public;
grant execute on function public.create_wedding(text) to authenticated;
grant execute on function public.create_invite(uuid, text, text) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.wedding_people(uuid) to authenticated;
