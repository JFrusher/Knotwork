import { eventSchema, type Knotwork } from "@jfrusher/knotwork";
import { isDietaryKey, normaliseDietary } from "./dietary";

/**
 * A build-time check that the contract still has the `event` fields this file
 * reads and hands to Cadence.
 *
 * Typing is not enough on its own. `eventSchema` is a `looseObject`, so the
 * `Event` type it infers carries a catch-all index signature and
 * `doc.event.anything` type-checks happily as `unknown` — verified by renaming
 * `coupleNames` in the contract and watching `tsc` stay silent. `.shape` has
 * no index signature, so asserting against its keys is the check the inferred
 * type cannot give.
 *
 * Here rather than in each tool because this file is where the suite actually
 * reads them; Plaque, Brigade and Cadence never touch `event` directly.
 */
type EventKeys = keyof typeof eventSchema.shape;
type Assert<T extends true> = T;
type _EventFieldsExist = Assert<
  "date" | "coupleNames" | "venueName" | "curfewMin" | "utcOffsetMin" extends EventKeys
    ? true
    : false
>;
import { resolve } from "@/apps/cadence/core/schedule/resolve";
import { resolvedDay as resolveDaySlice } from "@/apps/cadence/core/project/day";
import { DEFAULT_LANES, DEFAULT_OUTPUTS, defaultDay, defaultStyles, emptyDoc } from "@/apps/cadence/core/model/defaults";
import { newMoment } from "@/lib/ceremony/moments";
import { BAR_KINDS, BAR_LINES, CAST_ROLES, CEREMONY_KINDS, CROWDS, FIGURES, MIXED_PARTS, MOMENT_KINDS, POURS, SHOPS, WORDS_LAYOUTS } from "./types";
import type {
  GuestCopy,
  WordsLayout,
  CeremonyKind,
  Moment,
  MomentKind,
  Song,
  Bar,
  BarKind,
  BarLine,
  Crowd,
  Figure,
  LineChoice,
  Mix,
  MixedPart,
  Shop,
  Cast,
  CastRole,
  Box,
  BoxItem,
  Boxes,
  CastSlice,
  Ceremony,
  WalkGroup,
  Constraint,
  Crew,
  CustomRole,
  CustomTablePreset,
  Designation,
  Family,
  Guest,
  NamedGroup,
  Obstacle,
  Person,
  PerSideSeats,
  RoomSpec,
  Seating,
  SeatingSettings,
  Shot,
  ShotMember,
  ShotSection,
  Shots,
  Side,
  Snapshot,
  Space,
  Table,
  Zone,
} from "./types";
import type { OutputSpec, Timeline, TimelineDoc } from "./timeline";

/**
 * Typed views onto the envelope's slices.
 *
 * A slice arrives as `unknown` — the contract package validates the envelope
 * and stops at the slice boundary on purpose. So every read coerces, and every
 * coercion is total: a missing or malformed slice becomes an empty one rather
 * than throwing, because a half-filled wedding is the normal state of a wedding
 * and not a validation failure.
 *
 * Results are cached per document object. Coercion allocates, and a selector
 * that allocates returns a new reference on every render — with zustand v5 on
 * `useSyncExternalStore` that is an infinite loop, not merely a slow render.
 */
const cache = new WeakMap<object, Map<string, unknown>>();

/**
 * Anything a store selector calls must go through this.
 *
 * A selector that allocates returns a new reference on every render, which
 * under `useSyncExternalStore` is an infinite update loop — React error #185 —
 * not merely a slow render. `lib/model/selectors.test.ts` asserts referential
 * stability for every derived view; add new ones to it.
 */

export function cached<T>(doc: Knotwork, key: string, build: () => T): T {
  let slot = cache.get(doc);
  if (!slot) {
    slot = new Map();
    cache.set(doc, slot);
  }
  if (!slot.has(key)) slot.set(key, build());
  return slot.get(key) as T;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);

const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === "boolean" ? v : fallback);

function list<T>(v: unknown, of: (item: unknown) => T | null): T[] {
  if (!Array.isArray(v)) return [];
  const out: T[] = [];
  for (const item of v) {
    const kept = of(item);
    if (kept !== null) out.push(kept);
  }
  return out;
}

// guests ---------------------------------------------------------------------

export function readGuests(doc: Knotwork): Record<string, Guest> {
  return cached(doc, "guests", () => coerceGuests(doc.guests));
}

/**
 * Guests from any raw source — the slice, or a snapshot taken months ago.
 *
 * Separate from `readGuests` because a snapshot is stored data too, and casting
 * it back to `Guest` instead of coercing it would let a half-formed record from
 * an older version through with fields the rest of the app assumes are there.
 */
