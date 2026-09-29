# Trousseau — the toolbox, and four new pieces: travel, ceremony, boxes, bar

Date: 2026-09-29
Status: direction approved by the maintainer (answers recorded below). Phase 0
is built with this spec; every later phase gets its own dated plan first.
Scope: a way to add and remove tools, and four additions proposed by the
"Modular Workspace" PRD — a processional planner, a bar calculator, a packing
tool and a timeline collision checker.

## Why

The PRD proposed an opt-in workspace ("only the basics until you add more")
and four modules. It was read against the suite before anything was designed,
and a good part of it turned out to exist already.

- **Reproduced** — shown in a test, a build or a real browser.
- **Traced** — every caller read; not run.

| # | Finding | How established |
|---|---|---|
| T1 | The PRD's "shared data bus", local-first storage and lazy loading all exist: one document with one owner per slice, IndexedDB with no account needed, and every tool behind `next/dynamic`, with dialogs mounted on first open. | Traced |
| T2 | Module 4's "hard collision" is Timeline's `tag-double-booked`: the same supplier or party in two places at once. Buffers (`bufferMin`), slack and curfew are there too. **Missing:** travel time between locations, and a calendar file. There is no `.ics` anywhere. | Traced (`apps/cadence/core/schedule/conflicts.ts`); searched |
| T3 | Module 3's assignment exists — Checklist tasks have `personIds`, `dueOn` and `status`, and people are linked to guests. Packing as the maintainer describes it does not: boxes, what is in each, and where and when each must be. | Traced |
| T4 | Module 1's people exist: Group shots' cast (each partner, their parents, their wedding party, custom roles) mapped to guests. Grandparents, readers, ring bearer and flower party are not roles. | Traced (`lib/model/types.ts`) |
| T5 | A top-level key the contract does not list survives a sync, but is assembled local-over-server with no conflict (`mergeCloudDocument.ts`, lines 107 and 163), so a partner's edit to it is silently lost on the next push. **Every new slice goes into `SLICE_NAMES`.** | Traced |
| T6 | Every page loads the same 522 KB of gzipped JavaScript; a tool's own code adds 7 KB (Checklist) to 76 KB (Seating). 144 KB of the shared part is fontkit, reached statically from the store: `useTrousseauStore → documents/assets → portableAssets → plaque/syncAssets → plaque/sliceBridge → plaque/design → template/defaults → text/fit → text/measure`. The PRD's 100 KB per module is already met; the weight is underneath every module. | Reproduced — production build, each route loaded in Chromium and its JS summed; fontkit matched by its shaper tables against `node_modules/fontkit`; the chain traced by static imports |
| T7 | Ctrl/⌘ K is the command palette. | Traced |

## Decisions

The maintainer's answers, 2026-09-29. Where the answer delegated the choice,
the choice made is recorded with its reason.

| # | Question | Decision |
|---|---|---|
| 1 | The PRD against the 2026-09-28 master plan | **The master plan wins.** The header, not a left sidebar; partners' names, not "bride"; one document, not micro-frontends. |
| 2 | What is opt-in | **The five stay, on by default, and can be removed** by someone who really wants to. New tools are added from the toolbox. |
| 3 | Where "which tools" lives | **In the wedding** — the partner and the planner see the same set. |
| 4 | The toolbox | **A slide-over at the right edge, with Add.** No keyboard shortcut of its own. |
| 5 | Public calculator pages for search | **Not intended.** Everything here is inside the planning app. |
| 6 | Module 4 | **Timeline features.** Travel times are typed by the couple: no lookup, no new `connect-src`. |
| 7 | Packing | **Its own tool**: boxes, what is in each, found easily, and each box tied to a part of the day — "this box has my shoes in it and needs to be at the house for 9". |
| 8 | Processional and group shots | **They share their people.** |
| 9 | Bar | **UK first, and every number adjustable.** |
| 10 | Tools feeding each other | Delegated: **proposed below**, each for the maintainer to accept on its own. |
| 11 | The wedding pack | **New printed pieces join it.** |
| 12 | Planners | **New tools' work can be kept in the library.** |
| 13 | Where the set is stored | Delegated: **a slice of its own, `tools`.** `event` is the wedding's who, where and when, and merges as one part: a list kept there would conflict whenever one partner changed the date while the other added a tool. A slice of its own merges on its own. |
| 14 | What removing a tool does | Delegated: **hides it, deletes nothing.** Its tab, its area on the front page, its entries in What is left, its tour chapter and its palette entry go. Its work is kept, the removal is one undo step, and adding it back brings it back as it was. Its page still opens from its address. |
| 15 | Where the shared people live | Delegated, for Phase 2: **a slice of their own, `cast`**, moved out of `shots` on load. A tool rewrites only its own slice; once two tools edit the cast, it is neither tool's. |

