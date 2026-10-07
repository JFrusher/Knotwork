# Bug & Quirk Backlog

Append new entries under **Open** as you hit them — doesn't need to be tidy,
just enough for a fresh session to find the problem. Run `/work-backlog` to
have Claude work through this list: investigate root cause, ask if the
repro is unclear, fix, and move each entry down to **Resolved**.

## How to add an entry

Copy this into Open, fill in what you know:

```
### <short title>
- **Reported:** YYYY-MM-DD
- **App/area:** Timeline | Tableaux | Delegation | Group shots | Stationery | shell/header | accounts | other
- **What happened:** <what you saw>
- **Expected:** <what should've happened, if obvious>
- **Repro:** <steps, or "not sure — happened while doing X">
- **Severity:** blocks me | annoying | cosmetic
```

Only "What happened" is required — leave the rest blank if you don't know it.

---

## Open

*(nothing yet)*

---

## Sample (for reference — see the matching entry under Resolved for how this
one played out; both stay here permanently as a worked example, not a real
open bug)

### Adjusting table side count removes a seated guest even when a free seat exists
- **Reported:** 2026-09-09
- **App/area:** Tableaux
- **What happened:** Changing a table's per-side seat count sometimes removes a
  seat that has a guest assigned, even when that side has an empty seat it
  could have removed instead.
- **Expected:** Shrinking a side should always prefer removing an empty seat on
  that side; a seated guest should only be bumped when every seat on that side
  is occupied.
- **Repro:** Not sure of exact steps — noticed while adjusting side counts on a
  table that already had some guests seated and some empty seats.
- **Severity:** annoying

---

## Resolved

*(fixed entries move here, newest first, with the commit that fixed them)*

*The eight below came from one first-time-couple playtest on 2026-10-06
(scripted, production build, no account, 1440px and 390px).*

### Console 501 on every load where accounts aren't configured
- **Reported:** 2026-10-06
- **App/area:** accounts
- **Root cause:** `startCloudSync` (`suite/lib/store/useKnotworkStore.ts`)
  always asks `/api/accounts/weddings`; with no Supabase configured the route
  answers 501 by design, and the browser logs any non-2xx.
- **Not fixed — by design:** `ca72b1f` skipped the request when the build has
  no public Supabase env, but that request is the seam the accounts e2e tests
  (`signing-in`, `sync-history`) intercept to simulate sign-in in an
  env-less build; five failed. Reverted in `a46c919`. The cost is one
  console line on self-hosted copies without accounts.

### Pasted names: duplicates and couples go in without a hint
- **Reported:** 2026-10-06
- **App/area:** other (setup / guest import)
- **Root cause:** `planImport` (`suite/lib/data/guestImport.ts`) matches
  names only against guests already on the list, so repeats within one paste
  are each added — correctly, since two guests can share a name — and
  nothing told the couple.
- **Fix:** `09128ca` — `pastedHints` (`suite/lib/setup/draft.ts`) lists
  repeated names and lines that look like more than one person ("&", "and",
  a comma, "+1"); setup's guest step shows them after "Add them". Everything
  still goes in as typed. Tests in `draft.test.ts` and `e2e/setup.spec.ts`.

### Setup forgets everything if the page is reloaded before step 3
- **Reported:** 2026-10-06
- **App/area:** other (setup)
- **Root cause:** setup is a React-state draft committed as one change at
  the room step (deliberate: one undo, one push), with nothing guarding the
  page before that.
- **Fix:** `09128ca` — a `beforeunload` prompt while the draft differs from
  where it started and is not yet saved. Test in `e2e/setup.spec.ts`. Leaving
  by a link inside the app (a header tab) is still not guarded: the App
  Router has no navigation-blocking hook.

### Timeline silently puts every wedding in central London
- **Reported:** 2026-10-06
- **App/area:** Cadence
- **Root cause:** `defaultDay()` (`suite/apps/cadence/core/model/defaults.ts`)
  set latitude/longitude to London, and `readTimeline` fell back to it for
  any wedding that never entered a place; `promote.ts` guessed London for
  old Cadence files too. The clocks were already "entered, not guessed".
