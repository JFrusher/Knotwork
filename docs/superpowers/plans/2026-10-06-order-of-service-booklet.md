# The order of service as a booklet — the plan

**Spec:** [2026-10-06-order-of-service-booklet-design.md](../specs/2026-10-06-order-of-service-booklet-design.md)

**Goal:** a couple writes their ceremony in Ceremony and designs a folded A5
order of service in Place cards — cover, repeated inside design, back cover,
pictures, their own style — printed at home as a booklet or by a shop.

**Tech:** TypeScript, pdf-lib and Plaque's core. No new dependencies.

Each phase is one commit with its tests, built on the one before.

## Phase 1 — Ceremony: what is printed

- **F1, fail first.** A test renders a passage taller than an A5 page and
  asserts every line is readable and none is off the page. Fix: a block
  taller than a page is split between lines, carrying on on the next page.
- **F3, fail first.** `musicShort(ceremony)`: moments whose music ends
  before the moment does (where an end is set). Shown on the Ceremony page
  beside the moment.
- **The model.** `author`, `layout`, `guestNote`, `printWords`,
  `printLyrics` on a moment; `arrangement` on a song; `guestCopy` on the
  ceremony. Defaults in the reader; an old `print` reads as both.
- **The guest copy.** `guestCopy(ceremony, …)` → blocks: title, author,
  guest note, who, music (the processional's groups' music when
  `processionalMusic`), words and lyrics as chosen, each with its layout.
  The running order, the music sheet and the text copy show author and
  arrangement.
- **Church of England.** The religious starter follows the Common Worship
  shape, with "Please stand" where the congregation stands, and no shipped
  liturgy text.
- **The page.** Fields for all of the above in the Ceremony board.

## Phase 2 — Place cards: the booklet engine (core, no UI)

- `CardElement` gains `page?: "cover" | "inside" | "back"` and
  `onPages?: number[]`; absent means a card's own (cover for a booklet).
- `ServiceElement` (`kind: "service"`): box, faces and sizes for heading,
  body and words, colours, alignment, gap between parts.
- `layoutService(blocks, element, measure)` → lines per inside page, split
  between lines, a heading never alone at the foot of a page.
- `bookletRows(facts, pageCount)` → cover, inside 1…n, back, padded to ×4.
- Resolving: an element is drawn on a page only if its role and `onPages`
  match the row; the service element draws its page's lines.
- `imposeBooklet(artefacts)` → folding order; backs turned 180° for a
  long-edge printer.
- Tests: page count and padding, folding order for 4/8/12 pages, a long
  reading flowing across pages with nothing lost, a picture on chosen pages
  only, both outputs rendered and read back.

## Phase 3 — Place cards: the booklet in the editor

- An **Order of service** piece, made from Ceremony's "Design the order of
  service" or Place cards' piece menu, A5, its rows the wedding's facts.
- A Cover / Inside / Back switch where a card has Front / Back.
- "Show on: every inside page / pages …" for an inside element.
- The service element's inspector; the page count shown, with what pads it.
- Print setup: **Booklet at home** or **Pages for a print shop**.
- Ceremony's own guest A5 print is retired for this.

## Phase 4 — Starter styles

Classic (Crimson Text, ruled frame), Modern (Lato and Marcellus, open), and
Script (Great Vibes headings). Each a gallery file, rendered by the test
corpus. Applying one keeps the couple's words and pictures.

## Phase 5 — Sections

The welcome note, the wedding party (from the cast), "after the ceremony"
(the Timeline blocks the couple ticks), and the thank-you, each flowing in the
service in that order when present.

## Phase 6 — The guest link

With `onGuestLink` on, the snapshot carries the guest copy and the chosen day
blocks, allow-listed; the guest page shows them under "The ceremony". Privacy
Policy updated in the same commit.
