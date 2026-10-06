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
- **App/area:** Cadence | Tableaux | Brigade | Ensemble | Plaque | shell/header | accounts | other
- **What happened:** <what you saw>
- **Expected:** <what should've happened, if obvious>
- **Repro:** <steps, or "not sure — happened while doing X">
- **Severity:** blocks me | annoying | cosmetic
```

Only "What happened" is required — leave the rest blank if you don't know it.

---

## Open

*Entries below are from a scripted first-time-couple playtest (Playwright,
production build, no account, 1440px and 390px). Each is backed by a
reproduction; "Evidence" says where.*

### Screen readers hear raw IDs when a guest is dragged to a table
- **Reported:** 2026-10-06
- **App/area:** Tableaux
- **What happened:** Dropping a guest on a table puts "Draggable item
  guest_g_bt9u4ks7 was dropped over droppable area table_tbl_muwe79d62vkmj"
  in the live region.
- **Expected:** Names, e.g. "Raj Sharma seated at Table 3."
- **Repro:** Seating → drag any guest onto a table → read the `role=status`
  live region.
- **Evidence:** `apps/tableaux/App.tsx:74` overrides dnd-kit's
  `screenReaderInstructions` but not `announcements`, so the library default
  (which speaks ids) is used. `components/ensemble/ShotList.tsx:127` sets
  neither — likely the same, not yet reproduced.
- **Severity:** annoying (for screen-reader users)

### On a phone, four of the seven tools are hidden in an unmarked scroll strip
- **Reported:** 2026-10-06
- **App/area:** shell/header
- **What happened:** At 390px the tool nav (`nav.overflow-x-auto`) is 94px
  wide holding 272px of icons. About 2½ icons show; the half-cut third reads
  as a stray "[". Timeline, Delegation, Group shots and "+" are off to the
  right with nothing saying the strip scrolls.
- **Repro:** 390 × 900 viewport, any page, look at the header.
- **Severity:** annoying

### "Seat them" on the phone overview leads to a dead end
- **Reported:** 2026-10-06
- **App/area:** shell/header (overview)
- **What happened:** On a phone the overview's NEXT card says "9 guests have
  no table yet — Seat them". The button opens Seating, which on a phone only
  says "Seating needs a wider screen". The same holds for Place cards,
  Timeline and Delegation.
- **Expected:** The primary next step on a phone is one the phone can do,
  or the card says it needs a laptop.
- **Repro:** 390px, finish setup, tap "Seat them".
- **Severity:** annoying

### Timeline silently puts every wedding in central London
- **Reported:** 2026-10-06
- **App/area:** Cadence
- **What happened:** A new wedding at "Hollins Barn" shows latitude 51.5074,
  longitude -0.1278. Clocks are deliberately "Not set — entered, not
  guessed", but the place is guessed. Once a couple sets BST, sunset and
  golden hour are London's, whatever the venue (Edinburgh in June sets ~40
  min later).
- **Evidence:** `apps/cadence/core/model/defaults.ts:50-51`.
- **Expected:** Location treated like the clock — unset until entered — or
  visibly flagged as a guess.
- **Severity:** annoying

### Setup forgets everything if the page is reloaded before step 3
- **Reported:** 2026-10-06
- **App/area:** other (setup)
- **What happened:** Names, date, venue and pasted guests are a draft held
  in React state; reloading or closing the tab on steps 1–2 loses them with
  no warning.
- **Evidence:** by design — `app/(app)/setup/page.tsx:36` ("Nothing is
  written until the room step"). Logged as a UX question, not a defect:
  keep the single-commit design but warn on leave, or persist the draft.
- **Severity:** annoying

### A new timeline block starts at midnight, and setting its time is not obvious
- **Reported:** 2026-10-06
- **App/area:** Cadence
- **What happened:** "+ Add" on an empty lane makes a block at 00:00. There
  is no time field; the time appears only after pressing "Anchor to the
  clock", then "Anchored at". A first-time couple adding "Ceremony" sees it
  at midnight.
- **Repro:** Timeline → Main day → + Add.
- **Severity:** cosmetic (works once found)

### Pasted names: duplicates and couples go in without a hint
- **Reported:** 2026-10-06
- **App/area:** other (setup / guest import)
- **What happened:** Pasting "Dave Smith" twice adds two guests;
  "Mr & Mrs Patel", "Ben Jones +1" and "Lucy, Mark" each become one guest
  and one seat.
- **Evidence:** `lib/data/guestImport.ts:249` matches names only against
  guests already on the list, not earlier rows of the same paste. Two real
  people can share a name, so this may be right — but nothing flags it.
- **Severity:** cosmetic

### Console 501 on every load where accounts aren't configured
- **Reported:** 2026-10-06
- **App/area:** accounts
- **What happened:** Self-hosted without Supabase, every page load logs
  "Failed to load resource: 501" for `/api/accounts/weddings`.
- **Evidence:** `lib/store/useKnotworkStore.ts:336` always calls
  `fetchWeddings()`; the route returns 501 by design and the result is
  handled. Noise only.
- **Severity:** cosmetic

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