The maintainer's second answers, the same day, after Phase 0 was built:

| # | Question | Decision |
|---|---|---|
| 16 | Boxes as designed in Phase 3 | **Yes**: each box on a block of the day, its where and when the block's. |
| 17 | Guests | **A tab of its own at the top**, first. Delegated: **never removable**, because every tool is built on the guest list, so it is not in the toolbox. |
| 18 | Money, Checklist, Binder | **In the toolbox**, as tools. Delegated: **off until added** — the words were "in the tool box" against "a tab on the top", and a header of Guests and the five is the clean start the PRD asked for. This replaces the master plan's rule that the wedding's own pages sit under its name; only Overview is left there. |
| 19 | Room in the header | Delegated: **the tool on screen keeps its controls; the tabs give way and scroll.** Measured at 1024px with every tool added: the tabs took 392px and left Timeline's controls 244 of the 323 they need. Denser tabs would have bought about 90px, enough today and not once Phase 1–4 add tools. |
| 20 | A blog | **Wanted** (the maintainer, 2026-09-29), to draw couples in from search and give them a way to share their experiences. Decision 5 stands for calculator pages; the blog's guides link into the tools instead. Delegated: **posts as data in the repository**, as the policies are, and **stories by email**, published only once the couple has seen the page and said yes. A form that stores strangers' stories, with moderation, is left for the maintainer to decide. |

## Phase 0 — the toolbox

**Built 2026-09-29**, with [its plan](../plans/2026-09-29-toolbox.md).

- **The `tools` slice** is `{ shown: string[] }`. With nothing stored, the tools
  marked `defaultOn` are shown — the five — which is every wedding today and
  every new one; Money, Checklist and Binder wait in the toolbox. Once somebody
  adds or removes a tool the list is stored as written, and it keeps ids this
  build does not know: a tool a newer version added is never removed by an
  older one writing its own change.
- **The registry** (`lib/tools.ts`) gives each tool a stable `id`, which is
  what is stored; an address could be renamed. `shownTools(doc)` gives the
  shown tools in the registry's order, cached per document like every other
  derived view.
- **The header** shows Guests, always first, then the shown tools, and ends the
  row with **+**, which opens
  **Tools** (`?panel=tools`): every tool with what it is for, and Add or
  Remove. A removal says the work is kept, and is one step on the wedding's
  history ("Undo removing Seating").
- **Not shown means out of sight everywhere at once**, whether removed or
  never added: the header, the front page's areas, What is left (in
  `readiness` itself, so the planner's Weddings page, which runs it on the
  server, agrees), "Take a tour", and the palette's pages. Records in the
  palette — a table, a block — still open where they live. So a wedding that
  has not added Money hears nothing of balances falling due.
- **The example wedding shows every tool**, held there by a test: it exists to
  show what Trousseau does, and the tour and front page point at all of it.

## Phase 1 — Timeline: travel between places, and calendars

**Built 2026-09-29**, with [its plan](../plans/2026-09-29-timeline-travel-and-calendars.md).
Two things below were corrected by the code before they were built, and are
written here as built: who moves is a **tag**, not a lane; and calendar times
are the **venue's clock**, not UTC.