export function coerceGuests(source: unknown): Record<string, Guest> {
  const out: Record<string, Guest> = {};
  for (const [id, raw] of Object.entries(isRecord(source) ? source : {})) {
    if (!isRecord(raw)) continue;
    const rsvp = raw["rsvpStatus"];
    const side = raw["side"];
    const diet = legacyDietary(raw);
    out[id] = {
      // Keep every key the suite has no opinion about. Tools own fields this
      // model has never heard of — Tableaux's `fullName`, `dietaryRaw` and
      // `assignedSeatId` among them — and `reconcileLoadedDocument` writes the
      // result of this back on load, so rebuilding a guest from the list below
      // silently destroyed them. Same rule as the envelope, one level down.
      ...raw,
      id: str(raw["id"], id),
      firstName: str(raw["firstName"]),
      lastName: str(raw["lastName"]),
      knownAs: str(raw["knownAs"]),
      email: str(raw["email"]),
      rsvpStatus: rsvp === "confirmed" || rsvp === "declined" ? rsvp : "pending",
      dietary: diet.dietary,
      dietaryRaw: diet.dietaryRaw,
      entree: str(raw["entree"]),
      notes: str(raw["notes"]),
      side: readSide(side),
      groupId: typeof raw["groupId"] === "string" ? raw["groupId"] : null,
      subgroupId: typeof raw["subgroupId"] === "string" ? raw["subgroupId"] : null,
      familyId: typeof raw["familyId"] === "string" ? raw["familyId"] : null,
      assignedTableId:
          typeof raw["assignedTableId"] === "string" ? raw["assignedTableId"] : null,
      tags: list(raw["tags"], (t) => (typeof t === "string" ? t : null)),
      plusOneOf: typeof raw["plusOneOf"] === "string" ? raw["plusOneOf"] : null,
    };
  }
  return out;
}

/**
 * A guest's dietary fields in the one shape every tool reads — see
 * `lib/model/dietary`.
 *
 * The Data panel's importer used to store what the file said in `dietary`
 * itself: "Vegetarian", "Gluten-Free", "None". A value that is not one of the
 * keys is that, and becomes the key it means, with the words kept as what the
 * guest said. `reconcileLoadedDocument` writes the result back, so a document
 * is converted once.
 */
function legacyDietary(raw: Record<string, unknown>): { dietary: string; dietaryRaw: string } {
  const dietary = str(raw["dietary"]);
  const dietaryRaw = str(raw["dietaryRaw"]);
  if (dietary === "" || isDietaryKey(dietary)) return { dietary, dietaryRaw };
  return { dietary: normaliseDietary(dietary), dietaryRaw: dietaryRaw || dietary };
}

/**
 * A guest's side. Stored as "bride" and "groom" before sides were named after
 * the partners; those are partner `a` and `b`, in the order they were listed.
 */
function readSide(side: unknown): Side {
  if (side === "a" || side === "b" || side === "both") return side;
  if (side === "bride") return "a";
  if (side === "groom") return "b";
  return "";
}

/**
 * True when any stored guest still carries something reading has to convert —
 * the old importer's dietary text, or a side called "bride" or "groom".
 */
export function hasLegacyGuests(source: unknown): boolean {
  return Object.values(isRecord(source) ? source : {}).some((raw) => {
    if (!isRecord(raw)) return false;
    const dietary = str(raw["dietary"]);
    return (dietary !== "" && !isDietaryKey(dietary)) || raw["side"] === "bride" || raw["side"] === "groom";
  });
}

/** A guest's printed name. `firstName` may hold a whole name on a one-column import. */
export function guestName(guest: Guest): string {
  return [guest.firstName, guest.lastName].filter(Boolean).join(" ").trim();
}

/**
 * A crew member's name. Somebody who is also a guest is named by the guest
 * list, so a spelling corrected there is corrected everywhere they are named;
 * linked to a guest since deleted, they keep the name they had.
 */
export function personName(person: Pick<Person, "name" | "guestId">, guests: Record<string, Guest>): string {
  const guest = person.guestId ? guests[person.guestId] : undefined;
  return guest ? guestName(guest) || person.name : person.name;
}

/**
 * Everyone on the list who has not said no: who needs a seat, a card and a
 * meal. Someone who declined stays on the list, and is none of those.
 */
export function isComing(guest: Pick<Guest, "rsvpStatus">): boolean {
  return guest.rsvpStatus !== "declined";
}

// seating --------------------------------------------------------------------

/**
 * Pixels per centimetre. Locked: changing it would rescale every stored layout,
 * so a plan authored at this scale must always be read back at it.
 */
const DEFAULT_PPU = 0.7;

/** Standard banquet chair footprint, in centimetres. */
const DEFAULT_CHAIR_CM = 45;

/** What a table can be marked as. Anything else read from a file becomes null. */
const DESIGNATIONS = new Set(["top-table", "vip", "kids", "band-bar"]);

function emptyRoom(): RoomSpec {
  return {
    widthUnits: Math.round(1200 / DEFAULT_PPU),
    heightUnits: Math.round(900 / DEFAULT_PPU),
    width: 1200,
    height: 900,
    backgroundColour: "#FAF8F5",
    spaces: [
      {
        id: "space_main",
        label: "Room",
        shape: "rect",
        x: 0,
        y: 0,
        width: 1200,
        height: 900,
        backgroundColour: "#FAF8F5",
      },
    ],
  };
}

function emptySeatingSettings(): SeatingSettings {
  return {
    defaultSeatMode: "table",
    pixelsPerUnit: DEFAULT_PPU,
    gridSnap: true,
    gridSize: 20,
    snapAlign: true,
    showChairs: true,
    chairSizeUnits: DEFAULT_CHAIR_CM,
    showDietaryBadges: true,
    showGroupColours: true,
    unitSystem: "metric",
    customTablePresets: [],
  };
}

export function emptySeating(): Seating {
  return {
    tables: {},
    groups: {},
    subgroups: {},
    families: {},
    zones: {},
    obstacles: {},
    constraints: [],
    snapshots: [],
    room: emptyRoom(),
    settings: emptySeatingSettings(),
  };
}

