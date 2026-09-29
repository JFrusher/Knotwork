# Trousseau — database review, and a proposed change to history

Date: 2026-09-29
Status: **a proposal for the maintainer.** Nothing in the database has
changed. The one fix made with it is documentation (D4). The change proposed
below needs a migration, applied by hand before deploying, so it is the
maintainer's call.

Scope:

- all 16 migrations in `supabase/migrations/`;
- every call the application makes to the database, which is 14 functions
  and 6 tables;
- the nightly sweep.

Findings are marked as they are elsewhere:

- **Reproduced** — shown against a real Postgres (PGlite, with every
  migration applied, as `lib/testing/database.ts` builds it).
- **Traced** — read in the code, not run.

## The shape today

| Table | Holds | Written by |
|---|---|---|
| `account_weddings` | One row per wedding: its id | `create_wedding`, deleted by `remove_member` / `delete_my_account` / the sweep |
| `wedding_members` | Who is on a wedding, and as partner or planner | `create_wedding`, `accept_invite`, `remove_member` |
| `invites` | Pending invitations, by email and token | `create_invite`, `accept_invite` |
| `wedding_documents` | **The wedding**: one JSONB document, with a version | `save_wedding_document` |
| `wedding_document_history` | A full copy of the document per accepted save | `save_wedding_document` |
| `wedding_shares` | The sealed guest link | `publish_share`, `take_down_share` |
| `supplier_links` | Each supplier's sealed call sheet | `publish_supplier_link`, … |
| `library_items` | A planner's kept designs, days, rooms, ceremonies, boxes, bar settings | the planner, through row-level security |

## What is sound, and should stay

- **One document per wedding, with a version.** The contract's unit is the
  whole wedding. The merge is done in the browser, part by part. The server
  validates the whole document across slices before it accepts it (see
  `crossSliceValidation.ts`). Storing it as one row makes that a single
  compare-and-set with nothing to reassemble.
- **Every write goes through a `security definer` function with
  `search_path` pinned.** Clients get `select` at most, under row-level
  security, and `anon` gets nothing but the two link readers. RLS is on every
  table.
- **Link tokens are unique, and so indexed.** Link payloads are sealed under
  a key the server never receives.
- **Deletion cascades from `account_weddings`.** That is how the sweep,
  leaving a wedding and deleting an account each retire everything a wedding
  had.
- **The library caps an item at 1 MB,** and checks its kinds against a list.

## Findings

| # | Finding | How established |
|---|---|---|
| D1 | **History grows with every save, without limit.** Each accepted save inserts a full copy of the document into `wedding_document_history`, and nothing prunes it: the nightly sweep only removes abandoned weddings. The app saves 250 ms after the last edit, and text fields write on every keystroke, so each pause while typing is a save. The example wedding (100 guests, about 91 KB as sent) is stored at **about 27 KB per save** after Postgres compresses it. Fifty saves each for 21 weddings came to 550 rows and **15 MB**. Typing a 120-word reading with a pause between words would add over 3 MB to one wedding's history. Supabase's free database, at 500 MB, holds about 18,500 such saves across every wedding on the instance. | Reproduced (growth per save, table size); traced (the 250 ms push, the keystroke writes) |
| D2 | **History has no index but its primary key.** Postgres does not index foreign keys itself. Three queries therefore read the whole table — every wedding's history — for one wedding or one person: <ul><li>the Sync & history panel's query (`where wedding_id = … order by saved_at desc limit n`), which plans as a sequential scan and a sort;</li><li>the cascade when a wedding is deleted;</li><li>setting `saved_by` to null when an account is deleted.</li></ul> It is the largest table in the database, so this worsens exactly as D1 grows it. | Reproduced (the query plans) |
| D3 | *Suspected and refuted:* that the passphrase-sync tables (`weddings`, `slices`, `shares`, `blobs`) and `put_slice` are left behind, unused. The application calls none of them. But `20260928000002_guest_link` drops all five, and a database with every migration applied has none. No action. | Reproduced |
| D4 | **The self-hosting guide listed 7 migrations to apply; there are 16.** The README said "seven migrations". Someone following the list would miss the roles, the guest and supplier links, the library and the live channel, and have an app whose writes fail. **Fixed with this review:** the guide now says to apply every file in the folder, in order, rather than keeping a list that goes out of date. | Traced |
| D5 | Smaller foreign keys have no index either: `invites.wedding_id` and `created_by`, a planner's `wedding_members.user_id`, `wedding_documents.updated_by`, and each link's `published_by`. Every one is on a table of a few rows per wedding, so a scan there costs nothing that matters. No action. | Traced |
| D6 | The first five migrations build the passphrase schema that the ninth removes, so a fresh install creates and drops it. That is harmless. Squashing them is not worth the risk to existing deployments, which track what they have applied by file name. No action. | Traced |

