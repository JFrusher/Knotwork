-- History, bounded.
--
-- Every accepted save added a full copy of the wedding to its history — and
-- the app saves 250 ms after each pause in typing — while nothing pruned it,
-- and the table had no index but its key. See
-- docs/superpowers/specs/2026-09-29-database-review.md, D1 and D2.
--
-- Now:
--   * one entry per person per ten minutes: a save brings this person's entry
--     up to date, if it is the wedding's latest and was opened less than ten
--     minutes ago, rather than adding another;
--   * beyond 30 days, one entry per wedding per day, the last of that day —
--     thinned by the save that opens a new entry, so it needs no schedule and
--     no function anybody else can call;
--   * indexed for the history panel, deleting a wedding, and deleting an
--     account.
--
-- Each entry is still a whole wedding, restored in one step. Going back a
-- step at a time is the undo button's job, in the browser.

alter table public.wedding_document_history add column if not exists opened_at timestamptz;
update public.wedding_document_history set opened_at = saved_at where opened_at is null;
alter table public.wedding_document_history alter column opened_at set default now();
alter table public.wedding_document_history alter column opened_at set not null;

create index if not exists wedding_document_history_by_wedding
  on public.wedding_document_history (wedding_id, saved_at desc);
create index if not exists wedding_document_history_by_saver
  on public.wedding_document_history (saved_by);

create or replace function public.save_wedding_document(
  p_wedding_id       uuid,
  p_document         jsonb,
  p_expected_version integer
)
returns table (accepted boolean, version integer, document jsonb, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_written record;
  v_current record;
begin
  if not public.is_wedding_member(p_wedding_id) then
    raise exception 'not a member of that wedding' using errcode = '42501';
  end if;

  update public.wedding_documents d
     set document   = p_document,
         version    = d.version + 1,
         updated_at = now(),
         updated_by = auth.uid()
   where d.wedding_id = p_wedding_id
     and d.version = p_expected_version
  returning d.document, d.version, d.updated_at
       into v_written;

  if v_written is null and p_expected_version = 0 then
    insert into public.wedding_documents as d (wedding_id, document, version, updated_at, updated_by)
    values (p_wedding_id, p_document, 1, now(), auth.uid())
    on conflict (wedding_id) do nothing
    returning d.document, d.version, d.updated_at
         into v_written;
  end if;

  if v_written is not null then
    -- This person's sitting, if the wedding's latest entry is theirs and was
    -- opened less than ten minutes ago: brought up to date, not added to.
    update public.wedding_document_history h
       set document = v_written.document,
           saved_at = v_written.updated_at
     where h.id = (
             select latest.id from public.wedding_document_history latest
              where latest.wedding_id = p_wedding_id
              order by latest.saved_at desc
              limit 1
           )
       and h.saved_by = auth.uid()
       and h.opened_at > now() - interval '10 minutes';

    if not found then
      insert into public.wedding_document_history (wedding_id, document, saved_at, saved_by, opened_at)
      values (p_wedding_id, v_written.document, v_written.updated_at, auth.uid(), now());

      -- A new sitting: this wedding's history past 30 days is thinned to the
      -- last entry of each day.
      delete from public.wedding_document_history h
       using (
         select old.id,
                row_number() over (partition by old.saved_at::date order by old.saved_at desc) as nth
           from public.wedding_document_history old
          where old.wedding_id = p_wedding_id
            and old.saved_at < now() - interval '30 days'
       ) ranked
       where h.id = ranked.id
         and ranked.nth > 1;
    end if;

    return query select true, v_written.version, v_written.document, v_written.updated_at;
    return;
  end if;

  select d.document, d.version, d.updated_at
    into v_current
    from public.wedding_documents d
   where d.wedding_id = p_wedding_id;

  if v_current is not null then
    return query select false, v_current.version, v_current.document, v_current.updated_at;
  else
    return query select false, 0, null::jsonb, null::timestamptz;
  end if;
end;
$$;

revoke all on function public.save_wedding_document(uuid, jsonb, integer) from public, anon;
grant execute on function public.save_wedding_document(uuid, jsonb, integer) to authenticated;