export function readSeating(doc: Knotwork): Seating {
  return cached(doc, "seating", () => {
    const raw: Record<string, unknown> = isRecord(doc.seating) ? doc.seating : {};
    const settings = isRecord(raw["settings"]) ? raw["settings"] : {};
    const room = isRecord(raw["room"]) ? raw["room"] : {};
    const base = emptyRoom();

    const tables: Record<string, Table> = {};
    if (isRecord(raw["tables"])) {
      for (const [id, t] of Object.entries(raw["tables"])) {
        if (!isRecord(t)) continue;
        const table: Table = {
          id: str(t["id"], id),
          label: str(t["label"], id),
          type: str(t["type"], "round"),
          capacity: num(t["capacity"], 8),
          x: num(t["x"], 0),
          y: num(t["y"], 0),
          rotation: num(t["rotation"], 0),
          seatMode: t["seatMode"] === "seat" ? "seat" : "table",
          assignedGuestIds: Array.isArray(t["assignedGuestIds"])
            ? t["assignedGuestIds"].map((g) => (typeof g === "string" ? g : null))
            : [],
          designation: DESIGNATIONS.has(t["designation"] as string)
            ? (t["designation"] as Designation)
            : null,
          colour: typeof t["colour"] === "string" ? t["colour"] : null,
        };
        if (isRecord(t["sizeUnits"])) table.sizeUnits = t["sizeUnits"] as Table["sizeUnits"];
        if (isRecord(t["perSideSeats"])) table.perSideSeats = perSide(t["perSideSeats"]);
        if (isRecord(t["seatArcRange"])) {
          table.seatArcRange = t["seatArcRange"] as Table["seatArcRange"];
        }
        tables[id] = table;
      }
    }

    const width = num(room["width"], base.width);
    const height = num(room["height"], base.height);
    const backgroundColour = str(room["backgroundColour"], base.backgroundColour);
    const spaces = list(room["spaces"], readSpace);

    return {
      tables,
      groups: namedGroups(raw["groups"]),
      subgroups: namedGroups(raw["subgroups"]),
      families: readFamilies(raw["families"]),
      zones: readZones(raw["zones"]),
      obstacles: readObstacles(raw["obstacles"]),
      constraints: readConstraints(raw["constraints"]),
      snapshots: list(raw["snapshots"], (sn) => {
        if (!isRecord(sn) || typeof sn["id"] !== "string") return null;
        return {
          id: sn["id"],
          label: str(sn["label"], "Snapshot"),
          at: str(sn["at"]),
          seating: sn["seating"] ?? {},
          guests: sn["guests"] ?? {},
        } satisfies Snapshot;
      }),
      room: {
        widthUnits: num(room["widthUnits"], base.widthUnits),
        heightUnits: num(room["heightUnits"], base.heightUnits),
        width,
        height,
        backgroundColour,
        // A plan authored before multi-room support has no spaces. Its single
        // rectangle becomes the first one, so the canvas has floor to draw.
        spaces:
          spaces.length > 0
            ? spaces
            : [
                {
                  id: "space_main",
                  label: "Room",
                  shape: "rect",
                  x: 0,
                  y: 0,
                  width,
                  height,
                  backgroundColour,
                },
              ],
      },
      settings: {
        defaultSeatMode: settings["defaultSeatMode"] === "seat" ? "seat" : "table",
        pixelsPerUnit: num(settings["pixelsPerUnit"], DEFAULT_PPU),
        gridSnap: bool(settings["gridSnap"], true),
        gridSize: num(settings["gridSize"], 20),
        snapAlign: bool(settings["snapAlign"], true),
        showChairs: bool(settings["showChairs"], true),
        chairSizeUnits: num(settings["chairSizeUnits"], DEFAULT_CHAIR_CM),
        showDietaryBadges: bool(settings["showDietaryBadges"], true),
        showGroupColours: bool(settings["showGroupColours"], true),
        unitSystem: settings["unitSystem"] === "imperial" ? "imperial" : "metric",
        customTablePresets: list(settings["customTablePresets"], (p) => {
          if (!isRecord(p) || typeof p["id"] !== "string") return null;
          return {
            id: p["id"],
            label: str(p["label"], "Custom"),
            widthUnits: num(p["widthUnits"], 180),
            heightUnits: num(p["heightUnits"], 90),
            perSideSeats: perSide(p["perSideSeats"]),
          } satisfies CustomTablePreset;
        }),
      },
    };
  });
}

function perSide(raw: unknown): PerSideSeats {
  const v = isRecord(raw) ? raw : {};
  const edge = (k: string) => Math.max(0, Math.min(40, Math.round(num(v[k], 0))));
  return { top: edge("top"), bottom: edge("bottom"), left: edge("left"), right: edge("right") };
}

function readSpace(raw: unknown): Space | null {
  if (!isRecord(raw) || typeof raw["id"] !== "string") return null;
  const common = {
    id: raw["id"],
    label: str(raw["label"], "Space"),
    x: num(raw["x"], 0),
    y: num(raw["y"], 0),
    backgroundColour: str(raw["backgroundColour"], "#FAF8F5"),
  };
  if (raw["shape"] === "polygon") {
    return {
      ...common,
      shape: "polygon",
      vertices: list(raw["vertices"], (v) =>
        isRecord(v) ? { x: num(v["x"], 0), y: num(v["y"], 0) } : null,
      ),
    };
  }
  return {
    ...common,
    shape: "rect",
    width: num(raw["width"], 400),
    height: num(raw["height"], 300),
  };
}

