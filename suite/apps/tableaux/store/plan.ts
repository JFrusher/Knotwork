import { eventSchema, type Event as WeddingEvent } from '@jfrusher/knotwork'
import { coerceGuests } from '@/lib/model/slices'
import { DEFAULT_CHAIR_CM, DEFAULT_PPU, deriveSizeUnits } from '../utils/seatPositions'
import { localeDefaultUnitSystem } from '../utils/units'
import type { Family, Guest, Plan, Room, Settings, Space, Subgroup, Table } from './types'

/**
 * Seating's plan, read from the wedding and written back to it.
 *
 * The wedding keeps a plan in two slices rather than one, because the guest
 * list is not Seating's alone. Place cards print from it, Delegation counts
 * heads with it, the Guests page edits it. Keeping it in the shared `guests`
 * slice means all of that reads and writes one list. Everything else —
 * tables, zones, room, groups, settings, snapshots — is `seating`, and
 * nothing outside Seating edits it except through Seating's own commands.
 *
 * The one way a plan is read, whoever reads it: Seating's store, the Guests
 * page and setup all see the same normalised plan, and hand back the same
 * two slices.
 */

/**
 * A build-time check that the four `event` fields read below still exist in
 * the contract package.
 *
 * Typing the file is not enough on its own, which is worth writing down because
 * it is genuinely counter-intuitive. `eventSchema` is a `looseObject`, so the
 * `Event` type it infers carries a catch-all index signature — which means
 * `event.anythingAtAll` type-checks happily as `unknown`, and renaming a field
 * in the contract produces no error anywhere. `eventSchema.shape` has no index
 * signature, so asserting against its keys is the check the inferred type
 * cannot give.
 */
type EventKeys = keyof typeof eventSchema.shape
type Assert<T extends true> = T
type _CoupleNamesExists = Assert<'coupleNames' extends EventKeys ? true : false>
type _VenueNameExists = Assert<'venueName' extends EventKeys ? true : false>
type _DateExists = Assert<'date' extends EventKeys ? true : false>
type _PartnersExist = Assert<'partners' extends EventKeys ? true : false>

/**
 * What of the plan lives in the `seating` slice: all of it but the guests.
 *
 * Not the pan and zoom: where a window is looking is its own, as every tool's
 * zoom is, and a partner panning their room must not move yours.
 */
export const SEATING_KEYS = [
  'meta',
  'groups',
  'subgroups',
  'families',
  'tables',
  'zones',
  'room',
  'wallElements',
  'pillars',
  'snapshots',
  'constraints',
  'settings',
] as const satisfies ReadonlyArray<keyof Plan>

/** Everything in a plan: the seating, and the guests. */
export const PLAN_KEYS = [...SEATING_KEYS, 'guests'] as const

/**
 * Tableaux's factory name for a plan nobody has named yet.
 *
 * Treated as absence rather than as an answer: propagating it would put "Our
 * Wedding" in the couple's name on the run sheet and the place cards, which is
 * worse than leaving the field empty for them to fill in.
 */
const UNNAMED = 'Our Wedding'

type Raw = Record<string, unknown>

const isRecord = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v)

const round2 = (n: number) => Math.round(n * 100) / 100

export function emptyPlan(): Plan {
  return {
    meta: { weddingName: UNNAMED, venue: '', date: '', partners: ['', ''] },
    guests: {},
    groups: {},
    subgroups: {},
    families: {},
    tables: {},
    zones: {},
    wallElements: {},
    pillars: {},
    room: {
      widthUnits: Math.round(1200 / DEFAULT_PPU),
      heightUnits: Math.round(900 / DEFAULT_PPU),
      width: 1200,
      height: 900,
      backgroundColour: '#FAF8F5',
      spaces: [],
      joins: [],
    },
    snapshots: [],
    constraints: [],
    settings: {
      defaultSeatMode: 'table',
      showDietaryBadges: true,
      showGroupColours: true,
      gridSnap: true,
      gridSize: 20,
      gridStyle: 'dots',
      snapAlign: true,
      unitSystem: localeDefaultUnitSystem(),
      pixelsPerUnit: DEFAULT_PPU,
      showChairs: true,
      chairSizeUnits: DEFAULT_CHAIR_CM,
      customTablePresets: [],
    },
  }
}