- **Travel times** the couple types: `timeline.travel`, a list of
  `{ between: [placeA, placeB], minutes }`, the same either way. The panel lists
  the pairs the day actually moves between (from the blocks' locations), so
  there is nothing to invent, only blanks to fill.
- **A new advisory, `no-travel-time`**: a tag that ends one block at one place
  and starts its next somewhere else sooner than the typed time allows,
  measured from where the run sheet says the block ends (before its
  contingency buffer) — "Hair and make-up ends at 13:00 at the house; the first look starts
  at 13:05 at the venue, 15 minutes away." A pair with no time typed is never
  guessed at and never flagged. Advisory, because a person running is not a
  print run that should stop. *Not a lane:* the example's Suppliers lane holds
  the florist, the caterer and the band, and Transport the cars and the guest
  coach — a lane is a kind of activity, and checking one would say the coach
  cannot get from where the cars were. Tags are already who is where; the
  panel tells a couple to tag their own blocks ("couple") to be checked.
- **Calendar files**: the day as `.ics`, whole or for one supplier (a tag's
  blocks), written in the browser, on the wedding's own date and refused
  without one — the timeline's `day.date` is a placeholder, 20 June 2026, until
  a date is set. Times are **local, with no zone**, so 13:30 at the venue is
  13:30 on every phone, as in the Binder. Not UTC: that needs the day's offset,
  and an offset nobody entered reads as British Summer Time in the Day panel,
  indistinguishable from one chosen — a winter wedding would be an hour out in
  every calendar. (This spec first said UTC would show "the venue's clock";
  UTC shows the phone's.) Refused while the day has clashes, as the PDFs are.
- **The clocks, fixed the same day.** The fallback went further than the Day
  panel: every Timeline edit — renaming a block was enough — wrote it into the
  wedding, where the Binder then trusted it over the phone's own clock
  (reproduced in a test before the fix). The offset is now null until chosen,
  in the timeline, the published day and Delegation's reader; the panel says
  *Not set*, any choice is a change, and sunset and golden hour wait for it.

## Phase 2 — one cast, and Ceremony

**Grown 2026-09-29** into the whole ceremony — the order of service, songs
with where to start and the lyric each cue falls on, readings, witnesses, and
the cues shown inside the Timeline's block — with
[its plan](../plans/2026-09-29-ceremony-order-of-service.md).

**Built 2026-09-29**, with [its plan](../plans/2026-09-29-cast-and-ceremony.md).
As built, where it differs from below: the suggested order ends with the
couple walking in together, since who walks with whom is theirs to say; the
officiant is words rather than a crew member; and there is no tour chapter,
the tour being held under thirty steps.

- **`cast`** takes Group shots' cast and custom roles, moved on load by the
  existing load-time pass. The fixed roles gain each partner's grandparents
  (a party role, as the wedding party is). Readers, ring bearer, flower party
  and the like are custom roles, as "Me and my family" already is. Group shots
  reads it exactly as before.
- **Ceremony** (`/ceremony`, slice `ceremony`, added from the toolbox): the
  processional as an ordered list of groups. Each group names who walks —
  a role, a custom role, a guest, a family, a crew person (the officiant is
  usually a supplier, not a guest) or free text — how they walk (alone, in
  pairs, in threes), which side they go to (named after the partners), and a
  cue: the music and the moment it changes.
- **"Suggest an order"** from the cast, as Group shots' `propose` does: a
  starting point in the usual UK order, entirely editable.
- **Checks**: someone in the processional who has declined; a role nobody has
  been cast in. Both through the cast's own resolver, as group shots do now.
- **Prints**: one page for the officiant and whoever runs the day, and plain
  text to paste into an email. The page joins the wedding pack.

## Phase 3 — Boxes

**Built 2026-09-29**, with [its plan](../plans/2026-09-29-boxes.md). As built,
where it differs from below: a thing moves between boxes from a menu on its
row rather than by dragging; items carry no notes of their own; a box not for
the day needs nobody to take it; and the library adds boxes to a wedding
rather than replacing its own.

The maintainer's words: boxes, what is in each, "in a good intuitive way", and
each box attached to a part of the day. The design below was confirmed as it
stands (decision 16).

```ts
interface Box {
  id: string;
  /** Printed large on its label: "3". */
  number: number;
  name: string;               // "Getting ready — Alex"
  items: Item[];
  /** The part of the day it is needed for: where and when come from the block. */
  blockId: string | null;     // null: not for the day — the honeymoon case
  personIds: string[];        // who gets it there
  notes: string;
}
interface Item { id: string; label: string; quantity: number; packed: boolean; notes: string }
```

- **Where and when are the block's.** "Needs to be at the house for 9" is a box
  on the block "Getting ready", at the house, at 09:00; move the block and the
  box moves with it. A drop-off that is not a block of its own is a moment
  (a block with no length), which Timeline already has. One way to say where
  and when, not a second one typed on the box.
- **Finding things**: one search over every box ("shoes" → Box 3), items moved
  between boxes by dragging, and each box's packed count on its card.
- **Checks**: a box whose block is gone (as a job's can be); unpacked items
  close to the day; a box nobody is taking.
- **Prints**: a label per box — its number, name, where and when, and what is
  in it — and a packing list, as PDF and CSV. The list joins the wedding pack.
- **Starter boxes** are UK first: rings, the paperwork the ceremony needs,
  supplier envelopes, the emergency kit, the guest book, and so on — a list to
  edit, as "Add the usual tasks" is.

## Phase 4 — Bar

**Built 2026-09-29**, with [its plan](../plans/2026-09-29-bar.md), whose
defaults the maintainer agreed before it was built. As built, where it differs
from below: evening-only guests are a figure of the Bar's own, since the guest
list does not say who is invited for the evening; the toast is fizz and the
meal is wine, and only the reception and the evening pour a mix; and prices
have no defaults.

UK first, and every figure on screen, editable, and resettable to its default.

- **Who is drinking**: the guests coming (`isComing`), live, less a share not
  drinking. The count can be overridden, and says so while it is.
- **By part of the day**, because a UK wedding drinks in parts: the drinks
  reception, the toast, the meal's wine, and the evening bar. Each part has its
  own hours and per-head rate.
- **UK units**: wine and fizz in 75cl bottles, 125ml or 175ml glasses; beer in
  330ml bottles, 500ml cans, cases of 24; spirits in 70cl bottles, 25ml
  measures; soft drinks and mixers in litres; ice in kilos.
- **Bar types**: full bar; beer and wine; signature cocktails with beer and
  wine; low and no alcohol.
- **Adjusting**: a lighter or heavier crowd; prices per bottle or case, giving
  an estimated spend; "we already have" per line; round up to whole cases for
  sale or return, which UK merchants commonly offer.
- **The shopping list** grouped by where it is bought — supermarket, wine
  merchant, cash and carry — editable.
- **The defaults are the product's credibility**, and are agreed with the
  maintainer in Phase 4's plan before they are built.

## Tools feeding each other — proposals

None of these is built without the maintainer accepting it. Each keeps the
rule that a tool writes only its own slice and reads the others'.

| From | To | What |
|---|---|---|
| Boxes | Delegation | A person taking a box sees "Box 3 to the house by 09:00" on their job sheet. Derived from the box, never stored as a job, so it follows the block. |
| Boxes | Binder | Find a box or an item on the day: "where are the rings?" |
| Ceremony | Timeline | The processional's cues shown inside the ceremony block, read-only. |
| Ceremony | Binder | The order of walking, on the phone, on the day. |
| Bar | Timeline | Reception, meal and evening hours read from the blocks the couple picks, rather than typed twice. |
| Bar | Money | The estimated spend shown against the budget as planned, not paid. |
| Bar | Checklist | "Buy the drinks" and "Collect the ice", dated back from the day. |
| Bar | Boxes | Crates as boxes, attached to the bar's block. |
| Timeline | Supplier links | Each supplier's calendar file on their own call sheet. |

## Library

A planner keeps, as the existing kinds are kept, without anything personal:
a **processional** as roles and formations with no guest named; a **set of
boxes** with their items and no people or blocks; **bar settings** — rates,
units and prices — with no guest count.

## Open questions

1. **T6**: ~~take fontkit off every page~~ — **done 2026-09-29**: one constant,
   `DEFAULT_FIT`, moved beside the other template defaults; 522 KB shared to
   393 KB, and a test that walks both layouts' imports and names the chain if
   the engine comes back. A CI check on each page's own JavaScript: **not
   wanted** (the maintainer, 2026-09-29); the font-engine test stays as the
   one guard.
2. ~~**S18**~~ — **the analytics stay, and the Privacy Policy says what they
   count** (the maintainer, 2026-09-29). Done the same day: every counted
   address is cut to its route first, so no link's token, wedding id, query
   or fragment is sent (`lib/pageCounts.ts`, with a test that finds every
   page with a token in its address); the policy names the three services
   that run the hosted site; and its test now reads the layout rather than
   its own words, which is how the analytics got in unseen.
3. ~~**Cues on the day**~~ — **wanted**, with a fuller Ceremony: the whole
   order of service, songs with the lyric each cue falls on, and readings
   (the maintainer, 2026-09-29). See
   [its plan](../plans/2026-09-29-ceremony-order-of-service.md).
4. ~~**Order of phases**~~ — **all four built, 2026-09-29**, in the order
   proposed: Timeline, Ceremony, Boxes, Bar.

## Explicitly deferred

- Public calculator pages for search (decision 5).
- A keyboard shortcut for the toolbox (decision 4).