function readZones(raw: unknown): Record<string, Zone> {
  const out: Record<string, Zone> = {};
  if (!isRecord(raw)) return out;
  for (const [id, z] of Object.entries(raw)) {
    if (!isRecord(z)) continue;
    out[id] = {
      id: str(z["id"], id),
      label: str(z["label"], "Zone"),
      x: num(z["x"], 0),
      y: num(z["y"], 0),
      width: num(z["width"], 200),
      height: num(z["height"], 120),
      colour: str(z["colour"], "#849E86"),
    };
  }
  return out;
}

function readObstacles(raw: unknown): Record<string, Obstacle> {
  const out: Record<string, Obstacle> = {};
  if (!isRecord(raw)) return out;
  for (const [id, o] of Object.entries(raw)) {
    if (!isRecord(o)) continue;
    out[id] = {
      id: str(o["id"], id),
      kind: o["kind"] === "pillar" ? "pillar" : "wall",
      x: num(o["x"], 0),
      y: num(o["y"], 0),
      width: num(o["width"], 200),
      height: num(o["height"], 12),
      rotation: num(o["rotation"], 0),
    };
  }
  return out;
}

/** A rule naming fewer than two guests is not a rule, so it is dropped. */
function readConstraints(raw: unknown): Constraint[] {
  return list(raw, (c) => {
    if (!isRecord(c) || typeof c["id"] !== "string") return null;
    const ids = list(c["guestIds"], (g) => (typeof g === "string" ? g : null));
    if (ids.length < 2 || ids[0] === undefined || ids[1] === undefined) return null;
    return {
      id: c["id"],
      kind: c["kind"] === "together" ? "together" : "apart",
      guestIds: [ids[0], ids[1]],
      note: str(c["note"]),
    } satisfies Constraint;
  });
}

function readFamilies(raw: unknown): Record<string, Family> {
  const out: Record<string, Family> = {};
  if (!isRecord(raw)) return out;
  for (const [id, f] of Object.entries(raw)) {
    if (!isRecord(f)) continue;
    const family: Family = {
      id: str(f["id"], id),
      name: str(f["name"], id),
      memberIds: list(f["memberIds"], (m) => (typeof m === "string" ? m : null)),
    };
    if (typeof f["colour"] === "string") family.colour = f["colour"];
    out[id] = family;
  }
  return out;
}

function namedGroups(raw: unknown): Record<string, NamedGroup> {
  const out: Record<string, NamedGroup> = {};
  if (!isRecord(raw)) return out;
  for (const [id, g] of Object.entries(raw)) {
    if (!isRecord(g)) continue;
    const group: NamedGroup = { id: str(g["id"], id), name: str(g["name"], id) };
    if (typeof g["colour"] === "string") group.colour = g["colour"];
    out[id] = group;
  }
  return out;
}

// timeline -------------------------------------------------------------------

/**
 * The timeline, as Cadence's own document.
 *
 * The stored slice is coerced into a complete `TimelineDoc`, and `day` is
 * overwritten from the envelope's `event` on every read. Cadence keeps the
 * couple's details inside its own document; the envelope is where they are
 * authoritative, so this is the one place the echo is made, rather than two
 * places that can disagree about the date of the wedding.
 */
export function readTimeline(doc: Knotwork): Timeline {
  return cached(doc, "timeline", () => {
    const base = emptyDoc();
    const raw: Record<string, unknown> = isRecord((doc as Record<string, unknown>)["timeline"])
      ? ((doc as Record<string, unknown>)["timeline"] as Record<string, unknown>)
      : {};

    const lanes = list(raw["lanes"], (l) => (typeof l === "string" ? l : null));
    const laneNames = lanes.length > 0 ? lanes : [...DEFAULT_LANES];
    const firstLane = laneNames[0] ?? "Main day";
    const storedDay = isRecord(raw["day"]) ? raw["day"] : {};
    const fallbackDay = defaultDay();

    return {
      schemaVersion: base.schemaVersion,
      appVersion: base.appVersion,
      day: {
        // From the envelope, which owns these. Cadence's copy is an echo.
        date: doc.event.date || str(storedDay["date"], fallbackDay.date),
        coupleNames: doc.event.coupleNames || str(storedDay["coupleNames"]),
        venueName: doc.event.venueName || str(storedDay["venueName"]),
        curfewMin: doc.event.curfewMin ?? num(storedDay["curfewMin"], fallbackDay.curfewMin),
        // Never a likely value: unset stays unset, and the Day panel says so.
        utcOffsetMin:
          doc.event.utcOffsetMin ?? (typeof storedDay["utcOffsetMin"] === "number" ? storedDay["utcOffsetMin"] : null),
        // The venue's coordinates are Cadence's alone: nothing else needs them,
        // and they drive only the golden-hour advisory. Unset stays unset,
        // like the clocks: a guessed place gives a wrong sunset.
        latitude: typeof storedDay["latitude"] === "number" ? storedDay["latitude"] : null,
        longitude: typeof storedDay["longitude"] === "number" ? storedDay["longitude"] : null,
        logoKey: typeof storedDay["logoKey"] === "string" ? storedDay["logoKey"] : null,
      },
      lanes: laneNames,
      blocks: list(raw["blocks"], (b) => {
        if (!isRecord(b) || typeof b["id"] !== "string") return null;
        return {
          id: b["id"],
          label: str(b["label"], "Untitled"),
          durationMin: num(b["durationMin"], 0),
          anchorMin: typeof b["anchorMin"] === "number" ? b["anchorMin"] : null,
          gapMin: num(b["gapMin"], 0),
          bufferMin: num(b["bufferMin"], 0),
          squeezeToMin: typeof b["squeezeToMin"] === "number" ? b["squeezeToMin"] : null,
          lane: str(b["lane"], firstLane),
          tags: list(b["tags"], (t) => (typeof t === "string" ? t : null)),
          location: str(b["location"]),
          notes: str(b["notes"]),
          outputs: list(b["outputs"], (o) =>
            o === "run-sheet" || o === "call-sheet" || o === "order-of-day" || o === "contact-sheet"
              ? o
              : null,
          ),
        };
      }),
      tagDetails: list(raw["tagDetails"], (t) => {
        if (!isRecord(t) || typeof t["tag"] !== "string") return null;
        return {
          tag: t["tag"],
          displayName: str(t["displayName"]),
          phone: str(t["phone"]),
          arrivalMin: typeof t["arrivalMin"] === "number" ? t["arrivalMin"] : null,
          notes: str(t["notes"]),
        };
      }),
      // Two places and a time, or nothing: a journey with half of it missing
      // could only ever be guessed at.
      travel: list(raw["travel"], (j) => {
        if (!isRecord(j) || !Array.isArray(j["between"])) return null;
        const [from, to] = j["between"];
        const minutes = j["minutes"];
        if (typeof from !== "string" || typeof to !== "string" || !from.trim() || !to.trim()) return null;
        if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) return null;
        return { between: [from, to] as [string, string], minutes };
      }),
      outputs: readOutputs(raw["outputs"]),
      styles: isRecord(raw["styles"])
        ? { ...defaultStyles(), ...(raw["styles"] as ReturnType<typeof defaultStyles>) }
        : defaultStyles(),
      fonts: list(raw["fonts"], (f) => {
        if (!isRecord(f) || typeof f["family"] !== "string") return null;
        return { family: f["family"], blobKey: str(f["blobKey"]) };
      }),
    };
  });
}

