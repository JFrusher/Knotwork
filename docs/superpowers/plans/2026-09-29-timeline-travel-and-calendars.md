# Timeline: Travel and Calendars Implementation Plan

**Goal:** The couple types how long it takes to get between two places, and
the Timeline says when somebody is due somewhere before they could get there.
The day, or one supplier's part of it, downloads as a calendar file.

**Architecture:** One new field on Cadence's own document, `travel`, beside
`tagDetails`. One walk over the resolved day finds every *move* — a tag at one
place, then its next block somewhere else — and both the new advisory and the
new panel read it, so what is checked and what is listed cannot disagree. The
calendar is written in the browser from the resolved day, as the PDFs are.

**Tech Stack:** TypeScript, Cadence's core and store, the suite's field kit.
**No new dependencies.**

**Spec:** [Phase 1 of the toolbox spec](../specs/2026-09-29-toolbox-and-new-tools-design.md#phase-1--timeline-travel-between-places-and-calendars)

## Decided while planning, from the code

- **Who moves is a tag, not a lane.** The spec said "a lane or a tag". The
  example wedding says otherwise: its *Suppliers* lane holds the florist, the
  caterer and the band, and *Transport* holds the cars and the guest coach —
  a lane is a kind of activity, not a party, and checking a lane would say the
  coach cannot get from where the cars were. Tags are already who is where:
  the double-booking check reads them and nothing else, so the couple is only
  ever caught being in two places at once if their blocks carry a tag. Travel
  follows the same rule, and the panel says so: tag your own blocks — "couple"
  — to have your own journeys checked.
- **A block ends where the run sheet says it does**, `contentEndMin`, before
  its contingency buffer. Hair and make-up printed as ending at 13:00, with the
  first look at 13:05 and fifteen minutes away, is ten minutes short; measured
  from after a buffer, it would read as an overlap and be skipped.
- **Overlaps are not travel's to report.** A tag in two places at once is
  already a double booking.
- **Places match as the couple would**: trimmed, and regardless of case.
- **A calendar is refused while the day has clashes**, for the reason the PDFs
  are. The travel advisory never blocks anything.
- **A calendar is on the wedding's date, in the venue's local time.** Found
  while building task 4, so recorded here and in the spec: the timeline's own
  date is a placeholder (20 June 2026) until the wedding has one, and its UTC
  offset reads as British Summer Time until somebody sets it — the Day panel
  shows that fallback as if it were chosen, and choosing it again changes
  nothing. UTC built on that would put a winter wedding an hour out. Local
  times with no zone are right whatever the offset.

## Tasks

- [x] **1. The field.** `Journey { between: [string, string]; minutes }` and
  `TimelineDoc.travel`; `emptyDoc` gives `[]`; `readTimeline` coerces it,
  dropping anything without two places and a positive time. Let the compiler
  list every other place a `TimelineDoc` is built.
- [x] **2. The walk and the check** (`core/schedule/travel.ts`): `moves`,
  `journeyMinutes`, and the `no-travel-time` advisory, one per pair of blocks
  naming every tag making that move. Joined into `conflicts()`, so the screen,
  the warnings list and the announcer have it with no change of their own.
- [x] **3. The panel.** *Travel*, after *Tags*: every pair of places the day
  moves between, each with its minutes (blank: not checked), and journeys the
  day no longer makes, to forget. One store action, `setJourney`, one undo
  step.
- [x] **4. Calendars** (`render/ics/calendar.ts`): RFC 5545 — CRLF, lines
  folded at 75 octets without splitting a character, text escaped, times as
  local times on the wedding's date (past midnight included), an end only
  where there is a length, a UID stable per block and particular to the
  wedding. The export bar gains the whole day or one tag, and *Download
  calendar*.
- [x] **5. End to end.** Type a journey, see the advisory; download a
  calendar and read it.

## Status

**Complete — all 5 tasks, 2026-09-29.** 1,785 suite tests and 102 in the
contract package, typecheck and build clean, all 90 Playwright tests green.
No new dependencies.

**What executing it found.**

- The travel list and the advisory are one walk (`moves`), so the panel lists
  exactly the journeys that are checked. On the example wedding it lists the
  rooms the photographer and the caterer move between; a blank is right for
  two rooms next door, and nothing is flagged until a time is typed.
- Money already had the control the panel needed — a whole number or nothing,
  written on leaving the field — as a private function. It moved to the kit as
  `WholeNumberInput`, taking its styling from the caller, and both use it.
- The compiler found the three places a `TimelineDoc` is built; a drift test
  found the fourth, the sample day kept on disk beside `sampleDoc()`.
- It also found a mistake in the previous commit: the font-engine guard used a
  regular-expression flag the suite's target does not allow. The flag did
  nothing — `[^;]` already crosses lines — and is gone; the guard was proved
  again to fail with the old import put back.

**Fixed after, at the maintainer's request: the clocks.** Reproduced first: a
wedding with no offset, one block added in Timeline, and the event said 60 —
`writeSlice` echoes the timeline's offset into `event` on every edit, and the
timeline's offset was the BST fallback. The offset is now `number | null` in
Cadence's day, the contract's published day and Delegation's reader, with no
fallback anywhere; the Day panel offers *Not set*; `sunForDay` gives nothing
without clocks, so no sunset or golden-hour advisory is worked out from a
guess. The Binder's own rule — the phone's clock when the wedding has none —
now gets to apply.
