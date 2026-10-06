/**
 * The entity shapes the suite reads and writes.
 *
 * These are the shapes the four standalone apps already use, transcribed to
 * TypeScript — Tableaux's guest and table, Cadence's block, Brigade's job.
 * They live here rather than in `@jfrusher/knotwork` on purpose: that package
 * validates the envelope and stops at the slice boundary, so that a change to
 * what a guest is does not need a release of the contract. See its
 * `src/slices.ts` for the reasoning.
 */

export type RsvpStatus = "confirmed" | "declined" | "pending";
/**
 * Whose side of the family a guest is on: partner `a`'s, partner `b`'s, both,
 * or not said. Named in words by `lib/model/partners`, after the partners.
 */
export type Side = "a" | "b" | "both" | "";
export type SeatMode = "table" | "seat";

/** A person on the list. Lives in the `guests` slice, keyed by id. */
export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  /**
   * What the guest is called on the stationery, when it is not what the
   * design's name format would make of them: "Granny Jo", "Dr Okafor". Empty
   * for none.
   */
  knownAs: string;
  email: string;
  rsvpStatus: RsvpStatus;
  /** A key from `lib/model/dietary` — "vegetarian", "other" — or "" for none. */
  dietary: string;
  /** What the guest actually said, for the caterer and the card. */
  dietaryRaw: string;
  /** The chosen main course, when the couple asked. Read by the place cards. */
  entree: string;
  notes: string;
  side: Side;
  groupId: string | null;
  subgroupId: string | null;
  familyId: string | null;
  /** The table this guest sits at, or null. Mirrors `Table.assignedGuestIds`. */
  assignedTableId: string | null;
  /** Free-text labels of the couple's own devising. Filterable, never enumerated. */
  tags: string[];
  /**
   * The guest this one is a plus-one of, or null.
   *
   * Recorded rather than derived because "Charis Smith + guest" arrives on the
   * RSVP as one row and becomes two people, and losing which of them was
   * invited loses why the second is there.
   */
  plusOneOf: string | null;
}

/** A pair of guests who must, or must not, share a table. */
export type ConstraintKind = "together" | "apart";

export interface Constraint {
  id: string;
  kind: ConstraintKind;
  /** Exactly two. A rule about three people is three rules. */
  guestIds: [string, string];
  note: string;
}

/** Real-world footprint in centimetres. Absent on plans authored before units. */
export type SizeUnits =
  | { shape: "circle" | "half-circle"; diameter: number }
  | { shape: "rect"; width: number; height: number };

/** What a table is for, beyond its shape. Drives warnings and reports. */
export type Designation = "top-table" | "vip" | "kids" | "band-bar" | null;

export interface Table {
  id: string;
  label: string;
  type: string;
  capacity: number;
  /** Canvas pixels, centre of the table. */
  x: number;
  y: number;
  rotation: number;
  /** `seat` means the index in `assignedGuestIds` is the seat number. */
  seatMode: SeatMode;
  /** Ordered. For seat-mode tables the index is the seat. Holes are `null`. */
  assignedGuestIds: Array<string | null>;
  sizeUnits?: SizeUnits;
  /** Per-edge seat counts, once a drag has pushed chairs off a blocked side. */
  perSideSeats?: PerSideSeats | null;
  /** The arc a round table's seats are confined to, once neighbours crowd it. */
  seatArcRange?: { start: number; total: number } | null;
  designation: Designation;
  /** Overrides the type's colour on the canvas. */
  colour: string | null;
}