/**
 * The printed pieces a document asks for.
 *
 * The set is fixed — each one has its own renderer — so an id nothing can draw
 * is dropped rather than carried, and a document naming none of them gets the
 * standard four rather than nothing to print.
 */
function readOutputs(raw: unknown): OutputSpec[] {
  const found = list(raw, (o) => {
    if (!isRecord(o)) return null;
    const known = DEFAULT_OUTPUTS.find((d) => d.id === o["id"]);
    if (!known) return null;
    return {
      id: known.id,
      label: str(o["label"], known.label),
      pageSize: o["pageSize"] === "A5" ? ("A5" as const) : ("A4" as const),
    };
  });
  return found.length > 0 ? found : DEFAULT_OUTPUTS;
}

/** The document the resolver and the clash checks read. Now the same object. */
export function timelineDoc(doc: Knotwork): TimelineDoc {
  return readTimeline(doc);
}

/** The resolved day, memoised per document, so a render never re-runs it. */
export function resolvedDay(doc: Knotwork) {
  return cached(doc, "resolved", () => resolve(readTimeline(doc)));
}

/** Where and when a block of the day is, for a tool that points at one: a box, the ceremony. */
export interface Place {
  label: string;
  location: string;
  startMin: number;
  /** When what happens in it ends, before any buffer. */
  endMin: number;
}

/** Every block of the day by id, with where it is and when it starts and ends. */
export function dayPlaces(doc: Knotwork): ReadonlyMap<string, Place> {
  return cached(doc, "dayPlaces", () => {
    const times = new Map(resolvedDay(doc).map((block) => [block.id, block]));
    return new Map(
      readTimeline(doc)
        .blocks.filter((block) => times.has(block.id))
        .map((block) => {
          const { startMin, contentEndMin } = times.get(block.id)!;
          return [block.id, { label: block.label, location: block.location.trim(), startMin, endMin: contentEndMin }];
        }),
    );
  });
}

/**
 * The `day` slice: the timeline with every clock time worked out.
 *
 * Published rather than derived on demand, because it is what leaves the
 * machine. An exported document with no `day` is one no outside reader — the
 * cross-slice validator included — can check the timeline of. Built by
 * Cadence's own publisher, so what the suite writes is byte-for-byte what
 * Cadence would have written.
 */
export function publishDay(doc: Knotwork, timeline: Timeline): Record<string, unknown> {
  return resolveDaySlice({
    ...timeline,
    day: {
      ...timeline.day,
      date: doc.event.date || timeline.day.date,
      coupleNames: doc.event.coupleNames || timeline.day.coupleNames,
      venueName: doc.event.venueName || timeline.day.venueName,
      curfewMin: doc.event.curfewMin ?? timeline.day.curfewMin,
      utcOffsetMin: doc.event.utcOffsetMin ?? timeline.day.utcOffsetMin,
    },
  }) as unknown as Record<string, unknown>;
}

// crew -----------------------------------------------------------------------

