# The order of service as a booklet: designed in Place cards, written in Ceremony

Date: 2026-10-06
Status: built, 2026-10-06, in six phases as the plan sets out, each a commit
with its tests.
Plan: [2026-10-06-order-of-service-booklet.md](../plans/2026-10-06-order-of-service-booklet.md)

## Why

Couples judge a ceremony tool by the order of service the guests hold. Today
Ceremony prints it as a plain A5 working document: one face (Lato), a "Page 1
of 2" header on every page, no cover, flat pages rather than a folded booklet.
Place cards, next door, already has everything a printed piece needs —
positioned text, images, the bundled faces, bleed, crop marks, printer
calibration, duplex, the "changed since you printed" record. The order of
service should be made there, from words written in Ceremony.

## Findings

Each established before it was written down. **Rendered**: the example
wedding's PDFs rendered and read back. **Traced**: every caller read.

| # | Finding | How established |
|---|---|---|
| F1 | A passage taller than a page is lost. `paginate` in `lib/pdf/table.ts` gives a too-tall block its own page and "overflows it". A 122-line reading on A5 came back as one page with 41 readable lines; the other 81 are drawn below the page edge. | Rendered (probe test) |
| F2 | The processional's music never reaches the guests' copy. Its music is on the walking groups, and `renderOrderOfService` reads only the moment's own song, so "The processional" prints with nothing under it although three pieces play. | Rendered |
| F3 | Music shorter than its moment is not noticed. The example's signing is 10 minutes; Clair de Lune is set to play 0:00–5:00. Nothing says so. | Rendered + `lib/ceremony/checks.ts` |
| F4 | A reading has no author: "Sonnet 116, by William Shakespeare" is typed into the title. A song has no arrangement: "The Beatles, arranged for strings" is typed into the artist. | Rendered + `Moment`, `Song` |
| F5 | Words and lyrics print together or not at all: one `print` flag. | `lib/model/types.ts` |
| F6 | Every passage is centred. Right for a poem; wrong for prose and for call-and-response ("**All: We will.**"). | Rendered |
| F7 | Plaque already cuts one long artefact into one artefact per page, each from the same template (`core/data/parts.ts`), and everything downstream — preview, counts, warnings, export — just sees more artefacts. That is "the same design on every page". | Traced |
| F8 | `artefactsOf` has no fonts, so it cannot measure wrapped prose. The store and the export, which build the rows, do hold the fonts. | Traced (all six callers) |
| F9 | The guest link is an allow-list (`lib/share/snapshot.ts`): names, tables, seats. Anything more must be added to it explicitly, and the Privacy Policy with it. | Traced |
| F10 | The ceremony slice is loose in the contract (`z.looseObject`) and normalised by `readCeremony`, so new fields need only a default in the reader — no contract change. | Traced |

## Decisions

The maintainer's answers, 2026-10-06.

| # | Question | Decision |
|---|---|---|
| 1 | Who prints | **Both** home and a print shop. The A5 booklet is the format. |
| 2 | Where it is designed | **Place cards' editor and UX.** A suggested style, fully customisable: cover, a repeated inside-page design, a back cover, and booklet arranging. |
| 3 | Templates | **Offered, never imposed.** A couple can always start blank and make their own. |
| 4 | Pictures | **Yes**, on every inside page or only on chosen pages. |
| 5 | Lyrics and words | **The couple's choice, per part.** Whatever they type in the box is printed if they ask. |
| 6 | Author, source, arrangement | **Fields the couple may fill.** |
| 7 | Traditions | **Church of England offered;** the features it needs (responses, "please stand", hymns) work for every tradition. |
| 8 | Digital order of service on the guest link | **A feature the couple turns on.** |
| 9 | "After the ceremony" from the Timeline | **A feature the couple turns on,** choosing which parts of the day. |
| 10 | Product boundary | **Inside Knotwork.** |
| 11 | Delivery | **Phased, proceed through it.** |

## The shape

### What is said: the ceremony slice (Ceremony's own)

One editor per fact: the words, and what the guests are told, are written in
Ceremony. The booklet and the guest link both read them.

```ts
interface Song {
  /* as before */
  arrangement: string;           // "arranged for string quartet"
}

type WordsLayout = "poem" | "prose" | "responses";

interface Moment {
  /* as before, with `print` replaced by: */
  author: string;                // "William Shakespeare", "1 Corinthians 13:4–8"
  layout: WordsLayout;           // how its words are set
  guestNote: string;             // "Please stand", printed under its title
  printWords: boolean;
  printLyrics: boolean;
}

interface GuestCopy {
  processionalMusic: boolean;    // F2: name the processional's music
  welcome: string;               // a note to open with
  thanks: string;                // a note to close with
  weddingParty: boolean;         // a page of who's who, from the cast
  dayBlockIds: string[];         // "after the ceremony": the Timeline blocks to show
  onGuestLink: boolean;          // decision 8
}

interface Ceremony { /* as before */ guestCopy: GuestCopy }
```

An older moment's `print: true` reads as both `printWords` and `printLyrics`.

In `responses` layout a line that starts `All:` (or any `Name:` prefix) is a
spoken part: the prefix is set in bold. Works for any tradition.

### What it looks like: a booklet piece (the stationery slice, Place cards' own)

A booklet is a piece like any other — its own design, sharing the suite's
fonts and images — with three things a card does not have:

1. **Page roles.** Every element says which page it is on: `cover`,
   `inside` or `back`. The editor switches between them as it switches
   between a card's front and back.
2. **Show on.** An inside element is on every inside page, or only on the
   pages listed (`onPages`). A watermark on all; a photo on page 3.
3. **The service element.** A box on the inside page into which the guest
   copy flows: headings, who, music, guest notes, words. It has its own faces,
   sizes, colours and alignment per part. What does not fit carries on in
   the same box on the next inside page.

Its rows are not the room's. A booklet prints from one row of wedding facts
(`{{Couple}}`, `{{Date}}`, `{{Venue}}`, `{{Time}}`, `{{Officiant}}`) repeated
per page, each row also saying `{{Page}}` and which role it has. The number of
inside pages is the service laid out with the real fonts (F8), padded with
inside pages to a multiple of four so it folds.

### On paper

- **Home: booklet.** Two A5 pages side by side on A4 landscape, in folding
  order (for 8 pages: 8|1, 2|7, 6|3, 4|5), printed double-sided. The printer
  profile's flip edge decides whether the backs are turned 180°.
- **Print shop: pages.** Each A5 page on its own, in reading order, with
  bleed and crop marks: what a shop's imposition software expects.

### Off paper

With `onGuestLink` on, the guest link snapshot gains the guest copy — the
same blocks the booklet prints, nothing from notes, cues or the running
order — and the chosen day blocks' names, places and times. The Privacy
Policy says so in the same change.

## Out of scope

Bilingual layout, hymn-book numbers, shipped liturgy text (copyright), and
ordering print from a shop.