- **Fix:** `2f93b5c` — both are `null` until entered; `sunForDay` gives
  nothing without them and the Day panel says what to enter. `NumberField`
  shows null as empty. Tests in `solar.test.ts`, `roundTrip.test.ts`;
  `e2e/timeline.spec.ts` updated in `0ec5ad0`. Weddings that already stored
  London keep it — a stored guess cannot be told from an entered place.

### A new timeline block starts at midnight, and setting its time is not obvious
- **Reported:** 2026-10-06
- **App/area:** Cadence
- **Root cause:** a block floats after the one before it in its lane; with
  none, `resolve` (`core/schedule/resolve.ts:88`) starts it at its gap from
  minute 0. `addBlock` made the first block of an empty lane unanchored.
- **Fix:** `d072822` — the first block of an empty lane is anchored at
  `DAY_OPENS_MIN` (08:00, also where an empty day's ruler opens), so its
  "Anchored at" time field is on screen. Test in `state/store.test.ts`.

### "Seat them" on the phone overview leads to a dead end
- **Reported:** 2026-10-06
- **App/area:** shell/header (overview)
- **Root cause:** the overview's NEXT card and "Also left" rows link to
  `item.href` whatever the width, and every route in `app/(app)/(tools)` is
  behind `LandscapeGate` below 1024px. Nothing in code said which tools are
  gated — only the folder did.
- **Fix:** `b531afd` — tools carry `wide` in `lib/tools.ts` (the gate
  throws on a route without it, so the two cannot drift); on a narrow screen
  those items say "On a laptop or tablet" instead of linking. Test in
  `e2e/header.spec.ts`. The "Where things stand" cards still link to gated
  tools, where the gate's own message explains.

### On a phone, four of the seven tools are hidden in an unmarked scroll strip
- **Reported:** 2026-10-06
- **App/area:** shell/header
- **Root cause:** one fixed-height header row held the wedding name, the
  tabs and the Find/Data/Help buttons; at 390px the tabs got 94px for 272px
  (516px with every tool on) and scrolled with no cue.
- **Fix:** `b531afd` — below `sm` the tabs wrap onto rows of their own and
  the header grows to fit; only the wide tools read `--shell-header-h`, and
  none is open below 1024px. Test in `e2e/header.spec.ts` with all 11 tools.

### Screen readers hear raw IDs when a guest is dragged to a table
- **Reported:** 2026-10-06
- **App/area:** Tableaux, Group shots
- **Root cause:** `DndContext` in `apps/tableaux/App.tsx` set dnd-kit's
  `screenReaderInstructions` but not `announcements`, and
  `components/ensemble/ShotList.tsx` set neither; the library's defaults
  speak each draggable's id.
- **Fix:** `1a3f931` — `hooks/dragAnnouncements.ts` names guests, tables,
  seats, groups and families from the plan; the shot list reads "Shot 4,
  label" and its position. Test in `hooks/dragAnnouncements.test.ts`.

### [SAMPLE] Adjusting table side count removes a seated guest even when a free seat exists
- **Reported:** 2026-09-09
- **App/area:** Tableaux
- **What happened:** Changing a table's per-side seat count sometimes removed
  a seat that had a guest assigned, even when that side had an empty seat it
  could have removed instead.
- **Root cause:** `setPerSideSeats` (`suite/apps/tableaux/store/actions.js`)
  truncated `assignedGuestIds` by raw flat-array index against the *new total*
  capacity, with no idea which side actually changed. Seats are laid out
  `top → bottom → left → right`, so shrinking one side could silently evict a
  guest sitting on a completely different, untouched side, while the side
  that actually shrank sailed through untouched even when it had a free seat
  to give up.
- **Fix:** `41a00d4` — re-slice the array side by side instead of truncating
  the flat array: a growing side keeps its guests and gets empty seats
  appended; a shrinking side drops its own empty seats first, and only bumps
  a guest to overflow once every remaining seat on that specific side is
  already taken. New function `remapSeatsForSides` in
  `suite/apps/tableaux/utils/seatPositions.js`, covered by a new regression
  test in `suite/apps/tableaux/store/tableActions.test.js`.
- **This is the sample entry** — kept here permanently (never delete it) so
  future entries have a real worked example of what "Root cause" and "Fix"
  should look like once `/work-backlog` closes something out.