export function readCrew(doc: Knotwork): Crew {
  return cached(doc, "crew", () => {
    const raw: Record<string, unknown> = isRecord(doc.crew) ? doc.crew : {};
    return {
      teams: list(raw["teams"], (t) => {
        if (!isRecord(t) || typeof t["id"] !== "string") return null;
        return {
          // Keep what this model has no opinion about, for the same reason
          // coerceGuests does: rebuilding from the list below is how a field
          // owned by a tool gets silently destroyed on the next read.
          ...t,
          id: t["id"],
          tag: typeof t["tag"] === "string" ? t["tag"] : null,
          name: str(t["name"], "Team"),
          phone: str(t["phone"]),
          notes: str(t["notes"]),
          email: str(t["email"]),
          cost: typeof t["cost"] === "number" ? t["cost"] : null,
          deposit: typeof t["deposit"] === "number" ? t["deposit"] : null,
          depositPaidOn: str(t["depositPaidOn"]),
          balanceDueOn: str(t["balanceDueOn"]),
          balancePaidOn: str(t["balancePaidOn"]),
          confirmedOn: str(t["confirmedOn"]),
        };
      }),
      people: list(raw["people"], (p) => {
        if (!isRecord(p) || typeof p["id"] !== "string") return null;
        return {
          ...p,
          id: p["id"],
          name: str(p["name"], "Someone"),
          teamId: typeof p["teamId"] === "string" ? p["teamId"] : null,
          phone: str(p["phone"]),
          notes: str(p["notes"]),
          // Which guest this person is, when they are one. Narrowing this away
          // would quietly unlink every crew member on the next read.
          guestId: typeof p["guestId"] === "string" ? p["guestId"] : null,
        };
      }),
      jobs: list(raw["jobs"], (j) => {
        if (!isRecord(j) || typeof j["id"] !== "string") return null;
        const status = j["status"];
        return {
          ...j,
          id: j["id"],
          // Null and absent both mean "not tied to the day". An empty string
          // would be a third spelling of the same thing.
          blockId: typeof j["blockId"] === "string" && j["blockId"] !== "" ? j["blockId"] : null,
          label: str(j["label"], "Job"),
          notes: str(j["notes"]),
          teamId: typeof j["teamId"] === "string" ? j["teamId"] : null,
          personIds: list(j["personIds"], (p) => (typeof p === "string" ? p : null)),
          status: status === "doing" || status === "done" ? status : "todo",
          dueOn: str(j["dueOn"]),
        };
      }),
      budget: typeof raw["budget"] === "number" ? raw["budget"] : null,
    };
  });
}

// shots -----------------------------------------------------------------------

const CAST_ROLE_SET = new Set<CastRole>(CAST_ROLES);

/**
 * The roles as they were stored before they were named after the partners.
 * Partner `a` was "bride" and `b` "groom" — the order they were listed in, not
 * a claim about either of them. Read as their new names; `reconcileLoadedDocument`
 * writes the result back.
 */
const LEGACY_ROLES: Record<string, CastRole> = {
  bride: "a",
  groom: "b",
  "brides-mother": "a-mother",
  "brides-father": "a-father",
  "grooms-mother": "b-mother",
  "grooms-father": "b-father",
  "bridal-party": "a-party",
  groomsmen: "b-party",
};
const LEGACY_KEY_FOR = Object.fromEntries(
  Object.entries(LEGACY_ROLES).map(([legacy, role]) => [role, legacy]),
) as Record<CastRole, string>;

/** True when the stored shots still use the roles' old names. */
export function hasLegacyShots(source: unknown): boolean {
  if (!isRecord(source)) return false;
  const cast = source["cast"];
  if (isRecord(cast) && Object.keys(cast).some((key) => key in LEGACY_ROLES)) return true;
  const sections = Array.isArray(source["sections"]) ? source["sections"] : [];
  return sections.some(
    (section) =>
      isRecord(section) &&
      Array.isArray(section["shots"]) &&
      section["shots"].some(
        (shot) =>
          isRecord(shot) &&
          Array.isArray(shot["members"]) &&
          shot["members"].some(
            (member) => isRecord(member) && member["kind"] === "role" && typeof member["ref"] === "string" && member["ref"] in LEGACY_ROLES,
          ),
      ),
  );
}

export function emptyCast(): Cast {
  const cast = {} as Cast;
  for (const role of CAST_ROLES) cast[role] = [];
  return cast;
}

function readRoles(raw: unknown): Cast {
  const cast = emptyCast();
  if (!isRecord(raw)) return cast;
  for (const role of CAST_ROLES) {
    cast[role] = list(raw[role] ?? raw[LEGACY_KEY_FOR[role]], (id) => (typeof id === "string" ? id : null));
  }
  return cast;
}

function readMember(raw: unknown): ShotMember | null {
  if (!isRecord(raw)) return null;
  const kind = raw["kind"];
  const ref = raw["ref"];
  switch (kind) {
    case "guest":
    case "family":
    case "group":
    case "customRole":
    case "text":
      return typeof ref === "string" ? { kind, ref } : null;
    case "role": {
      const role = typeof ref === "string" ? (LEGACY_ROLES[ref] ?? ref) : null;
      return role !== null && CAST_ROLE_SET.has(role as CastRole) ? { kind: "role", ref: role as CastRole } : null;
    }
    default:
      return null;
  }
}

function readCustomRole(raw: unknown): CustomRole | null {
  if (!isRecord(raw) || typeof raw["id"] !== "string") return null;
  return {
    id: raw["id"],
    name: str(raw["name"], "New role"),
    guestIds: list(raw["guestIds"], (id) => (typeof id === "string" ? id : null)),
  };
}

function readShot(raw: unknown): Shot | null {
  if (!isRecord(raw) || typeof raw["id"] !== "string") return null;
  return {
    id: raw["id"],
    label: str(raw["label"]),
    members: list(raw["members"], readMember),
    notes: str(raw["notes"]),
  };
}

