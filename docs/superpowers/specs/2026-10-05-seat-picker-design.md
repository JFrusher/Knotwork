# Place cards — seat by seat: tokens you pick on a map, not type

Date: 2026-10-05
Status: built, all four phases (as-built notes at the end).
Builds on: `2026-10-04-seating-stationery-design.md` (all eight phases built).

## Why

Every token today means *this card's own guest*: `{{Name}}`, `{{Table}}`,
`{{Seat}}`, `{{Place}}`. Nothing lets a design point at a chair — "whoever sits
in seat 3 of this table", or "Table 1, seat 1" — and nothing lets anyone choose
a seat by clicking it rather than typing it.

| # | Finding | How established |
|---|---|---|
| S1 | The `room` element already lays names round a table from Seating's real geometry, upright and outside each chair, and its `show: "table"` mode is a table card's map. Table-wise auto-layout is that, with styling, not a new mechanism. | Traced (`core/template/room.ts`) |
| S2 | Chair order is `assignedGuestIds`; on a free-seating table (`seatMode: "table"`) the order exists but the seats are not real. | Traced (`lib/model/seats.ts`) |
| S4 | Found building phase 1: new tables are free-seating by default (`defaultSeatMode \|\| 'table'`), every example table is, and Seating draws a free-seating table's guests as a grid *inside* the table (`TableNode.tsx`, `tableGrid.ts`), never at chairs. Decision 8 is that convention; the floor plan, which named every chair, contradicted it. | Traced |
| S3 | Tokens resolve from a row; a chair's guest is not a column of the card's own row, so chair tokens need the room, as the `room` element gets it (`ResolveOptions.room`). | Traced |

## Decisions

