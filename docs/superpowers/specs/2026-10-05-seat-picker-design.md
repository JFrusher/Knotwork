# Place cards — seat by seat: tokens you pick on a map, not type

Date: 2026-10-05
Status: direction approved by the maintainer (answers below). Not built.
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
| S3 | Tokens resolve from a row; a chair's guest is not a column of the card's own row, so chair tokens need the room, as the `room` element gets it (`ResolveOptions.room`). | Traced |

## Decisions

| # | Question | Decision |
|---|---|---|
| 1 | What it is for | **A table card diagram** (one design, every table fills in its own chairs), **an illustrated board** (names placed by hand over artwork), and **restyling the plan** (the floor plan's names as editable boxes). |
| 2 | Tables of different shapes | **Auto-lay per table:** style one chair label; positions come from each table's real shape. |
| 3 | A pinned box, when people move | **Pinned to the chair:** it shows whoever sits there now. |
| 4 | Where picking happens | **A mini map in the inspector** (click a chair to insert its token) and **stamp all chairs** (an editable, bound box at every chair at once). |
| 5 | When the room changes under stamped boxes | **Depends on the mode:** restyle-the-plan boxes follow their chair; illustrated-board boxes stay where they were put. Chairs with no box are listed, one click to add. |
| 6 | What a chair label shows | **The full name**, wrapping to two lines. |
| 7 | How auto-laid names sit | **Upright, outside the chair**, as the floor plan does now. |
| 8 | Free-seating tables | **No names at chairs:** the table's guests are listed beside it, so a card never implies a seat that is not real. |

## The model

### Chair tokens

Two forms, both resolving to the full name of whoever is in that chair now,
empty for an empty chair:

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

1. Chair tokens, resolved from the room, with free-seating warnings.
2. Chair-label styling and the free-seating guest list on the table map.
3. The inspector's mini map.
4. Stamp all chairs, follow or stay, and the uncovered-chairs list.
