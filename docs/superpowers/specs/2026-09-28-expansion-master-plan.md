# Trousseau — the expansion: planners, setup, and the windows around the tools

Date: 2026-09-28
Status: direction approved by the maintainer (answers recorded below). Each
phase gets its own dated implementation plan before it is built.
Scope: the whole suite — the setup flow, accounts, a planner role, new views,
and the architecture those need underneath them.

## Why

An audit of the suite on 2026-09-28 found that the five tools are individually
strong and that the weak places are all *between* them: where a shared fact is
edited, where a device meets an account, where a new couple starts. The setup
flow runs straight through every one of those seams.

The audit's findings are listed below with how each was established, because
several turned out differently once tested than they looked when read.

- **Reproduced** — shown failing in a test or a real browser.
- **Traced** — every caller read; not run.
- **Seen** — visible in a screenshot of a production build.

### Setup and accounts

| # | Finding | How established |
|---|---|---|
| S1 | The Data panel's edits (guest import, names, date) were written back over by whichever of Seating or Timeline was open, on that tool's next save. | Reproduced — unit, and Playwright against a production build. **Fixed 2026-09-28**, see below. |
| S2 | A failed local save sets the store's `error`, but both components that read it render it only for a failed *read*. Nothing shows a failed save. | Traced |
| S3 | Creating a wedding or accepting an invite does not start cloud sync until a full reload: `startCloudSync` has one caller, on mount. | Traced. **Fixed 2026-09-28**: both now end in a full load, where sync starts. |
| S4 | Accepting an invite silently replaces the invitee's local wedding on their next load. | Reproduced — unit, with storage that survives a reload. **Fixed 2026-09-28**, see *Signing in safely*. |
| S5 | A magic link opened in the wrong browser sends an invitee to `/account`, whose main button is **Create your wedding** — which then blocks the invite for good (`already-in-a-wedding`). | Reproduced — component tests: `/login` dropped `next`, and the invite's "Sign in" linked to bare `/login`. **Fixed 2026-09-28**. |
| S6 | Loading the example wedding while signed in pushes it over the shared wedding; the confirmation says it replaces "the wedding in this browser". The emptiness check counts only guests and blocks. | Reproduced — unit (a wedding of group shots only was replaced unasked). **Fixed 2026-09-28**. |
| S12 | Found while reproducing S4: an edit made while the account answered "unavailable" (a 500, say) was lost at the next start, which replaced the device's document with the account's; an edit made offline went up on reconnect at version 0 and conflicted over every slice. The agreed baseline lived only in memory. | Reproduced — unit. **Fixed 2026-09-28**: the baseline is stored. |
| S7 | Names, date and venue have three editors (Data panel, Timeline's Day panel, Seating's write-back). Guest import has two implementations with different rules. | Traced, seen |
| S8 | The guest link needs a second credential — an unrecoverable passphrase — even for a signed-in couple, and goes stale silently when seats change. | Traced, seen |
| S9 | "Take a tour" runs the six-step front-page chapter and stops; the other 23 steps are reachable only one tool at a time. | Traced. **Fixed 2026-09-28**: the tour walks every chapter. |
| S11 | Found while merging the importers: the Data panel's importer stored diets as the file's words ("Vegetarian", "None") where Seating reads a key ("vegetarian"). Seating's Vegetarian filter found none of the example wedding's thirteen vegetarians, and its breakdown listed "None" as a diet. | Reproduced — Playwright. **Fixed 2026-09-28** with the one importer. |
| S10 | The example wedding has 0 of 100 guests seated, no crew, no jobs, no shots and no card design. The promise it exists to demonstrate cannot be shown from it. | Reproduced (fixture counted), seen. **Fixed 2026-09-28**, see Phase 1.5. |
| S13 | Found with the fuller example: a guest who declined was still a guest to seat and feed. Place cards printed them a card; What is left, Seating's header, its Overview and the Unassigned chip counted them unseated; Seating's dietary tally counted their meal; the front page's Seated figure counted them in the total. Seating's own exports already left them out, so the screen disagreed with the printout. | Reproduced — unit, and seen (9 unseated, 97 / 106, and 3 left to do, on one wedding). **Fixed 2026-09-28**: one `isComing`, used everywhere. |
| S14 | Delegation called a job with no block — a task, as the 2026-09-08 design made them — an orphan: a clash that held the print run, drawn in red. | Reproduced — unit. **Fixed 2026-09-28**. |
| S15 | What is left said the card design had "nowhere to show" 83 dietary requirements that the design drew as icons: it counted text tokens and not the column an icon is drawn from, which Plaque itself counts. | Reproduced — unit. **Fixed 2026-09-28**. |
| S16 | Since sides were named after the partners, the place cards' Side column carried the stored "a" and "b": a card binding `{{Side}}` printed a letter. | Reproduced — unit. **Fixed 2026-09-28**: "Alex’s side". |
| S17 | Seating's "worth checking" note counted a guest who answered "None" as having no dietary note. Six of its seven notes on the example were those guests. | Reproduced — unit. **Fixed 2026-09-28**. |