| # | Question | Decision |
|---|---|---|
| 1 | What it is for | **A table card diagram** (one design, every table fills in its own chairs), **an illustrated board** (names placed by hand over artwork), and **restyling the plan** (the floor plan's names as editable boxes). |
| 2 | Tables of different shapes | **Auto-lay per table:** style one chair label; positions come from each table's real shape. |
| 3 | A pinned box, when people move | **Pinned to the chair:** it shows whoever sits there now. |
| 4 | Where picking happens | **A mini map in the inspector** (click a chair to insert its token) and **stamp all chairs** (an editable, bound box at every chair at once). |
| 5 | When the room changes under stamped boxes | **Depends on the mode:** restyle-the-plan boxes follow their chair; illustrated-board boxes stay where they were put. Chairs with no box are listed, one click to add. |
| 6 | What a chair label shows | ~~The full name~~ — revised the same day: **a name format the user sets**, once per design, built from the guest's own tokens (decision 9). The full name is its default, wrapping to two lines. |
| 7 | How auto-laid names sit | **Upright, outside the chair**, as the floor plan does now. |
| 8 | Free-seating tables | **No names at chairs:** the table's guests are listed ~~beside it~~ **inside it**, as Seating shows them (S4) — inside also keeps a whole-room plan clear of neighbouring tables — so a card never implies a seat that is not real. Names spread across as many columns as make them largest; the table's label moves above it. |
| 9 | Customising how names appear | **The format**, one per design, from tokens: `{{First Name}}`, `{{First Name}} {{Initial}}.`, `{{Last Name}}, {{First Name}}`. Everyone on that design follows it. |
| 10 | A guest's own name ("Grandma") | **Not in this build.** If added, it lives **on the guest** — a "name on cards" field used by every piece and the guest link, and a token of its own — not per piece. |

## The model

### The name format

Each design has one: `template.chairName`, a token pattern evaluated against
the room row of whoever is in a chair — so anything a card can say about its
own guest, a chair can say about its sitter: `{{First Name}}`, `{{Name}}`,
`{{First Name}} {{Initial}}.`, even `{{Name}} · {{Dietary}}`. Default
`{{First Name}} {{Last Name}}`. Edited once, in the inspector, with a live
preview of a few real guests; every chair label on the design's plans and
every chair token follows it. It replaces the `room` element's fixed
`seatLabels` choice: "seat number" is the pattern `{{Seat}}`, "nothing" an
empty one.

### Chair tokens

Two forms, both resolving to whoever is in that chair now, through the
design's name format, and empty for an empty chair:

| Form | Means | Chip shows |
|---|---|---|
| `{{At seat 3}}` | Seat 3 of *this card's* table — table-wise | `Seat 3` |
| `{{Table 1, seat 3}}` | That one chair in the room — room-wise | `Table 1 · 3` |

Distinct from the existing `{{Seat}}` (this guest's own seat number). Resolved
in `bindings` from the room scene, not the row: the card's table comes from its
`Table`. On a free-seating table they resolve empty, with a warning naming the
table (decision 8).

### Table-wise: the chair label

The `room` element's `show: "table"` gains the chair-label styling the
decisions ask for — font, size, colour, how far out from the chair — and
lists a free-seating table's guests beside it instead of at chairs. One design,
every table's card right, whatever its shape (decisions 1, 2, 7, 8).

### Room-wise and restyle: stamped boxes

**Stamp all chairs** turns a `room` element into one ordinary text box per
chair, each bound with a chair token and placed where the plan put the name.
Each box carries where it came from:

```ts
chair?: { table: string | null; seat: number; follow: boolean; dx: Mm; dy: Mm }
```

`table: null` is table-wise (`{{At seat n}}`). `follow: true` (restyle the
plan) re-places the box at its chair each time it resolves, keeping the user's
nudge as `dx, dy`; `follow: false` (illustrated board) leaves it where it was
put (decision 5). Chairs the room has and no box covers are listed in the
inspector, one click each to stamp.

### The mini map

In the inspector, beside any text field: the card's own table (table-wise) or
the whole room (room-wise), drawn from the same scene. Clicking a chair inserts
its token at the cursor. Chairs already used on the card are marked.

## Phases

1. The name format, replacing `seatLabels`, and chair tokens resolved through
   it from the room, with free-seating warnings.
2. Chair-label styling and the free-seating guest list on the table map.
3. The inspector's mini map.
4. Stamp all chairs, follow or stay, and the uncovered-chairs list.

## As built (phase 4)

- The link is `chair: { from, table, seat, follow, dx, dy }`: `from` is the
  plan the box came from, so a design with two plans keeps their boxes apart.
- `placeChairs` (core/template/room.ts) moves every following box to its
  chair's cell plus its nudge. `resolveCard`, the editable canvas and the
  inspector all go through it, so what is dragged on screen is what prints.
  Dragging or typing a position on a following box records the move as
  `dx, dy` against the preview card's cell.
- On a table's own map (`show: "table"`), boxes always follow: each table
  is shaped differently, so a fixed position would be wrong on every other
  table's card.
- Stamping switches the plan's new **Names at chairs** off, so no name prints
  twice. Free-seating tables keep listing their guests inside the table.
- Removing the plan turns its following boxes into ones that stay, left where
  they were drawn.
- Stamped boxes start at the one size the plan drew its chair names at
  (`chairNameSize`, shared with the plan's own drawing), not each at the
  largest it could be. Found in the browser: sized one by one, short names
  filled their cells and ran into each other ("HelenDavidLucia") along a long
  table, while "Rafferty" shrank.
- Chairs the plan names with no box yet are listed by table and seat, with a
  chip per chair and "Add all n". New boxes follow if the existing ones do.

## Review (2026-10-05)

A ground-up review of the whole stationery and seat-picker build: three
reviewers over the core pipeline, the state and the UI, each finding proven by
a reproducing test before it was fixed, and a scripted pass in the browser.

- `{{Known As}}` is the guest's own name, else the design's name format, read
  through one `asKnown` by cards, page cuts and reprint checks. Greeting
  starters use it; the finder keeps "Surname, First" for looking up.
- An empty value takes the punctuation that only separated it, once a value has
  been said; otherwise the punctuation after it; and its brackets.
- A finder letter carried onto a new page is headed again, so each page plans
  as the whole list did. Before, a guest could be dropped at a page break.
- Undo and redo keep what was printed (`lib/store/unhistoried.ts`); a print is
  recorded on the piece it came from; printing the few resets to the whole run.
- Stamped boxes are placed and nudged by centre; whole-room plans are drawn
  once per room and cached (225 ms to under 1 ms a card at 300 guests).
- The chair picker falls back to the room when a card has no table of its own,
  keeps focus on the map (one tab stop, arrow keys), has a visible focus ring,
  larger hit targets, and brings one table up close.