// ── normalisation (on every read of the wedding) ──────────────────────────────
// Older saved plans predate real-world units / per-side seats. We upgrade them
// on read so the rest of the app can assume the richer shape; the next edit
// writes it. Migration is non-destructive and pixel-identical: `sizeUnits` is
// reverse-derived from the legacy px geometry ÷ the locked ppu.
//
// Deterministic, because the plan is read again whenever the wedding changes:
// a space given a fresh random id on every read could never stay selected.

const ensureSettingsShape = (s: Partial<Settings> = {}): Settings => ({
  ...s,
  defaultSeatMode: s.defaultSeatMode || 'table',
  showDietaryBadges: s.showDietaryBadges ?? true,
  showGroupColours: s.showGroupColours ?? true,
  gridSnap: s.gridSnap ?? true,
  gridSize: s.gridSize || 20,
  gridStyle: s.gridStyle || 'dots',
  snapAlign: s.snapAlign ?? true,
  unitSystem: s.unitSystem || localeDefaultUnitSystem(),
  pixelsPerUnit: s.pixelsPerUnit || DEFAULT_PPU,
  showChairs: s.showChairs ?? true,
  chairSizeUnits: s.chairSizeUnits || DEFAULT_CHAIR_CM,
  customTablePresets: Array.isArray(s.customTablePresets) ? s.customTablePresets : [],
})

// A single floor space: a rectangle (x/y/width/height) or a polygon (vertices
// relative to x/y). Coordinates are canvas px, matching tables and zones.
const ensureSpaceShape = (sp: Partial<Space> & Raw = {}, index = 0): Space => {
  const base = {
    id: sp.id || `space_${index}`,
    label: sp.label || 'Space',
    x: sp.x || 0,
    y: sp.y || 0,
    backgroundColour: sp.backgroundColour || '#FAF8F5',
  }
  if (sp.shape === 'polygon') {
    const vertices = Array.isArray(sp.vertices) ? sp.vertices : []
    return { ...base, shape: 'polygon', vertices: vertices.map((v) => ({ x: Math.round(v.x), y: Math.round(v.y) })) }
  }
  const box = sp as { width?: number; height?: number }
  return { ...base, shape: 'rect', width: box.width || 400, height: box.height || 300 }
}

const ensureRoomShape = (r: Partial<Room> = {}, ppu: number): Room => {
  const widthUnits = r.widthUnits ?? (r.width != null ? r.width / ppu : 1200 / ppu)
  const heightUnits = r.heightUnits ?? (r.height != null ? r.height / ppu : 900 / ppu)
  const width = round2(widthUnits * ppu)
  const height = round2(heightUnits * ppu)
  const backgroundColour = r.backgroundColour || '#FAF8F5'
  // Multi-room: migrate a legacy single-rect room into a `spaces` array. The
  // legacy width/height fields stay in sync with the primary space so older read
  // paths (and old saved plans) keep working.
  const spaces: Space[] =
    Array.isArray(r.spaces) && r.spaces.length
      ? r.spaces.map((sp, i) => ensureSpaceShape(sp, i))
      : [{ id: 'space_room', label: 'Room', shape: 'rect', x: 0, y: 0, width, height, backgroundColour }]
  return {
    ...r,
    widthUnits: round2(widthUnits),
    heightUnits: round2(heightUnits),
    width,
    height,
    backgroundColour,
    spaces,
    joins: Array.isArray(r.joins) ? r.joins.filter((j) => j && j.a && j.b) : [],
  }
}

/** A table as stored: its identity and place, and whatever else it was saved with. */
type StoredTable = Partial<Table> & Pick<Table, 'id' | 'label' | 'type' | 'capacity' | 'x' | 'y'>

const ensureTableShape = (t: StoredTable, ppu: number): Table => {
  const table: Table = {
    rotation: 0,
    seatMode: 'table',
    colour: null,
    designation: null,
    perSideSeats: null,
    seatArcRange: null,
    ...t,
    assignedGuestIds: t.assignedGuestIds || [],
  }
  if (!table.sizeUnits) table.sizeUnits = deriveSizeUnits(table, ppu)
  if (table.perSideSeats === undefined) table.perSideSeats = null
  return table
}

const ensureSubgroupShape = (sg: Partial<Subgroup>, id: string): Subgroup => ({
  id,
  name: sg.name || 'Subgroup',
  colour: sg.colour || '#A2B8A2',
  parentGroupId: sg.parentGroupId || null,
  memberIds: Array.isArray(sg.memberIds) ? sg.memberIds : [],
})