function readSection(raw: unknown): ShotSection | null {
  if (!isRecord(raw) || typeof raw["id"] !== "string") return null;
  return {
    id: raw["id"],
    name: str(raw["name"], "Section"),
    shots: list(raw["shots"], readShot),
  };
}

export function readShots(doc: Knotwork): Shots {
  return cached(doc, "shots", () => {
    const raw: Record<string, unknown> = isRecord((doc as Record<string, unknown>)["shots"])
      ? ((doc as Record<string, unknown>)["shots"] as Record<string, unknown>)
      : {};
    return { sections: list(raw["sections"], readSection) };
  });
}

// cast ------------------------------------------------------------------------

const holdsOwnCast = (own: unknown): own is Record<string, unknown> =>
  isRecord(own) && ("roles" in own || "customRoles" in own);
const holdsOldCast = (shots: unknown): shots is Record<string, unknown> =>
  isRecord(shots) && ("cast" in shots || "customRoles" in shots);

/**
 * True when the cast is still inside `shots`, where it lived before two tools
 * shared it. `reconcileLoadedDocument` moves it to its own slice.
 */
export function hasLegacyCast(raw: unknown): boolean {
  return isRecord(raw) && !holdsOwnCast(raw["cast"]) && holdsOldCast(raw["shots"]);
}

export function emptyCastSlice(): CastSlice {
  return { roles: emptyCast(), customRoles: [] };
}

/**
 * Who is who: the `cast` slice, or — in a document written before it had a
 * slice of its own — the cast still inside `shots`, old role names and all.
 *
 * Read from either, rather than only after the load-time pass has moved it,
 * because the planner's Weddings page runs What is left over stored documents
 * on the server, and a wedding nobody has opened since must not read as having
 * no cast.
 */
export function readCast(doc: Knotwork): CastSlice {
  return cached(doc, "cast", () => {
    const record = doc as Record<string, unknown>;
    const own = record["cast"];
    const shots = record["shots"];
    const source = holdsOwnCast(own)
      ? { roles: own["roles"], customRoles: own["customRoles"] }
      : holdsOldCast(shots)
        ? { roles: shots["cast"], customRoles: shots["customRoles"] }
        : {};
    return { roles: readRoles(source.roles), customRoles: list(source.customRoles, readCustomRole) };
  });
}

// ceremony --------------------------------------------------------------------

const seconds = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);

function readSong(raw: unknown): Song | null {
  if (!isRecord(raw)) return null;
  return {
    title: str(raw["title"]),
    artist: str(raw["artist"]),
    playedBy: str(raw["playedBy"]),
    startSec: seconds(raw["startSec"]),
    endSec: seconds(raw["endSec"]),
    arrangement: str(raw["arrangement"]),
    lyrics: str(raw["lyrics"]),
  };
}

/** A song of that title alone: what a group's music was before it was a song. */
const songTitled = (title: string): Song => ({ title, artist: "", playedBy: "", startSec: null, endSec: null, arrangement: "", lyrics: "" });

function readWalkGroup(raw: unknown): WalkGroup | null {
  if (!isRecord(raw) || typeof raw["id"] !== "string") return null;
  const formation = raw["formation"];
  const side = raw["side"];
  // Older ceremonies kept a group's music as words; it is the title of its song now.
  const music = str(raw["music"]).trim();
  return {
    id: raw["id"],
    label: str(raw["label"]),
    members: list(raw["members"], readMember),
    formation: formation === "pairs" || formation === "threes" ? formation : "single",
    side: side === "a" || side === "b" || side === "both" ? side : "",
    song: "song" in raw ? readSong(raw["song"]) : music ? songTitled(music) : null,
    cue: str(raw["cue"]),
  };
}

function readMoment(raw: unknown): Moment | null {
  if (!isRecord(raw) || typeof raw["id"] !== "string") return null;
  const minutes = raw["minutes"];
  return {
    id: raw["id"],
    kind: MOMENT_KINDS.includes(raw["kind"] as MomentKind) ? (raw["kind"] as MomentKind) : "other",
    title: str(raw["title"]),
    members: list(raw["members"], readMember),
    minutes: typeof minutes === "number" && Number.isFinite(minutes) && minutes >= 0 ? minutes : null,
    cue: str(raw["cue"]),
    song: readSong(raw["song"]),
    author: str(raw["author"]),
    words: str(raw["words"]),
    layout: WORDS_LAYOUTS.includes(raw["layout"] as WordsLayout) ? (raw["layout"] as WordsLayout) : "poem",
    guestNote: str(raw["guestNote"]),
    // One `print` once said both; it still means both until either is changed.
    printWords: bool(raw["printWords"], bool(raw["print"], false)),
    printLyrics: bool(raw["printLyrics"], bool(raw["print"], false)),
    approved: bool(raw["approved"], false),
    notes: str(raw["notes"]),
  };
}

/** The id of the moment an older ceremony's processional is read into: fixed, so every read agrees. */
export const PROCESSIONAL_MOMENT_ID = "moment-processional";

export function emptyCeremony(): Ceremony {
  return { kind: "civil", blockId: null, officiant: "", witnesses: [], notes: "", order: [], processional: [], guestCopy: readGuestCopy(undefined) };
}