export interface PerSideSeats {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** A named collection of guests — "Alex's family", "University". */
export interface NamedGroup {
  id: string;
  name: string;
  colour?: string;
}

/**
 * A family, which is a group that must not be split across tables.
 *
 * Membership is held here as well as on the guest because the split warning
 * asks "is this family together?", and answering it from the guest side means
 * scanning every guest for every family on every render.
 */
export interface Family extends NamedGroup {
  memberIds: string[];
}

/** A labelled area of floor — "Dance floor", "Bar". Not a table, not a wall. */
export interface Zone {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  colour: string;
}

/**
 * One floor space: a rectangle, or a polygon whose vertices are relative to
 * its origin. A wedding in a marquee plus a barn is two spaces, not one
 * bounding box with dead ground in the middle.
 */
export type Space =
  | {
      id: string;
      label: string;
      shape: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
      backgroundColour: string;
    }
  | {
      id: string;
      label: string;
      shape: "polygon";
      x: number;
      y: number;
      vertices: Array<{ x: number; y: number }>;
      backgroundColour: string;
    };

/** A wall segment or a pillar — something a table cannot be put through. */
export interface Obstacle {
  id: string;
  kind: "wall" | "pillar";
  x: number;
  y: number;
  /** Walls use both; a pillar is drawn as an ellipse in the same box. */
  width: number;
  height: number;
  rotation: number;
}

export interface RoomSpec {
  widthUnits: number;
  heightUnits: number;
  width: number;
  height: number;
  backgroundColour: string;
  spaces: Space[];
}

export type UnitSystem = "metric" | "imperial";

export interface SeatingSettings {
  defaultSeatMode: SeatMode;
  /** Canvas pixels per centimetre. Locked per plan — see `slices.DEFAULT_PPU`. */
  pixelsPerUnit: number;
  gridSnap: boolean;
  gridSize: number;
  /** Snap a dragged table to the edges and centres of its neighbours. */
  snapAlign: boolean;
  showChairs: boolean;
  /** Diameter of a banquet chair, in centimetres. */
  chairSizeUnits: number;
  showDietaryBadges: boolean;
  showGroupColours: boolean;
  unitSystem: UnitSystem;
  customTablePresets: CustomTablePreset[];
}

/** A rectangle table with seat counts the user set per edge. */
export interface CustomTablePreset {
  id: string;
  label: string;
  widthUnits: number;
  heightUnits: number;
  perSideSeats: PerSideSeats;
}

/** A whole plan, kept so a rearrangement can be abandoned. */
export interface Snapshot {
  id: string;
  label: string;
  at: string;
  /** The `seating` and `guests` slices as they were. */
  seating: unknown;
  guests: unknown;
}

/**
 * The `seating` slice. Guests are deliberately not in here — they are their own
 * slice, because the place cards and the crew sheets need them and neither
 * cares where the tables are.
 */
export interface Seating {
  tables: Record<string, Table>;
  groups: Record<string, NamedGroup>;
  subgroups: Record<string, NamedGroup>;
  families: Record<string, Family>;
  zones: Record<string, Zone>;
  obstacles: Record<string, Obstacle>;
  constraints: Constraint[];
  snapshots: Snapshot[];
  room: RoomSpec;
  settings: SeatingSettings;
}

/** One piece of work on the day. The `crew` slice. Brigade's model. */
export interface Team {
  id: string;
  tag: string | null;
  name: string;
  phone: string;
  notes: string;
  /** For sending the call sheet. Teams had a phone and no email. */
  email: string;
  /** Agreed total, in whole units of the couple's own currency. Null if not agreed. */
  cost: number | null;
  /** Deposit, where one was asked for. */
  deposit: number | null;
  /** ISO date the deposit was paid, or "" if it has not been. */
  depositPaidOn: string;
  /** ISO date the balance falls due, or "". */
  balanceDueOn: string;
  /** ISO date the balance was paid, or "" if it has not been. */
  balancePaidOn: string;
  /** ISO date this team confirmed their jobs and times, or "". */
  confirmedOn: string;
}

export interface Person {
  id: string;
  name: string;
  teamId: string | null;
  phone: string;
  notes: string;
  /** The guest this person is, when they are one. Null for crew who are not guests. */
  guestId: string | null;
}

export interface Job {
  id: string;
  /** The block of the day this hangs off, or null for a task not tied to it. */
  blockId: string | null;
  label: string;
  notes: string;
  teamId: string | null;
  personIds: string[];
  /** Kanban column. Derived work is not stored; this is the user's own mark. */
  status: JobStatus;
  /** ISO date a task off the day should be done by, or "". The Checklist's. */
  dueOn: string;
}

export const JOB_STATUSES = ["todo", "doing", "done"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export interface Crew {
  teams: Team[];
  people: Person[];
  jobs: Job[];
  /** What the couple intends to spend in total, or null if they have not said. */
  budget: number | null;
  /** The ids of errands the Checklist works out from other tools (the Bar's shopping) that are ticked off. */
  errandsDone: string[];
}

// group shots ------------------------------------------------------------------

/**
 * Who somebody is to the couple — one of them, a parent, a grandparent, the
 * wedding party — by which partner they belong to. Named in words by
 * `roleLabel`, after the partners: `b-mother` is "Sam's mother".
 */
export type CastRole =
  | "a"
  | "b"
  | "a-mother"
  | "a-father"
  | "b-mother"
  | "b-father"
  | "a-grandparents"
  | "b-grandparents"
  | "a-party"
  | "b-party";

export const CAST_ROLES: readonly CastRole[] = [
  "a",
  "b",
  "a-mother",
  "a-father",
  "b-mother",
  "b-father",
  "a-grandparents",
  "b-grandparents",
  "a-party",
  "b-party",
];

/** Roles that hold at most one person. Grandparents and the wedding parties hold many. */
export const SINGLE_ROLES: ReadonlySet<CastRole> = new Set(["a", "b", "a-mother", "a-father", "b-mother", "b-father"]);

/** Guest ids per role. Singular roles hold 0 or 1; party roles hold many. */
export type Cast = Record<CastRole, string[]>;

/** A user-defined role, alongside the fixed cast — e.g. "Me and my family". Always a party role. */
export interface CustomRole {
  id: string;
  name: string;
  guestIds: string[];
}

/** Where one person in a shot comes from — pinned, or resolved live from another slice. */
export type ShotMember =
  | { kind: "guest"; ref: string }
  | { kind: "family"; ref: string }
  | { kind: "group"; ref: string }
  | { kind: "role"; ref: CastRole }
  | { kind: "customRole"; ref: string }
  | { kind: "text"; ref: string };

export interface Shot {
  id: string;
  /** Blank means the printed label is built from the members instead. */
  label: string;
  members: ShotMember[];
  notes: string;
}

export interface ShotSection {
  id: string;
  name: string;
  shots: Shot[];
}

/** The `shots` slice. Ensemble's model: the list itself, whoever is in it. */
export interface Shots {
  sections: ShotSection[];
}

/**
 * The `cast` slice: who is who, shared by Group shots and Ceremony, so a
 * mother named once is the same mother in the photographs and down the aisle.
 */
export interface CastSlice {
  roles: Cast;
  customRoles: CustomRole[];
}

// ceremony --------------------------------------------------------------------

/** How a group walks: one at a time, side by side in pairs, or in threes. */
export type Formation = "single" | "pairs" | "threes";

/** What kind of ceremony it is, which decides the order suggested and what the law asks of it. */
export type CeremonyKind = "civil" | "religious" | "humanist" | "other";
export const CEREMONY_KINDS: readonly CeremonyKind[] = ["civil", "religious", "humanist", "other"];

/**
 * A piece of music, as the people playing it need it: which track, played by
 * whom, where in it to begin and where to stop, and its words.
 */
export interface Song {
  title: string;
  artist: string;
  /** "String quartet", "Organ", "The DJ, from a recording". */
  playedBy: string;
  /** Where in the track to begin, in seconds: 45 skips an intro. Null is the start. */
  startSec: number | null;
  /** Where to fade, in seconds. Null plays it to the end. */
  endSec: number | null;
  /** "Arranged for string quartet": how this version differs from the original. */
  arrangement: string;
  /** Typed by the couple, for the singers or the order of service. The app ships none. */
  lyrics: string;
}

/**
 * How a part's words are set on paper: a poem line by line, prose as
 * paragraphs, or responses — spoken parts, the congregation's (lines starting
 * "All:") in bold, as a service sheet sets them in any tradition.
 */
export type WordsLayout = "poem" | "prose" | "responses";
export const WORDS_LAYOUTS: readonly WordsLayout[] = ["poem", "prose", "responses"];

/** What a part of the ceremony is, which decides its words, its checks and its print. */
export type MomentKind =
  | "music"
  | "processional"
  | "welcome"
  | "reading"
  | "song"
  | "words"
  | "vows"
  | "rings"
  | "declaration"
  | "kiss"
  | "signing"
  | "recessional"
  | "other";
export const MOMENT_KINDS: readonly MomentKind[] = [
  "music",
  "processional",
  "welcome",
  "reading",
  "song",
  "words",
  "vows",
  "rings",
  "declaration",
  "kiss",
  "signing",
  "recessional",
  "other",
];

/** One part of the order of service, in the order it happens. */
export interface Moment {
  id: string;
  kind: MomentKind;
  title: string;
  /** Who leads it — a reader, a singer — as the cast's kinds, resolved as a shot's are. */
  members: ShotMember[];
  minutes: number | null;
  /** When it starts: "at 'And I will love you still'", "as the registrar finishes". */
  cue: string;
  song: Song | null;
  /** Whose words: "William Shakespeare", "1 Corinthians 13:4–8". */
  author: string;
  /** The reading, the vows, the officiant's words. */
  words: string;
  layout: WordsLayout;
  /** For the guests, under its title: "Please stand". */
  guestNote: string;
  /** Its words in full in the guests' order of service, not only its title. */
  printWords: boolean;
  /** Its song's lyrics in full in the guests' order of service. */
  printLyrics: boolean;
  /** Approved by the registrar: a civil ceremony's readings and music need to be. */
  approved: boolean;
  /** For the officiant and whoever runs the day. */
  notes: string;
}

/**
 * One group in the processional, in the order they walk. Its members are the
 * kinds a group shot's are — a role, a guest, a family, words — and resolve
 * the same way, from the one cast.
 */
export interface WalkGroup {
  id: string;
  /** Blank means the printed label is built from the members instead. */
  label: string;
  members: ShotMember[];
  formation: Formation;
  /** Which side of the aisle they go to: a partner's, both, or not said. */
  side: Side;
  /** A new piece starting as this group walks, or null: the one playing carries on. */
  song: Song | null;
  /** When they set off: "at 'At last'", "when the music changes". */
  cue: string;
}

/** The `ceremony` slice. Ceremony's own. */
export interface Ceremony {
  kind: CeremonyKind;
  /** The Timeline's block it is: where and when come from there, as a box's do. */
  blockId: string | null;
  /** "Mrs Ada Jones, the registrar". */
  officiant: string;
  /** Who signs the register as witness. */
  witnesses: ShotMember[];
  notes: string;
  /** The order of service. */
  order: Moment[];
  processional: WalkGroup[];
  guestCopy: GuestCopy;
}

/** What the guests are told about the ceremony, beyond the parts themselves: theirs to choose. */
export interface GuestCopy {
  /** Name the processional's music under it, group by group. */
  processionalMusic: boolean;
  /** A note from the couple to open with, or "". */
  welcome: string;
  /** Who's who: the parents, grandparents and wedding parties, from the cast. */
  weddingParty: boolean;
  /** "After the ceremony": the Timeline's blocks the guests are told about, by id. */
  dayBlockIds: string[];
  /** A note from the couple to close with, or "". */
  thanks: string;
  /** Show it on the guest link too, below where a guest finds their seat. */
  onGuestLink: boolean;
}

// boxes -----------------------------------------------------------------------

/** One thing packed, or to be. */
export interface BoxItem {
  id: string;
  label: string;
  quantity: number;
  packed: boolean;
}

/**
 * A box for the day: what is in it, and the part of the day it is needed for.
 * Where and when are that block's — its location and its start — never typed
 * onto the box, so moving the block moves the box.
 */
export interface Box {
  id: string;
  /** Printed large on its label. */
  number: number;
  name: string;
  items: BoxItem[];
  /** The block it is needed for, or null: not for the day — the honeymoon bag. */
  blockId: string | null;
  /** Who gets it there: people from the crew. */
  personIds: string[];
  notes: string;
}

/** The `boxes` slice. Boxes' own. */
export interface Boxes {
  boxes: Box[];
}

// bar -------------------------------------------------------------------------

/** The kind of bar, which sets what the reception and the evening pour. */
export type BarKind = "full" | "beer-and-wine" | "cocktails" | "no-and-low";
export const BAR_KINDS: readonly BarKind[] = ["full", "beer-and-wine", "cocktails", "no-and-low"];

/** A lighter or heavier crowd than most. */
export type Crowd = "lighter" | "usual" | "heavier";
export const CROWDS: readonly Crowd[] = ["lighter", "usual", "heavier"];

/** What is poured in a part of the day with a mix. A cocktail is a spirit and a mixer. */
export type Pour = "fizz" | "wine" | "beer" | "spirit";
export const POURS: readonly Pour[] = ["fizz", "wine", "beer", "spirit"];

/** The parts of the day that pour a mix; the toast is fizz and the meal is wine. */
export type MixedPart = "reception" | "evening";
export const MIXED_PARTS: readonly MixedPart[] = ["reception", "evening"];

/** A share of each pour, in percent. */
export type Mix = Record<Pour, number>;

/** Every figure the sum uses that has a default. */
export type Figure =
  | "notDrinkingPct"
  | "eveningGuests"
  | "receptionHours"
  | "receptionPerHour"
  | "toastGlasses"
  | "mealGlasses"
  | "eveningHours"
  | "eveningPerHour"
  | "redPct"
  | "fizzGlassMl"
  | "wineGlassMl"
  | "spiritMl"
  | "mixerMl"
  | "softMl"
  | "iceKg";
export const FIGURES: readonly Figure[] = [
  "notDrinkingPct",
  "eveningGuests",
  "receptionHours",
  "receptionPerHour",
  "toastGlasses",
  "mealGlasses",
  "eveningHours",
  "eveningPerHour",
  "redPct",
  "fizzGlassMl",
  "wineGlassMl",
  "spiritMl",
  "mixerMl",
  "softMl",
  "iceKg",
];

/** What is bought, a line of the shopping list. */
export type BarLine = "fizz" | "white" | "red" | "beer" | "spirits" | "mixers" | "soft" | "ice";
export const BAR_LINES: readonly BarLine[] = ["fizz", "white", "red", "beer", "spirits", "mixers", "soft", "ice"];

/** Where a line is bought. */
export type Shop = "wine-merchant" | "cash-and-carry" | "supermarket";
export const SHOPS: readonly Shop[] = ["wine-merchant", "cash-and-carry", "supermarket"];

/** What the couple chose for one line; anything absent is the default. */
export interface LineChoice {
  /** Per bottle, per case of beer, per litre or per kilo. */
  price?: number;
  /** Already theirs, in the line's own units: bottles, cans, litres, kilos. */
  have?: number;
  shop?: Shop;
}

/**
 * The `bar` slice. Bar's own.
 *
 * Only what the couple chose: every figure they have not changed is its
 * default, read from `lib/bar/defaults`, so putting one back is forgetting it.
 * Nothing worked out is kept — who is coming is the guest list's, live.
 */
export interface Bar {
  kind: BarKind;
  crowd: Crowd;
  /** How many are coming, typed over the guest list's count; null reads the list. */
  people: number | null;
  figures: Partial<Record<Figure, number>>;
  /** A part's mix, where it was changed from the kind's. */
  mix: Partial<Record<MixedPart, Mix>>;
  lines: Partial<Record<BarLine, LineChoice>>;
  /** Round up to whole cases, for buying on sale or return. */
  wholeCases: boolean;
  /**
   * Which Timeline blocks the reception and the evening are, first to last.
   * The Bar keeps which blocks, never their hours, so it follows the day.
   */
  spans: Partial<Record<MixedPart, BlockSpan>>;
}

/** A run of the day's blocks, from the start of one to the end of another (the same one for a single block). */
export interface BlockSpan {
  from: string;
  to: string;
}
