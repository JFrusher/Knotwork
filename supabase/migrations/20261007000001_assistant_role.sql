-- Assistants: the lead planner's assistant or day-of coordinator, on one
-- wedding. Spec: docs/superpowers/specs/2026-10-07-assistant-planners.md.
--
-- An assistant reads and edits the wedding as a planner does (every policy
-- that asks `is_wedding_member` already lets them), and nothing more: they
-- invite nobody, remove nobody but themselves, and never hold a wedding alone.
-- Only the lead planner invites one; any number per wedding.
--
-- "Never hold a wedding alone": a wedding was deleted when its last member
-- left. It is now deleted when its last partner or planner leaves, taking any
-- assistants with it, so an assistant leaving never deletes a wedding.

alter table public.wedding_members drop constraint wedding_members_role;
alter table public.wedding_members
  add constraint wedding_members_role check (role in ('partner', 'planner', 'assistant'));

alter table public.invites drop constraint invites_role;
alter table public.invites
  add constraint invites_role check (role in ('partner', 'planner', 'assistant'));

/** The caller's role on a wedding, or null. For the rules below. */
create or replace function public.my_wedding_role(p_wedding_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role from public.wedding_members m where m.wedding_id = p_wedding_id and m.user_id = auth.uid();
$$;
revoke all on function public.my_wedding_role(uuid) from public, anon, authenticated;

/**
 * After someone leaves: a wedding with no partner or planner left is deleted,
 * and its assistants with it (`on delete cascade`). Called under the
 * wedding's lock.
 */
create or replace function public.retire_wedding_if_unheld(p_wedding_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.wedding_members m where m.wedding_id = p_wedding_id and m.role in ('partner', 'planner')
  ) then
    delete from public.account_weddings where id = p_wedding_id;
  end if;
end;
$$;
revoke all on function public.retire_wedding_if_unheld(uuid) from public, anon, authenticated;

/** Nobody starts a wedding as an assistant: they are always invited onto one. */
create or replace function public.create_wedding(p_role text default 'partner')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wedding_id uuid;
begin
  if p_role not in ('partner', 'planner') then
    raise exception 'a wedding is started by one of the couple or a planner' using errcode = '22023';
  end if;
  insert into public.account_weddings default values returning id into v_wedding_id;
  insert into public.wedding_members (user_id, wedding_id, role) values (auth.uid(), v_wedding_id, p_role);
  return v_wedding_id;
end;
$$;

create or replace function public.create_invite(p_wedding_id uuid, p_invited_email text, p_role text default 'partner')
returns table (id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mine text;
  v_id uuid;
  v_token text;
  v_expires timestamptz;
begin
  v_mine := public.my_wedding_role(p_wedding_id);
  if v_mine is null then
    raise exception 'not a member of that wedding' using errcode = '42501';
  end if;
  if v_mine = 'assistant' then
    raise exception 'an assistant cannot invite anyone' using errcode = '42501';
  end if;
  if p_role = 'assistant' and v_mine <> 'planner' then
    raise exception 'only the planner can invite an assistant' using errcode = '42501';
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
 * As before, plus: an assistant's invite holds only while the planner who
 * sent it is still the wedding's planner. A planner who has left cannot go
 * on bringing people in.
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
  if v_invite.role = 'assistant' and not exists (
    select 1 from public.wedding_members m
     where m.wedding_id = v_invite.wedding_id and m.user_id = v_invite.created_by and m.role = 'planner'
  ) then
    return query select false, 'inviter-gone', v_invite.wedding_id, v_invite.invited_email;
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
 * Anyone may leave. The couple may remove their planner; the couple or the
 * planner may remove an assistant. Nobody else removes anyone.
 */
create or replace function public.remove_member(p_wedding_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_role text;
  v_mine text;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;

  select m.role into v_target_role from public.wedding_members m
   where m.wedding_id = p_wedding_id and m.user_id = p_user_id;
  if v_target_role is null then
    raise exception 'not a member of that wedding' using errcode = 'P0002';
  end if;

  v_mine := public.my_wedding_role(p_wedding_id);
  if p_user_id <> auth.uid() and not (
    (v_target_role = 'planner' and v_mine = 'partner')
    or (v_target_role = 'assistant' and v_mine in ('partner', 'planner'))
  ) then
    raise exception 'only the couple can remove their planner, and only the couple or the planner an assistant'
      using errcode = '42501';
  end if;

  perform 1 from public.account_weddings where id = p_wedding_id for update;
  delete from public.wedding_members m where m.wedding_id = p_wedding_id and m.user_id = p_user_id;
  perform public.retire_wedding_if_unheld(p_wedding_id);
end;
$$;

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
    perform public.retire_wedding_if_unheld(v_wedding_id);
  end loop;
end;
$$;
