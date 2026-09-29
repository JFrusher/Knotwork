import type {
  Constraint,
  Designation,
  Guest as SuiteGuest,
  PerSideSeats,
  SeatMode,
  SizeUnits,
  Space,
  Table as SuiteTable,
  UnitSystem,
} from '@/lib/model/types'

/**
 * Seating's plan, as its store holds it: the wedding's guests and seating,
 * read by `sliceBridge` and normalised by `useStore`.
 *
 * Built on the suite's own shapes where they are the same thing — a guest, a
 * table, a floor space, a seating rule — and Seating's own where the suite's
 * reader is a narrowing of what Seating actually keeps (its groups carry
 * their members; its presets and snapshots are its own).
 */

export type { Constraint, Designation, PerSideSeats, SeatMode, SizeUnits, Space }

export interface Guest extends SuiteGuest {
  /** What Seating shows and sorts by. Derived from the names unless set. */
  fullName: string
  /** `seat_<table>_<index>` on a seat-level table, else null. */
  assignedSeatId: string | null
}

export interface Table extends SuiteTable {
  /** Built with per-edge seat counts, rather than from a type's preset. */
  custom?: boolean
}

export interface Group {
  id: string
  name: string
  colour: string
  memberIds: string[]
}

export interface Subgroup {
  id: string
  name: string
  colour: string
  parentGroupId: string | null
  memberIds: string[]
}

/** The deepest container: under a group, under a subgroup, or on its own. */
export interface Family {
  id: string
  name: string
  colour: string
  parentGroupId: string | null
  parentSubgroupId: string | null
  memberIds: string[]
}

export interface Zone {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
  shape: 'rect' | 'circle'
  colour: string
}

/** Two spaces whose shared boundary is open, so they read as one floor. */
export interface Join {
  a: string
  b: string
}

export interface Room {
  widthUnits: number
  heightUnits: number
  width: number
  height: number
  backgroundColour: string
  spaces: Space[]
  joins: Join[]
}

/** A door or an opening, on one wall of one space. */
export interface WallElement {
  id: string
  spaceId: string
  /** Which wall of the space, counting from its first edge. */
  wallIndex: number
  /** How far along that wall, 0 to 1. */
  position: number
  type: 'door' | 'opening'
  widthUnits: number
  swingInward: boolean
  swingSide: 'left' | 'right'
}

export interface Pillar {
  id: string
  x: number
  y: number
  radiusUnits: number
}

/** A table's footprint and seating, kept to drop from the palette again. */
export interface TablePreset {
  id: string
  name: string
  type: string
  sizeUnits: SizeUnits | null
  capacity: number
  perSideSeats: PerSideSeats | null
  seatMode: SeatMode
}

export interface Settings {
  defaultSeatMode: SeatMode
  showDietaryBadges: boolean
  showGroupColours: boolean
  gridSnap: boolean
  gridSize: number
  gridStyle: 'dots' | 'lines' | 'off'
  snapAlign: boolean
  unitSystem: UnitSystem
  /** Canvas pixels per centimetre. Locked per plan — see `DEFAULT_PPU`. */
  pixelsPerUnit: number
  showChairs: boolean
  chairSizeUnits: number
  customTablePresets: TablePreset[]
}

/** The wedding's own facts, shown here and edited in the Data panel only. */
export interface Meta {
  weddingName: string
  venue: string
  date: string
  partners: [string, string]
}

/** A whole plan, kept so a rearrangement can be abandoned. */
export interface PlanSnapshot {
  id: string
  name: string
  savedAt: string
  state: Partial<Omit<Plan, 'snapshots'>>
}

export interface Plan {
  meta: Meta
  guests: Record<string, Guest>
  groups: Record<string, Group>
  subgroups: Record<string, Subgroup>
  families: Record<string, Family>
  tables: Record<string, Table>
  zones: Record<string, Zone>
  room: Room
  wallElements: Record<string, WallElement>
  pillars: Record<string, Pillar>
  snapshots: PlanSnapshot[]
  constraints: Constraint[]
  settings: Settings
}

/** The collections a patch sets entities in, or removes them from with `null`. */
export type Collection =
  | 'guests'
  | 'groups'
  | 'subgroups'
  | 'families'
  | 'tables'
  | 'zones'
  | 'wallElements'
  | 'pillars'

/**
 * A change to the plan: entities to set (or `null` to remove) by collection,
 * fields to merge into the room, settings or meta, and whole-list
 * replacements for the rules and snapshots. See `applyPatch`.
 */
export type Patch = { [C in Collection]?: Record<string, Plan[C][string] | null> } & {
  meta?: Partial<Meta>
  room?: Partial<Room>
  settings?: Partial<Settings>
  constraints?: Constraint[]
  snapshots?: PlanSnapshot[]
}

/**
 * One edit. `label` is what the header's undo names; `meta` hands a new
 * entity's id back to whoever dispatched it.
 */
export interface Command {
  type: string
  label: string
  payload: Patch
  meta?: Record<string, string>
}

/** Every edit is one of these: the plan as it is, to the command that changes it, or null for no change. */
export type Action = (plan: Plan) => Command | null
