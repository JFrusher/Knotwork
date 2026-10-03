/**
 * `wedding_people` declared `email text`, but `auth.users.email` is
 * `varchar(255)`, and `return query` does not convert: every call failed with
 * "structure of query does not match function result type", so the account
 * page could not list who has access. The test harness stubbed `auth.users`
 * with `text`, which is why it passed there; the stub now matches Supabase.
 *
 * Same signature and result, so the grants and revokes on it are kept.
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
    select m.user_id, u.email::text, m.role, m.joined_at
      from public.wedding_members m
      join auth.users u on u.id = m.user_id
     where m.wedding_id = p_wedding_id
     -- The couple first ('partner' sorts before 'planner').
     order by m.role, m.joined_at;
end;
$$;
