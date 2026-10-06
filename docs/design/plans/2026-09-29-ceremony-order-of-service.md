# The Ceremony, in full: the order of service, its music and its words

**Goal:** Ceremony plans the whole ceremony, not only who walks. The
maintainer's words: music cues, "a more full ceremony planning with songs and
specific lyrics", and everything a ceremony plan could need.

**Architecture:** The `ceremony` slice grows from a processional into a
ceremony:

- the kind of ceremony, its officiant, its witnesses and the part of the day
  it is;
- the **order of service**, a list of moments;
- the processional, as before.

Each moment can have music: a song with where in the track to start and stop,
who plays it, and its words. A cue says when a moment or a group starts, on a
lyric or a line. Where and when the ceremony is come from the Timeline's
block, as a box's do, and the Timeline shows the cues inside that block,
read-only.

**Tech Stack:** TypeScript, the suite's kit, pdf-lib for the three new pages.
**No new dependencies.**

**Spec:** open question 3 of
[the toolbox spec](../specs/2026-09-29-toolbox-and-new-tools-design.md#open-questions),
answered 2026-09-29: cues wanted, and a fuller Ceremony.

## What a UK ceremony needs, and where it comes from

Checked against council guidance, 2026-09-29:

- **Notice of marriage** is given at least 29 days before, and up to a year
  ahead (England and Wales).
- **A civil ceremony** has no religious content, in readings or music. The
  registrar approves the choices in advance, and how far ahead varies by
  council, so no deadline is invented here.
- **The register** is signed by two witnesses.

Each becomes one of these:

- **Guidance on the page.** The legal points are written for the kind of
  ceremony chosen.
- **A mark per reading or piece of music.** In a civil ceremony, each can be
  marked as approved by the registrar, and the page counts those not yet
  approved.
- **A check.** A legal ceremony with fewer than two witnesses named is
  flagged.
- **A usual task.** "Give notice of marriage" joins the Checklist's usual
  tasks, 90 days before. That is inside the legal window, and early enough
  that nobody is caught by it.

## The shape

```ts
type CeremonyKind = "civil" | "religious" | "humanist" | "other";

interface Song {
  title: string; artist: string;
  playedBy: string;              // "String quartet", "Organ", "The DJ, from a recording"
  startSec: number | null;       // where in the track to begin: 0:45 skips an intro
  endSec: number | null;         // where to fade
  lyrics: string;                // typed by the couple; never shipped by the app
}

type MomentKind = "music" | "processional" | "welcome" | "reading" | "song" | "words"
  | "vows" | "rings" | "declaration" | "kiss" | "signing" | "recessional" | "other";

interface Moment {
  id: string; kind: MomentKind; title: string;
  members: ShotMember[];         // who leads it: a reader, a singer — the cast's kinds
  minutes: number | null;
  cue: string;                   // when it starts: "at 'And I will love you still'"
  song: Song | null;
  words: string;                 // the reading, the vows, the officiant's words
  print: boolean;                // its words and lyrics in full in the guests' order of service
  approved: boolean;             // by the registrar, for a civil ceremony
  notes: string;                 // for the officiant and whoever runs the day
}

interface WalkGroup { /* as before, with */ song: Song | null; cue: string }  // music: string → song

interface Ceremony {
  kind: CeremonyKind;
  blockId: string | null;        // the Timeline's block: where and when
  officiant: string;
  witnesses: ShotMember[];
  notes: string;
  order: Moment[];
  processional: WalkGroup[];
}
```

A stored ceremony from before this is read as one:

- A group's `music` becomes a song of that title.
- A ceremony with a processional and no order gets an order holding the
  processional, so nothing already planned disappears.

The order merges moment by moment, as boxes do, because two people write
different readings at once.

## 5a — The ceremony and its order

- [x] The shape above. The reader converts the older one, and the order is
      merged per moment.
- [x] The day's blocks with their start and end move out of Boxes to the
      model (`dayPlaces`), since two tools now read them.
- [x] Pure actions: add, change, move and remove a moment; its song; the
      witnesses; the ceremony's facts.
- [x] *Suggest an order of service* for each kind of ceremony: civil,
      religious, humanist, other. The processional is in it, every moment has
      a starting length, and every part can be changed.
- [x] Checks on the page:
  - someone named who declined, or a role nobody is cast in;
  - fewer than two witnesses at a legal ceremony;
  - in a civil ceremony, readings and music not yet approved;
  - a processional that is not in the order.
- [x] Checks between tools, in What is left:
  - the Timeline block the ceremony is on has gone;
  - the order runs longer than its block;
  - somebody in the order or among the witnesses has declined.
- [x] The page: the ceremony, the order and the processional on the left, the
      picked one on the right. A song's start and end are typed as 0:45.
- [x] The front page's area: the parts and the minutes.

## 5b — Cues on the day

- [x] The Timeline's inspector shows the ceremony's moments, music and cues
      inside its block, read-only, with the way to Ceremony.

## 5c — On paper

- [x] **The running order**, for the officiant and whoever runs the day:
  - each moment in order, with its clock time from the block;
  - who leads it, and its cue;
  - the track, from where to where;
  - the notes;
  - the processional inline.

  It replaces the processional page in the wedding pack.
- [x] **The music**, for the musicians or the DJ: every piece in order, when
      it starts, and from where to where.
- [x] **The order of service**, for the guests, on A5: each moment's title,
      and the words and lyrics of those marked to print.
- [x] The order as text, to paste into an email.

## 5d — Planners, and the example

- [x] The library's ceremony keeps:
  - the kind and the order: moments, songs, readings' words;
  - roles and words standing in for people.

  It keeps no guest, no vows, no officiant, no witnesses, no approvals and no
  block. It is shown as "Ceremony", and its stored kind keeps its name, so no
  migration is needed.
- [x] The example wedding plans a civil ceremony in full. Its readings and
      lyrics are in the public domain.

## Status

**Complete — 5a to 5d, 2026-09-29.** 1,893 suite tests, typecheck and build
clean. The Ceremony and Timeline browser tests are green: six in Ceremony,
axe on its page included. No new dependencies, and no migration: the
library's kind keeps its stored name.

**What executing it found.**

- **The approval check missed the processional's music.** In a civil
  ceremony the registrar approves the music the couple walk to, but that
  lives on the groups, not the order. The check first counted only the
  order's moments. It now counts the processional's moment whenever a group
  walks to music.
- **The day's blocks were Boxes'.** `dayPlaces` lived in Boxes' own code and
  had no end time. It moved to the model with `endMin`, since Ceremony needs
  the block's length to say when the order runs over.
- **A ceremony stored before this has no order,** and must not lose its
  processional from the prints. It is read with an order holding the
  processional under one fixed id, so every read agrees, and the first
  change stores it. A library item kept before this is applied the same way.
- **The cue label.** "Starts" read badly before the words couples naturally
  begin a cue with ("From 13:00…", "As the registrar…"). Every page now says
  "Cue:".
- **A sung song that is its own part** was named twice on the order of
  service; it is named once, with whose it is.
- **The prints share one flow.** The running order, the music and the order
  of service are three sets of rows handed to one layout, so they paginate
  and look alike. The screen and the email text are made from the same rows.
- **As built, where it differs from the plan:**
  - "Music as guests arrive" untimed at the head of the order counts as
    before the ceremony: printed "Before" and not in its length.
  - The Timeline shows the order as well as the cues.