## The proposal: keep the structure, bound the history

**Keep one document per wedding.** Two alternatives were considered and
rejected:

- **A row per slice.** This would turn one compare-and-set into up to
  sixteen. The cross-slice check that refuses a wedding with two dates would
  then need a transaction around them. The live channel would announce
  several versions per change. And the merge, which already works part by
  part in the browser, would gain nothing. It would shrink history rows, but
  so does the proposal below, far more simply.
- **History as patches.** Restoring any version would mean replaying every
  patch before it, and one bad patch would corrupt everything after it.

**Bound the history instead, in three parts:**

1. **One entry per person per ten minutes.** A save updates that person's
   latest entry, if they opened it less than ten minutes ago, rather than
   adding another. A new column, `opened_at`, records when an entry was
   opened. An hour's steady editing leaves at most six entries, not
   thousands. Fine-grained going back is the undo button's job (in the
   browser, per step); history is for "the plan as it was on Tuesday".
2. **Thin old history in the nightly sweep.** Beyond 30 days, keep one entry
   per wedding per day, the last of that day.
3. **Index it:**
   - `(wedding_id, saved_at desc)`, for the panel and for deleting a wedding;
   - `(saved_by)`, for deleting an account.

**What that bounds it to.** Take heavy planning at three hours a week:

- At most 18 entries a week in the last month.
- One a day beyond that: at most 365 a year, and fewer, since most days see
  no editing.
- For the example wedding, that is **about 12 MB a year at the very most**
  (about 440 entries at 27 KB), against an unbounded amount now.

The Sync & history panel, the conflict screen and the undo history do not
change. Each entry is still a whole wedding, restored in one step.

### The migration, as proposed

```sql
alter table public.wedding_document_history
  add column if not exists opened_at timestamptz not null default now();

create index if not exists wedding_document_history_by_wedding
  on public.wedding_document_history (wedding_id, saved_at desc);
create index if not exists wedding_document_history_by_saver
  on public.wedding_document_history (saved_by);

-- In save_wedding_document, the history insert becomes:
--   update the latest entry, if it is this person's and opened < 10 minutes ago;
--   otherwise insert one (opened_at = now()).
-- And a new function the nightly sweep calls:
create or replace function public.thin_wedding_history()
returns integer
language sql
security definer
set search_path = public
as $$
  with ranked as (
    select id,
           row_number() over (partition by wedding_id, saved_at::date order by saved_at desc) as nth
      from public.wedding_document_history
     where saved_at < now() - interval '30 days'
  ),
  gone as (delete from public.wedding_document_history h using ranked r where h.id = r.id and r.nth > 1 returning 1)
  select count(*)::integer from gone;
$$;
revoke all on function public.thin_wedding_history() from public;
```

### Proved how, if accepted

Against PGlite, as the migration tests already are:

- Saves by one person within ten minutes leave one entry. A save after ten
  minutes, or by the other partner, starts another.
- Thinning keeps the last entry of each old day and every entry of the last
  30 days.
- The panel's query and both deletions plan as index scans.
- The migration can be run twice.

## Open for the maintainer

1. **Accept the history proposal as it stands, or change it:**
   - the ten-minute window;
   - thinning after 30 days;
   - one entry kept per day beyond that.
2. The existing history is already large wherever people have been editing.
   Should the same migration thin it now, or leave that to the sweep?