const ensureFamilyShape = (f: Partial<Family>, id: string): Family => ({
  id,
  name: f.name || 'Family',
  colour: f.colour || '#A2B8A2',
  parentGroupId: f.parentGroupId || null,
  parentSubgroupId: f.parentSubgroupId || null,
  memberIds: Array.isArray(f.memberIds) ? f.memberIds : [],
})

/** A plan with every field it should have, from whatever of one there is. */
export function normalizePlan(clean: Partial<Plan>): Plan {
  const settings = ensureSettingsShape(clean.settings)
  const ppu = settings.pixelsPerUnit
  const room = ensureRoomShape(clean.room, ppu)
  const tables: Record<string, Table> = {}
  Object.entries(clean.tables || {}).forEach(([id, t]) => {
    tables[id] = ensureTableShape({ ...t, id }, ppu)
  })
  const subgroups: Record<string, Subgroup> = {}
  Object.entries(clean.subgroups || {}).forEach(([id, sg]) => {
    subgroups[id] = ensureSubgroupShape(sg, id)
  })
  const families: Record<string, Family> = {}
  Object.entries(clean.families || {}).forEach(([id, f]) => {
    families[id] = ensureFamilyShape(f, id)
  })
  return { ...emptyPlan(), ...clean, settings, room, tables, subgroups, families }
}

/**
 * Give every guest a `fullName`, because Seating is the one place that
 * displays them by it.
 *
 * Seating derives `fullName` in its own `addGuest` and `updateGuest`, so a
 * guest created here has always had one. A guest arriving any other way — the
 * suite's CSV import, a restored backup, the example wedding — did not, and
 * the guest panel showed a hundred blank rows above a count of a hundred
 * guests, with nobody seatable.
 *
 * A name the guest already carries is never overwritten: Seating allows one
 * that is not simply first plus last, and deriving over the top would quietly
 * rewrite it.
 */
function named(guests: Record<string, Omit<Guest, 'fullName' | 'assignedSeatId'> & Raw>): Record<string, Guest> {
  const out: Record<string, Guest> = {}
  for (const [id, guest] of Object.entries(guests)) {
    const fullName =
      typeof guest.fullName === 'string' && guest.fullName.trim() !== ''
        ? guest.fullName
        : `${guest.firstName} ${guest.lastName}`.trim() || 'New guest'
    const assignedSeatId = typeof guest.assignedSeatId === 'string' ? guest.assignedSeatId : null
    out[id] = { ...guest, fullName, assignedSeatId }
  }
  return out
}

/**
 * The plan in the wedding: its guests and seating slices, read the way
 * Seating reads them, with the wedding's own facts in `meta`.
 */
export function planFrom(
  slices: { guests?: unknown; seating?: unknown },
  event: Pick<WeddingEvent, 'coupleNames' | 'venueName' | 'date' | 'partners'>
): Plan {
  const seating = isRecord(slices.seating) ? slices.seating : {}
  const clean: Raw = {}
  for (const key of SEATING_KEYS) {
    if (seating[key] !== undefined) clean[key] = seating[key]
  }
  const meta = isRecord(seating.meta) ? seating.meta : {}
  return normalizePlan({
    ...(clean as Partial<Plan>),
    // Through the suite's one definition of a guest, which keeps every field it
    // has no opinion about and puts the dietary fields in the shape the filters
    // and badges here expect.
    guests: named(coerceGuests(slices.guests) as Record<string, Omit<Guest, 'fullName' | 'assignedSeatId'> & Raw>),
    meta: {
      ...meta,
      // The wedding's facts, from the wedding: Seating shows them and never
      // edits them, so an older copy kept in `meta` is never preferred.
      weddingName: event.coupleNames || UNNAMED,
      venue: event.venueName,
      date: event.date,
      // Whose sides the guests are on — see `lib/model/partners`.
      partners: event.partners,
    },
  })
}

/**
 * The two slices a plan is kept in.
 *
 * Not `event`: the names, venue and date are edited in the Data panel only.
 * Seating used to write its copy of them back, over whatever the panel had
 * just set; its `meta` is an echo and stays in its own slice.
 */
export function slicesOf(plan: Pick<Plan, (typeof PLAN_KEYS)[number]>): { guests: Record<string, Guest>; seating: Raw } {
  const seating: Raw = {}
  for (const key of SEATING_KEYS) seating[key] = plan[key]
  return { guests: plan.guests, seating }
}
