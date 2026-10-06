-- Functions for signed-in people refuse everyone else, on two counts.
--
-- remove_member decided whether a caller may remove someone with
-- `p_user_id <> auth.uid()`. With nobody signed in, auth.uid() is null, the
-- comparison is null, and the `if` it guarded was skipped: a caller with no
-- session removed the member — and, with the last one gone, the wedding.
-- Reproduced against Postgres; see docs/design/specs/2026-09-29-database-review.md, D7.
-- It now refuses a caller with no session before anything else.
--
-- Whether such a caller can reach it at all depends on who may execute it.
-- The migrations revoke each of these from `public` and grant them to
-- `authenticated`, which in plain Postgres leaves `anon` out. A Supabase
-- project also grants functions to `anon` by default privileges, which
-- `revoke … from public` does not undo. So every function meant for signed-in
-- people is revoked from `anon` by name, here. The two link readers and the
-- supplier's Confirm are for anyone with a link, and are left alone.

create or replace function public.remove_member(p_wedding_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_role text;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;

  select m.role into v_target_role from public.wedding_members m
   where m.wedding_id = p_wedding_id and m.user_id = p_user_id;
  if v_target_role is null then
    raise exception 'not a member of that wedding' using errcode = 'P0002';
  end if;

  -- Anyone may leave; only the couple may remove their planner.
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

revoke all on function public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.remove_member(uuid, uuid) to authenticated;

revoke all on function public.create_wedding(text) from anon;
revoke all on function public.create_invite(uuid, text, text) from anon;
revoke all on function public.accept_invite(text) from anon;
revoke all on function public.delete_my_account() from anon;
revoke all on function public.wedding_people(uuid) from anon;
revoke all on function public.is_wedding_member(uuid) from anon;
revoke all on function public.may_follow_wedding(text) from anon;
revoke all on function public.publish_share(uuid, text, boolean, text, text, text) from anon;
revoke all on function public.take_down_share(uuid) from anon;
revoke all on function public.publish_supplier_link(uuid, text, text, text, text, text) from anon;
revoke all on function public.take_down_supplier_link(uuid, text) from anon;
-- Called only from inside the functions above, never by a client.
revoke all on function public.wedding_role_count(uuid, text) from anon, authenticated;