function readGuestCopy(raw: unknown): GuestCopy {
  const copy = isRecord(raw) ? raw : {};
  return {
    processionalMusic: bool(copy["processionalMusic"], true),
    welcome: str(copy["welcome"]),
    weddingParty: bool(copy["weddingParty"], false),
    dayBlockIds: Array.isArray(copy["dayBlockIds"]) ? copy["dayBlockIds"].filter((id): id is string => typeof id === "string") : [],
    thanks: str(copy["thanks"]),
    onGuestLink: bool(copy["onGuestLink"], false),
  };
}

/**
 * The ceremony as planned. A ceremony stored before it had an order of service
 * is read with one holding its processional, so nothing already planned
 * disappears from the order or the prints; the first change stores it so.
 */
export function readCeremony(doc: Knotwork): Ceremony {
  return cached(doc, "ceremony", () => {
    const raw = (doc as Record<string, unknown>)["ceremony"];
    if (!isRecord(raw)) return emptyCeremony();
    const processional = list(raw["processional"], readWalkGroup);
    const order =
      "order" in raw
        ? list(raw["order"], readMoment)
        : processional.length > 0
          ? [{ ...newMoment("processional"), id: PROCESSIONAL_MOMENT_ID }]
          : [];
    return {
      kind: CEREMONY_KINDS.includes(raw["kind"] as CeremonyKind) ? (raw["kind"] as CeremonyKind) : "civil",
      blockId: typeof raw["blockId"] === "string" ? raw["blockId"] : null,
      officiant: str(raw["officiant"]),
      witnesses: list(raw["witnesses"], readMember),
      notes: str(raw["notes"]),
      order,
      processional,
      guestCopy: readGuestCopy(raw["guestCopy"]),
    };
  });
}

// boxes -----------------------------------------------------------------------

function readBoxItem(raw: unknown): BoxItem | null {
  if (!isRecord(raw) || typeof raw["id"] !== "string") return null;
  return {
    id: raw["id"],
    label: str(raw["label"]),
    quantity: Math.max(1, Math.round(num(raw["quantity"], 1))),
    packed: bool(raw["packed"], false),
  };
}

function readBox(raw: unknown, index: number): Box | null {
  if (!isRecord(raw) || typeof raw["id"] !== "string") return null;
  return {
    id: raw["id"],
    number: num(raw["number"], index + 1),
    name: str(raw["name"]),
    items: list(raw["items"], readBoxItem),
    blockId: typeof raw["blockId"] === "string" ? raw["blockId"] : null,
    personIds: list(raw["personIds"], (id) => (typeof id === "string" ? id : null)),
    notes: str(raw["notes"]),
  };
}

export function emptyBoxes(): Boxes {
  return { boxes: [] };
}

export function readBoxes(doc: Knotwork): Boxes {
  return cached(doc, "boxes", () => {
    const raw = (doc as Record<string, unknown>)["boxes"];
    const stored = isRecord(raw) && Array.isArray(raw["boxes"]) ? raw["boxes"] : [];
    return { boxes: stored.map(readBox).filter((box): box is Box => box !== null) };
  });
}

// bar -------------------------------------------------------------------------

const amount = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);

function readMix(raw: unknown): Mix | null {
  if (!isRecord(raw)) return null;
  const mix = {} as Mix;
  for (const pour of POURS) mix[pour] = amount(raw[pour]) ?? 0;
  return mix;
}

function readLineChoice(raw: unknown): LineChoice | null {
  if (!isRecord(raw)) return null;
  const choice: LineChoice = {};
  const price = amount(raw["price"]);
  const have = amount(raw["have"]);
  if (price !== null) choice.price = price;
  if (have !== null && have > 0) choice.have = have;
  if (SHOPS.includes(raw["shop"] as Shop)) choice.shop = raw["shop"] as Shop;
  return Object.keys(choice).length > 0 ? choice : null;
}

export function emptyBar(): Bar {
  return { kind: "full", crowd: "usual", people: null, figures: {}, mix: {}, lines: {}, wholeCases: true };
}

/** The bar as the couple left it: only their choices, each checked; the rest is the defaults'. */
export function readBar(doc: Knotwork): Bar {
  return cached(doc, "bar", () => {
    const raw = (doc as Record<string, unknown>)["bar"];
    if (!isRecord(raw)) return emptyBar();
    const figures: Partial<Record<Figure, number>> = {};
    const storedFigures = isRecord(raw["figures"]) ? raw["figures"] : {};
    for (const figure of FIGURES) {
      const value = amount(storedFigures[figure]);
      if (value !== null) figures[figure] = value;
    }
    const mix: Partial<Record<MixedPart, Mix>> = {};
    const storedMix = isRecord(raw["mix"]) ? raw["mix"] : {};
    for (const part of MIXED_PARTS) {
      const read = readMix(storedMix[part]);
      if (read) mix[part] = read;
    }
    const lines: Partial<Record<BarLine, LineChoice>> = {};
    const storedLines = isRecord(raw["lines"]) ? raw["lines"] : {};
    for (const line of BAR_LINES) {
      const read = readLineChoice(storedLines[line]);
      if (read) lines[line] = read;
    }
    const people = amount(raw["people"]);
    return {
      kind: BAR_KINDS.includes(raw["kind"] as BarKind) ? (raw["kind"] as BarKind) : "full",
      crowd: CROWDS.includes(raw["crowd"] as Crowd) ? (raw["crowd"] as Crowd) : "usual",
      people: people === null ? null : Math.round(people),
      figures,
      mix,
      lines,
      wholeCases: bool(raw["wholeCases"], true),
    };
  });
}
