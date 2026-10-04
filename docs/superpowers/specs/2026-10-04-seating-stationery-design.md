# Place cards — the seating stationery suite: live from the room, table-sized to room-sized

Date: 2026-10-04
Status: direction approved by the maintainer (answers recorded below). Nothing
is built with this spec; each phase is built and reviewed on its own.
Scope: keep Place cards token-driven, and extend it from guest-sized cards to
table cards and room-sized seating boards that stay in step with Seating.

## Why

Place cards prints one design, from a copy of the room taken when someone
pressed a button, on A4 or Letter. A wedding needs place cards, escort cards,
table cards and a seating board at once, all saying the same thing as the room
says now.

- **Traced** — every caller read; not run.

| # | Finding | How established |
|---|---|---|
| F1 | The room reaches the cards by copy. *Use the room* calls `setCsv(rowsFromRoom())` (`apps/plaque/ui/panels/DataPanel.tsx:80`), which writes the rows into `stationery.rows`. A guest moved in Seating afterwards keeps the old table on their card until the button is pressed again. | Traced |
| F2 | The room's columns are First Name, Last Name, Name, Table, Dietary, Side (`apps/plaque/state/fromRoom.ts:24`). No seat. | Traced |
| F3 | Seat order is stored: `table.assignedGuestIds[i]` is seat *i* (`apps/tableaux/components/canvas/TableNode.tsx:479`). Whether a table numbers its seats is `table.seatMode === "seat"`, and the guest link already derives `seat = index + 1` from it (`lib/share/snapshot.ts:63-69`). | Traced |
| F4 | Paper is A4 or Letter only (`apps/plaque/core/units.ts:15`), and a card preset may not exceed the largest page (`core/data/cardPresets.ts:52`). Nothing room-sized can be made. | Traced |
| F5 | The `stationery` slice holds exactly one `Design` (`apps/plaque/state/design.ts`, `sliceBridge.ts`). Changing from place cards to table numbers replaces the place cards. | Traced |
| F6 | Seating prints separately: a to-scale floor-plan PDF and two fixed card layouts in jsPDF (`apps/tableaux/utils/exportPdf.ts`, `cardTemplates.ts`, `components/layout/PrintModal.tsx`). It shares no fonts, tokens or design with Place cards, so the two can disagree. | Traced |
| F7 | Rows already have stable ids, and per-row overrides hang off the id (`core/data/artefacts.ts`, `rowId`). Using guest ids as row ids lets a hand-tweaked card follow its guest through a move. | Traced |
| F8 | The guest link carries its decryption key in the fragment (`lib/share/guestLink.ts:23`), but what it decrypts is an allow-list of name, table and seat (`lib/share/snapshot.ts`) — the same facts a printed board shows. A QR code of it on a public board discloses nothing the board does not. | Traced |
| F10 | Found while building phase 2: there is no CSV import left in Place cards. `setCsv` is only ever called with the room's rows (`DataPanel.tsx`: "There is no file import"). So a piece has no "file" source to keep, and the spec's `source` field is dropped: every piece prints from the room. | Traced (every `setCsv` caller) |
| F11 | A seat is stored twice, on the table and on the guest, and the tables win: `lib/seating/normalise.ts` rebuilds the guest side from `assignedGuestIds` on load, and the validator refuses a commit where they disagree. Seat lookups read the tables. | Traced |
| F9 | `document` scope makes exactly one artefact, so a list longer than one page cannot spill onto a second (`core/data/artefacts.ts`, the "ponytail" note). The alphabetical finder needs that spill. | Traced |

## Decisions

The maintainer's answers, 2026-10-04.

| # | Question | Decision |
|---|---|---|
| 1 | Which boards | **All four:** table-list board, floor-plan map, alphabetical finder, per-table card. |
| 2 | Large output | **Both:** a full-size single-page PDF for a print shop, and the same tiled across A4/Letter with overlap marks. |
| 3 | Room link | **Always live.** No *Use the room* button; rows are read from the room. Overrides keyed by guest id. |
| 4 | Several pieces | **A stationery suite:** several named pieces in the slice, shared fonts, colours and images. Existing design migrated in. |
| 5 | Seating's own print | **Retired.** Seating's Print opens Place cards on the matching piece. Its geometry is reused, not duplicated. |
| 6 | Seat numbers | **Per table, as stored**, and only where the table's `seatMode` is `"seat"`. One derivation shared with the guest link. |
| 7 | Floor-plan styling | **Styled by properties** on one `room` element, which fits itself to its box. |
| 8 | Delivery | **Phased; one commit per phase, with tests; reviewed between phases.** |
| 9 | After a print, the room changes | **Reprint just the changed:** what changed, per piece, and a PDF of only those cards. Boards reprint whole. |
| 10 | Finder order | **Surname, with letter headings;** sort is a setting. |
| 11 | Starters | **All four:** escort card with seat, table-list board, finder and floor plan, per-table card. |
| 12 | Out of scope | **Nothing.** QR codes are in. |

## The model

### Tokens

The room's columns grow; they are still just columns, so the template binding,
overrides and both renderers learn nothing new.