### Architecture

- **Six state containers, five undo systems.** The shared store, four tool
  stores each seeded once on mount, and Group shots reading live.
- **Every partner change remounts the open tool.** A pulled change swaps the
  document, which resets the tool's undo history and selection even when the
  partner touched an unrelated slice. Traced.
- **Undo differs per page.** Group shots uses the shared history, which also
  holds the Data panel's import — so Undo there can take back an import made
  elsewhere. Traced.
- **Conflicts are per whole slice and shown blind.** Two partners editing
  different guests conflict on "guests"; the choice has no diff; the state is
  visible only inside the Data dialog. The server keeps version history
  (`wedding_document_history`) with no UI. Traced.
- **Three `Button`s, four modal patterns, two `window.confirm`s, three CSV
  parsers**, and the legacy passphrase sync (`lib/sync`) kept alive only for the
  guest link.

### UX

The front page has five competing starts and no primary action; the Data
dialog does four unrelated jobs with the most important one last; at the
declared minimum width Seating's Overview covers the canvas; three sidebar
idioms; empty states that claim success ("Every job has somebody" with no
jobs); "Bride's side / Groom's side" hard-coded in seven places; every tool
walled off below 1024px. The tour overlay declares `aria-modal` and never moves
focus. `/seat` — the one page guests use — is not in the axe run.

## Decisions

The maintainer's answers, 2026-09-28. Where the answer delegated the choice,
the choice made is recorded with its reason.

| # | Question | Decision |
|---|---|---|
| 1 | Who uses it | The couple (two partners) **plus a wedding planner role**. Planners are a market in their own right: one account, many client weddings, and a library of their own designs to reuse. |
| 2 | Real usage today | None yet. Migrations may be bold; clarity beats compatibility. |
| 3 | Phones | A phone-first, read-only **day-of binder**. The editing tools stay desktop. |
| 4 | S1 | Fix now. Done — see *S1, fixed*. |
| 5 | Bride/groom | Replace with **sides named after the partners**. |
| 6 | Look | Keep it. |
| 7 | Window types | Delegated. See *Design language*. |
| 8 | Theme | Light only. |
| 9 | Device vs account weddings | Delegated: see *Signing in safely*. Nothing is replaced without a restorable copy. |
| 10 | Create the wedding automatically | Delegated: **yes**, on first sign-in — except when arriving through an invite. Removes S5's trap. |
| 11 | One importer | Delegated: **the suite's `lib/data/guestImport.ts`** is the engine; one dialog with a preview. Adds and updates, never unseats, never deletes silently — people missing from the new file are listed and can be removed there, explicitly. RSVPs arrive this way from Joy and similar, so their exports become golden fixtures. |
| 12 | Guest link | Delegated: **on the account, no passphrase, and live** — once published it republishes itself as seats change, with a visible "updated" time and a take-down. A stale seat link sends a guest to the wrong table, which is worse than no link. |
| 13 | Priorities | RSVP stays with Joy and friends (imported). Build money, checklist, vendor portal, day-of binder and real-time sync. |
| 14 | Privacy | Data may leave the device. The promise is **nobody is reading your plans or your friends' names**: no admin view, no content analytics, guest data never sent to a third party. Venue-level data (an address to find sunset times) may be, and only when the feature is used. |
| 15 | Tableaux | Delegated: **converge every tool on the live document** (see Phase 4). Seating goes last and becomes TypeScript as part of it. |