| Token | Value |
|---|---|
| `{{Seat}}` | `"7"`, or empty where the table's `seatMode` is not `"seat"` |
| `{{Table Number}}` | Table position by label order, `"4"` (so a named table can still carry a number) |
| `{{Table Size}}` | Seated count at the guest's table |
| `{{Initial}}` | First letter of the surname, upper-case — what the finder groups by |
| `{{Guest Link}}` | The guest-link URL, empty when none is published — what a `qr` element binds to |

The seat lookup moves out of `lib/share/snapshot.ts` into `lib/model` as one
function both callers use.

### Pieces

```ts
interface Stationery {
  pieces: Record<PieceId, Piece>;
  order: PieceId[];
  activePieceId: PieceId;
  /** Shared across pieces — a font uploaded once is everywhere. */
  uploadedIcons, assetNames
}
interface Piece {
  id, name;
  card: CardSpec; sheet: SheetSpec; template: Template;
  /** Guests printed together on one card, by guest id. */
  merged: Record<string, string[]>;
  printed: PrintRecord | null;   // decision 9
}
```

A piece stores no rows (F10). Rows are derived from the document through the
per-document cache in `lib/model/slices.ts` (selectors must not allocate),
keyed by guest id, so per-guest tweaks and combined cards follow their people.
A save from before pieces is migrated: its stored rows go, and its tweaks and
combines are re-keyed from positions to guests by name, saying what could not
be matched.

A stored single design migrates to one piece called "Place cards", with its
current source (`fileName === "the room"` → `room`). The migration is a
`persist.ts` version bump with a test against a stored v-current fixture.

### Paper

As built (phase 3). A board is a card the size of the board — A3 to A0, 50 × 70
cm, 18 × 24 in and 24 × 36 in are card presets, and the card-size cap is A0 —
rather than a page size, so no custom page dimensions are stored:

- `A3` joins A4 and Letter as paper to impose on.
- `FIT` — "the card's own size" — makes the page the card plus its margins:
  one board per page at full size, with bleed and crop marks. That is the
  **print-shop** PDF. Home-printer warnings do not apply to it.
- **Tile** cuts each full-size sheet into A4, Letter or A3 (`sheet.tilePaper`)
  with a 10 mm margin and a 10 mm overlap: trim lines on the inner edges,
  landing lines where the next tile lays, and the tile's name in the slug
  strip. A step after imposition (`core/imposition/tile.ts`), so neither
  renderer changed.

### New elements

- **`grid`** — repeats a sub-template once per group (by default, per table),
  flowing into columns inside its box: table-list boards, per-table cards'
  guest list. Shrink-to-fit applies to the whole grid, so one long table cannot
  leave the others unreadable.
- **Finder** (as built, phase 5) — the grid's second layout, `columns`: blocks
  per `{{Initial}}` flow down newspaper columns at the size asked for, lines
  ordered by `sortBy` (surname). A list that fits one page is balanced across
  its columns; a longer one is cut into one artefact per page before
  imposition (`core/data/parts.ts`, `artefactsOf`), so preview, counts,
  warnings and export see pages as artefacts and needed no change. This
  retires the F9 limitation.
- **`room`** — the floor plan from Seating's geometry (`seatPositions`,
  `floorPlanSvg`'s placement), drawn as resolved rects, lines and text so both
  renderers draw it with no new drawing code. Properties: font, name colour,
  table fill and stroke, seat style, table labels on or off, seat labels
  (first name / full name / seat number / none), zones and walls on or off,
  optional `focusTable` for a single table's mini diagram.
- **`qr`** — encodes a token (default `{{Guest Link}}`) as vector modules, so
  it prints sharp at any size.

### Reprints

`printed` records, per artefact key, a fingerprint of the row values it printed
from. On open, the piece lists changed artefacts ("Alex Ng: Table 3 → 7") and
offers *Export only these*. Boards (one artefact) say "changed since printed"
and reprint whole.

## Phases

Each phase is one commit, with tests, reviewed before the next.

1. **Suite.** Pieces in the stationery slice, piece switcher, migration of the
   single design. No behaviour change otherwise.
2. **Live room.** `source: room`, derived rows, guest-id row ids, the new
   tokens and the shared seat lookup. *Use the room* removed.
3. **Big paper.** New page sizes, print-shop export and tiling.
4. **Table boards.** The `grid` element; table-list board and per-table card
   starters.
5. **Finder.** List spill, letter headings, surname sort; finder starter.
6. **Floor plan.** The `room` element, reusing Seating's geometry; floor-plan
   starter and per-table mini map.
7. **QR, reprints, escort starter.** The `qr` element, `printed` records and
   *Export only these*; the escort-card-with-seat starter.
8. **Retire Seating's print.** Its Print button opens Place cards on the right
   piece; `exportPdf.ts` card paths and `cardTemplates.ts` removed, floor-plan
   geometry kept where the `room` element uses it.

## Open questions, to settle at the start of their phase

- ~~Phase 4: what a grid does with an unseated guest~~ — settled: left off
  the board, with a warning counting them. A board at the door is public, and
  a "Still to seat" block is a job list, not signage.
- Phase 6: whether a `room` element can show only part of the room (one
  marquee of two), or always the whole of it.
- Phase 3: CMYK or print-shop colour profiles are **not** planned; the PDF is
  RGB, as now. Say so if a print shop needs otherwise.