## S1, fixed

A tool reads the wedding once, into a store of its own, and writes that copy
back on every save. The generation guard in `lib/store/toolGeneration.ts`
already stopped a stale copy being written after a *whole* document was
swapped. It did not cover one slice being written from outside — which is
exactly what the Data panel does, over whichever tool is on screen.

Now each tool's gate (`WhenDocumentReady`) declares what the tool copies
(`HOLDS`), each tool tags its own writes (`by`), and a write to a held slice from
anywhere else starts a new generation. The tool remounts onto the current
document and its stale save is refused. One rule in the store covers every
writer: the Data panel, the post-load reconcile, and the legacy sync client.

Verified by unit tests on the rule, bridge-level tests for Seating and
Timeline, and an end-to-end test (`e2e/persistence.spec.ts`) that fails with
the rule disabled and passes with it.

**Cost:** a Data-panel edit remounts the open tool, which resets its undo
history. Phase 4 removes the copies and with them the remount.

**Found on the way, and not caused by it:** under heavy parallel load the
existing e2e test "a Seating edit survives an immediate reload" fails now and
then. An edit made less than 400ms before a reload is still inside Seating's
autosave delay, so it depends on a save issued as the page unloads — and the
page is sometimes gone before IndexedDB commits it. Measured on untouched
`main` at 2 in 80 runs and with this fix at 5 in 56, which is not a
significant difference; an instrumented failing run showed the new rule never
fired. Phase 4 removes the cause: an edit reaches the shared store, and so
IndexedDB, when it is made.

## Design language

The look stays. What is decided here is its grammar, so that every new window
is one of a small number of known kinds.

**Paper on a desk.** Parchment is the page, stone is a panel, white is reserved
for what prints or stands for a card. **One display voice**: Marcellus for the
wedding's name and a page's single heading, Lato everywhere else, figures
tabular. **One accent per area**, and semantic colour — ok, warn, danger —
never changes hue between areas. **Quiet until it needs you**: the one loud
thing on a screen is the thing that needs a decision.

### Kinds of window

| Kind | Use it when | Examples | Rules |
|---|---|---|---|
| **Page** | Somewhere you work for minutes, or want to link to | The tools, Guests, Money, Checklist, Binder, a planner's Weddings, Setup | Its own route and heading. Reached from the header or the front page. |
| **Slide-over** | Look at or act on something without losing your place | Sync & history, Guest link, one guest from anywhere | Right edge, one width, the page behind inert, Escape closes, addressable by `?panel=`. |
| **Dialog** | A decision, or a short flow that must finish or be cancelled | Confirmations, import, delete, "two weddings" | Native `<dialog>`, focus kept inside, one primary action. Replaces every `window.confirm`. |
| **Popover** | Picking something small | Menus, pickers | Anchored; outside click dismisses. |
| **Notice** | State that belongs to a place | Errors, empty states, warnings | Inline, never a toast. |
| **Toast** | Confirming something just done | "Backup written", "Undo" | Never the only record of anything. |

### Rules that follow

- **Empty is not success.** A check over nothing says there is nothing yet, and
  offers the one action that starts it.
- **One status pill** in the header: *Saved · Syncing · Offline · Needs you*.
  "Needs you" opens Sync & history. This is where S2's failed save appears.
- **One kit.** `components/ui` gains `Dialog`, `SlideOver`, `Confirm`,
  `EmptyState`, `Pill`, `Table`; the tools' own kits retire as they are touched.
- **Type floor.** Labels go from 11px to 12px across the scale, checked against
  screenshots of all five tools before it lands.
- **Navigation.** The header keeps the five tools. The wedding's own pages —
  Overview, Guests, Money, Checklist, Binder — sit under the wedding's name,
  which for a planner is also the switcher between client weddings. Built
  with Overview (2.1), because that is when the header changes shape anyway.
  It must also fix what the header does at 1024px today: the tools' own
  controls (Timeline's zoom, Fit day and Present) do not fit and scroll out of
  sight inside it.

## Signing in safely

The rule: **nothing is replaced without a restorable copy, and nothing is
replaced silently when both sides have work in them.**

- A wedding "has content" if somebody entered something in it: names, date,
  venue, guests, tables, blocks, crew, jobs, shots or card names. Not "any
  slice is present" — measured in the browser, opening Timeline, Place cards
  or Delegation stores that tool's empty defaults with nothing typed.
  (`lib/model/content.ts`; fixes S6's check.)
- Device empty → take the account's. Account empty → push the device's. Neither
  loses anything, so neither asks.
- Both have content and the device last synced with *this* wedding → the
  ordinary per-slice merge.
- Both have content and they are different weddings → **stop and ask**, with
  what each holds ("This device: Alex & Sam, 100 guests. Your account: Robin &
  Kit, 80 guests"). Use the account's, or keep this device's. The losing side
  is kept as a copy on this device and put back from Data (the account's is
  also in its server history).
  - *Built without "choose per part".* Parts of two different weddings do not
    fit together: guests from one and seating from the other leaves every seat
    pointing at nobody. Per-slice choice stays where it is sound — two partners
    editing one wedding.
- How a device knows "this wedding": the link (`trousseau.cloud.link`) —
  wedding id, version and per-slice baseline — stored whenever the agreement
  moves. It replaces the one-document write queue, which a start that merges
  from a stored baseline made redundant.
- The same screen handles accepting an invite (S4) and loading the example
  wedding over a synced one (S6), whose confirmation names who else it affects.
- Creating or joining a wedding starts sync immediately (S3).
- The wedding is created at sign-in (`/auth/callback`), except on the way to
  an invite. `/login` carries `next` through the magic link, so an invitee who
  has to sign in again comes back to the invite (S5).
- Signing out asks whether to keep this wedding on the device or remove it —
  shared computers exist.

## The planner role

- **Membership gains a role**: `partner` (at most two per wedding, as now) or
  `planner` (at most one per wedding in v1). An account may be a partner in one
  wedding and a planner in any number. Caps stay in application code, as the
  2026-09-02 identity spec argued.
- **Either direction:** a couple invites their planner, or a planner creates a
  wedding for a client and invites the couple. The couple always sees who has
  access and can remove the planner; removal takes effect at once through RLS.
- **Weddings page** for planners: each client wedding with its date, what is
  left (the same `readiness`, run over each document), money outstanding and
  last activity.
- **Library:** a planner saves a card design, a running order, a room or a
  checklist from one wedding and applies it to another. Saved without anything
  personal — a design without its rows, a day without its date, a room without
  its guests. Stored per planner account.
- **Local copies are kept per wedding**, keyed by id, so switching clients is a
  document swap and never a merge.

**Built 2026-09-28 (1.2).**
- `20260928000001_roles.sql`: membership keyed by (wedding, user) with a
  `role`. The partner-in-one and one-planner rules are partial unique indexes;
  the two-partner cap is counted under the wedding's row lock. Also adds
  `remove_member` (yourself, or the planner by one of the couple) and
  `wedding_people`. Proved against PGlite, including every earlier partner
  rule and a second application of the migration.
- Every document request names its wedding (`?wedding=`), and membership is
  checked per request. Nothing is inferred from "the" wedding.
- Switching is a full load of `/open/<id>`, a page outside the app layout. The
  page being left hands over its tools' last edits as it unloads, and the swap
  then runs with no store or tool loaded that could write the old wedding over
  the new one. The open wedding is put aside with its link and comes back as
  it was, unsent edits included, which are pushed once it is open again.
  Which wedding to open is stored apart from the link's baseline.
- Sign-in starts a couple's wedding only for an account on none. Planners
  come in through `/weddings`, which starts nothing.
- Leaving a wedding also removes its copy from the device.
- Known until 2.1: the switcher adds to the header's overflow at 1024px, for
  accounts on more than one wedding.

## Phases

Each phase ends with the suite's own gate green — typecheck, every Vitest
project, the build, and the Playwright run — and gets its own plan first.

### Phase 0 — Foundations

1. **S1** — done.
2. **Status pill** and failed saves shown (S2); conflicts visible outside the
   Data dialog.
3. **Design language in code:** the shared kit above; `TourOverlay` onto
   `Dialog` so it traps focus; axe extended to `/seat`, `/invite` and open
   dialogs.
4. **Sides named after the partners.** The stored values do not change; the
   labels come from the couple, across filters, the inspector, import, exports
   and group-shot roles.
5. **One editor per fact, one importer** (decision 11), with Joy, Zola and The
   Knot exports as fixtures.

### Phase 1 — Setup and accounts

1. **Signing in safely** (above): S3, S4, S5, S6; automatic wedding creation.
2. **Roles and many weddings per account**, the switcher, per-wedding local
   storage.
3. **Setup** (`/setup`): *the two of you* (names, date, venue) → *guests*
   (import, paste, or later) → *the room* (a starting layout, or later) →
   *together* (account, partner, planner). Staged as a draft and committed as
   one change — one undo step, one push. The front page's primary action until
   it is done. **Built 2026-09-28.** The one importer takes a target: the
   wedding, or setup's draft. Pasted names go through the same matching. The
   starting room is made with Seating's own `addTable`, spaced from what
   Seating actually draws. The example wedding's 160px spacing makes
   neighbouring chairs collide, which is for 1.5 to fix. The draft starts from
   the wedding as it is, so setup can be run again without losing anything.
   The commit comes before *together*, which may leave the page to sign in.
4. **Guest link on the account**, live (decision 12). Then `lib/sync` and its
   tables are deleted — nothing else uses them. **Built 2026-09-28.**
   `wedding_shares` belongs to the account wedding, and any member publishes
   without a passphrase. The token and key are fixed at the first publish; a
   republish under another key changes nothing, so a race between two devices
   can't break the links guests hold. The link republishes a few seconds after
   what guests see changes. The fingerprint leaves out `publishedAt`, or every
   check would count as a change. The key is now stored with the wedding, so
   the server's operator can read the link, exactly as they can read the
   wedding. The Privacy Policy says so, and no longer describes the passphrase
   system (dated 2026-09-28). `lib/sync`, its API and its four tables are gone.
   Its reusable parts moved: rate limiting and `check` to `lib/server`, the
   share encryption and snapshot to `lib/share`, portable assets and retention
   to `lib/documents`.
5. **Tour and example wedding:** "Take a tour" runs every chapter; the example
   gains seats, crew, jobs, shots and a card design so every chapter has
   something real to point at. **Built 2026-09-28.** The tour is one walk
   through all 28 steps (S9); "How this page works" still runs one chapter.
   The example has 106 guests with sides, replies, ten families and three
   groups; 97 seated, with families kept together and three left to seat;
   rounds spaced as setup spaces them; a crew of six suppliers with jobs on
   the day and two tasks off it; 26 group shots; and a card design made by
   Place cards from the room. One copy of it, the one the app serves; a test
   holds it to all of that, and to Seating finding nothing wrong. Walking it
   in every tool found S13–S17 and three accessibility faults — an unlabelled
   team name, seated guests' cards at 40% opacity, and tables and seats that
   nested a button in a button — all fixed.

### Phase 2 — Windows around the tools

1. **Overview** — the front page as the wedding's state: progress per area and
   one next step, replacing the tool grid that repeats the header. **Built
   2026-09-28.** The next step is What is left's first item, a blocking one
   before an advisory one; the rest follow quietly under *Also left*. Each
   area — guests, seating, cards, the day, jobs, shots — says how much there
   is and how much is done, and says "No … yet" rather than success when
   there is nothing. The header's shape changed with it: the wedding's name
   takes the wordmark's place and opens the wedding's pages (and, for a
   planner, the other weddings, replacing the switcher). At 1024px Timeline's
   zoom, Fit day and Present, and Delegation's filter, sat out of sight inside
   the header (measured, and now a test at that width for every tool). Below
   1280px the tool tabs are icons; the signed-in email is an icon at any width,
   the widest thing the header held; and the guest count is gone — the front
   page says what the tools share now.
2. **Guests** — the whole list as a sortable, filterable, bulk-editable table:
   RSVP, side, dietary, table, plus-one, tags. Today the list exists only as a
   column inside the Seating canvas. **Built 2026-09-28** at `/guests`, under
   the wedding's name. It keeps no copy: it reads the wedding and writes it,
   so its changes are on the one undo stack. Replies, sides, food and tables
   change in the row or for everyone ticked; tags are added and taken off in
   bulk. Table moves run Seating's own commands over the stored slices, so a
   guest and a table's list cannot disagree and a seat-level table keeps its
   holes; food is typed in the guest's words and read the way Seating's
   inspector reads it. Only what the filter shows is acted on. The tour has a
   chapter for it; the rule on chapter length became "at most six, under
   thirty in all", which is what the four-to-six rule was for.
3. **Money** — a view over what the crew slice already holds (cost, deposit,
   paid-on, balance due, budget). Adds one field, `balancePaidOn`, because
   today nothing records that a balance was paid. Due-soon balances join What
   is left. **Built 2026-09-28** at `/money`, and made the one place money is
   changed: Delegation's crew panel kept who the suppliers are, their email
   and when they confirmed, and points here for the rest. The balance is the
   cost less the deposit, never stored. What is left says a balance due within
   30 days is coming and holds an overdue one up as a problem; the budget line
   moved here with them. The front page has a Money area. Found on the way: an
   e2e test that reloaded straight after an edit lost it to the unload race
   noted under S1 — the test now goes across the app as a person would, and
   the ones that are about reloading wait for the write first.
4. **Checklist** — a view over the jobs with no block, which the 2026-09-08
   design already made general tasks. Adds `dueOn`, and templates relative to
   the wedding date. Overdue tasks join What is left. **Built 2026-09-28** at
   `/checklist`: late, the next 30 days, later, undated, and done folded away;
   a task is added, dated, renamed, ticked off or removed in place. "Add the
   usual tasks" adds eighteen, dated back from the day and matched by name so
   it never doubles up. The example wedding has them, seven done. Found on
   the way, with the templates as the evidence: What is left and Delegation
   both counted a task with nobody named as a gap — What is left as
   *blocking* — and Delegation's header, its Unassigned filter and the
   front page's Delegation area counted tasks as jobs on the day. A task with
   nobody named is the couple's own; all four now read the jobs on the day,
   and Delegation folds the tasks away, there only to hand one to somebody.
5. **Sync & history** — what changed and who changed it, conflicts settled with
   a real diff, and restore from the server's history.
6. **Command palette** — any guest, table, block, job or page by name.

### Phase 3 — Beyond the couple

1. **Planners:** Weddings page and library.
2. **Binder** (`/binder`): now and next against the clock, the run sheet, who to
   ring, find a guest's table, the shot list to tick off. Works offline from the
   last synced copy — venues have bad signal.
3. **Vendor links:** each supplier gets a link to their own call sheet and a
   *Confirm* button that sets `confirmedOn`. The 2026-09-08 design deferred
   this "for something a wedding has about eight of"; a planner has eight per
   client, which is the reason it is worth building now.

### Phase 4 — One live document

Each tool stops keeping a copy: it reads its slices from the shared store and
writes through it, as Group shots already does. That retires, in one move, the
stale-copy class of bug S1 belonged to, the remount on every partner change,
the five undo systems (one history, labelled), and the 400ms window in which a
committed edit lives only in a tool's own store. Tool by tool, smallest first:
Delegation, Place cards, Timeline, then Seating — converted to TypeScript as
part of it. `lib/seating`'s `organise`, `warnings`, `roomActions` and
`alignmentSnap` are an earlier TypeScript port nothing calls; they go then,
replaced by the converted originals rather than kept beside them.

**Real-time sync** (Supabase Realtime in place of the 20-second poll, and
presence) lands after this, not before: an instant pull into a tool that still
remounts on every change would make that remount constant.

Per-record merging — two partners editing different guests do not conflict —
lands with Sync & history, over keyed records (guests, tables, blocks, jobs).

## Explicitly deferred

- RSVP collection. Joy and similar do it; Trousseau imports the result.
- Agency teams (more than one planner on a wedding).
- A public page marketing Trousseau to planners.
- A binder link for day-of helpers without an account — it would carry phone
  numbers, and deserves its own look at what a link may reveal.
- Editing tools on phones.
