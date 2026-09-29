/**
 * Every edit to a plan. Each creator returns an *action* `(plan) => command`,
 * where a command is `{ type, label, payload }`: the patch that makes the
 * change (see `applyPatch`) and the words the header's undo names it by.
 * Returning `null` is a no-op (e.g. assigning a guest that doesn't exist).
 *
 * Components dispatch via the bound helpers on the store (e.g. `moveTable(id,
 * x, y)`), which call `dispatch(creator(...args))`; the Guests page and setup
 * run the same actions over the plan read from the wedding. Undo is the
 * wedding's own history, which keeps each whole state, so a command says only
 * how to go forward.
 */
import type { SeatMode } from '@/lib/model/types'
import { makeId, seatId } from '../utils/ids'
import { getTableType, clampCapacity, clampPerSide, seatCountFromPerSide } from '../utils/tableTypes'
import { deriveSizeUnits, DEFAULT_PPU, sidesFromLayout, remapSeatsForSides } from '../utils/seatPositions'
import type {
  Action,
  Constraint,
  Designation,
  Family,
  Group,
  Guest,
  PerSideSeats,
  Plan,
  Settings,
  SizeUnits,
  Space,
  Subgroup,
  Table,
  TablePreset,
  WallElement,
  Zone,
} from './types'

type Seats = Array<string | null>

// ── array helpers ───────────────────────────────────────────────────────────

const withoutGuest = (arr: Seats = [], guestId: string, seatMode: SeatMode): Seats =>
  seatMode === 'seat'
    ? arr.map((id) => (id === guestId ? null : id))
    : arr.filter((id) => id && id !== guestId)

const withoutMembers = (arr: Seats = [], memberSet: ReadonlySet<string>, seatMode: SeatMode): Seats =>
  seatMode === 'seat'
    ? arr.map((id) => (id && memberSet.has(id) ? null : id))
    : arr.filter((id) => id && !memberSet.has(id))

const normaliseSeats = (arr: Seats = [], capacity: number): Seats => {
  const out: Seats = new Array(capacity).fill(null)
  const overflow: string[] = []
  arr.forEach((id, i) => {
    if (i < capacity) out[i] = id ?? null
    else if (id) overflow.push(id)
  })
  return overflow.length ? [...out, ...overflow] : out
}

/** Everyone in `ids` without `id`, and `id` at the end. */
const withMember = (ids: string[] = [], id: string): string[] => [...ids.filter((x) => x !== id), id]
const withoutMember = (ids: string[] = [], id: string): string[] => ids.filter((x) => x !== id)

/**
 * Seat a block of guests (family/subgroup/group) at a table as one unit.
 *
 * Table-mode tables have no seat identity, so members are appended.
 * Seat-mode tables keep their empty slots — members take a contiguous run of
 * free seats (wrapping past the last seat, since seats circle the table) so a
 * family reads as one cluster and nobody already seated gets shifted.
 *
 * `anchor` pins the run's first seat (a drop onto a specific SeatSlot).
 * Returns null when no run fits — callers must treat that as a refused drop.
 */
export const placeMembers = (
  arr: Seats = [],
  capacity: number,
  seatMode: SeatMode,
  memberIds: string[],
  anchor: number | null = null
): { assignedGuestIds: Seats; indices: number[] | null } | null => {
  if (seatMode !== 'seat') {
    return { assignedGuestIds: [...arr.filter(Boolean), ...memberIds], indices: null }
  }
  const seats = normaliseSeats(arr, capacity)
  const n = memberIds.length
  if (n > capacity) return null

  const runFrom = (start: number): number[] | null => {
    const idx: number[] = []
    for (let i = 0; i < n; i++) {
      const s = (start + i) % capacity
      if (seats[s]) return null
      idx.push(s)
    }
    return idx
  }

  let indices: number[] | null = null
  if (anchor != null) {
    indices = runFrom(((anchor % capacity) + capacity) % capacity)
  } else {
    for (let start = 0; start < capacity && !indices; start++) indices = runFrom(start)
  }
  if (!indices) return null

  indices.forEach((s, i) => {
    seats[s] = memberIds[i]
  })
  return { assignedGuestIds: seats, indices }
}

/**
 * Seat `memberIds` at `tableId` as one block, taking them off wherever they
 * were. Shared by groups, subgroups and families: `seatIndex` pins where the
 * block starts on a seat-level table.
 */
const seatBlock = (
  plan: Plan,
  memberIds: string[],
  tableId: string,
  seatIndex: number | null,
  type: string,
  label: string
) => {
  const target = plan.tables[tableId]
  const members = memberIds.filter((id) => plan.guests[id])
  if (!target || !members.length) return null

  const affected = new Set([tableId])
  members.forEach((gid) => {
    const t = plan.guests[gid].assignedTableId
    if (t && plan.tables[t]) affected.add(t)
  })

  const memberSet = new Set(members)
  const working: Record<string, Seats> = {}
  affected.forEach((tid) => {
    working[tid] = withoutMembers([...(plan.tables[tid].assignedGuestIds || [])], memberSet, plan.tables[tid].seatMode)
  })
  const placed = placeMembers(working[tableId], target.capacity, target.seatMode, members, seatIndex)
  if (!placed) return null
  working[tableId] = placed.assignedGuestIds

  const guests: Record<string, Guest> = {}
  members.forEach((gid, i) => {
    guests[gid] = {
      ...plan.guests[gid],
      assignedTableId: tableId,
      assignedSeatId: placed.indices ? seatId(tableId, placed.indices[i]) : null,
    }
  })
  const tables: Record<string, Table> = {}
  affected.forEach((tid) => {
    tables[tid] = { ...plan.tables[tid], assignedGuestIds: working[tid] }
  })
  return { type, label, payload: { guests, tables } }
}

const nextTableLabel = (plan: Pick<Plan, 'tables'>): string => {
  let max = 0
  let count = 0
  for (const t of Object.values(plan.tables)) {
    count++
    const m = /^Table\s+(\d+)$/i.exec(t.label || '')
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `Table ${Math.max(max, count) + 1}`
}

// ── tables ──────────────────────────────────────────────────────────────────

export const addTable =
  ({
    type = 'round',
    x = 0,
    y = 0,
    label,
    capacity,
    sizeUnits,
    perSideSeats,
    seatMode,
  }: {
    type?: string
    x?: number
    y?: number
    label?: string
    capacity?: number
    sizeUnits?: SizeUnits | null
    perSideSeats?: PerSideSeats | null
    seatMode?: SeatMode
  }): Action =>
  (plan) => {
    const def = getTableType(type)
    const ppu = plan.settings?.pixelsPerUnit || DEFAULT_PPU
    const base: Table = {
      id: makeId('tbl'),
      label: label || nextTableLabel(plan),
      designation: null,
      type,
      capacity: capacity ?? def.defaultCapacity,
      x: Math.round(x),
      y: Math.round(y),
      rotation: 0,
      assignedGuestIds: [],
      seatMode: seatMode || plan.settings?.defaultSeatMode || 'table',
      colour: null,
      perSideSeats: perSideSeats || null,
    }
    // A preset supplies an explicit footprint/seating; a bare type derives the
    // default footprint from the preset + capacity (legacy behaviour).
    const table: Table = { ...base, sizeUnits: sizeUnits || deriveSizeUnits(base, ppu) }
    return {
      type: 'ADD_TABLE',
      label: 'Add table',
      payload: { tables: { [table.id]: table } },
      meta: { newTableId: table.id },
    }
  }

export const removeTable =
  (id: string): Action =>
  (plan) => {
    const table = plan.tables[id]
    if (!table) return null
    const guests: Record<string, Guest> = {}
    for (const gid of table.assignedGuestIds || []) {
      const g = gid ? plan.guests[gid] : undefined
      if (g) guests[g.id] = { ...g, assignedTableId: null, assignedSeatId: null }
    }
    return { type: 'DELETE_TABLE', label: 'Delete table', payload: { tables: { [id]: null }, guests } }
  }

export const duplicateTable =
  (id: string): Action =>
  (plan) => {
    const src = plan.tables[id]
    if (!src) return null
    const copy: Table = {
      ...src,
      id: makeId('tbl'),
      label: `${src.label} copy`,
      x: src.x + 32,
      y: src.y + 32,
      assignedGuestIds: [],
    }
    return {
      type: 'ADD_TABLE',
      label: 'Duplicate table',
      payload: { tables: { [copy.id]: copy } },
      meta: { newTableId: copy.id },
    }
  }

/** A change to one table's own fields. */
const patchTable = (plan: Plan, id: string, type: string, label: string, patch: Partial<Table>) => {
  const table = plan.tables[id]
  if (!table) return null
  return { type, label, payload: { tables: { [id]: { ...table, ...patch } } } }
}

export const moveTable =
  (id: string, x: number, y: number): Action =>
  (plan) =>
    patchTable(plan, id, 'MOVE_TABLE', 'Move table', { x: Math.round(x), y: Math.round(y) })

export const renameTable =
  (id: string, label: string): Action =>
  (plan) =>
    plan.tables[id]?.label === label ? null : patchTable(plan, id, 'RENAME_TABLE', 'Rename table', { label })

export const changeCapacity =
  (id: string, capacity: number): Action =>
  (plan) => {
    const table = plan.tables[id]
    if (!table) return null
    const next = clampCapacity(table.type, capacity)
    if (next === table.capacity) return null
    return patchTable(plan, id, 'CHANGE_CAPACITY', 'Change capacity', { capacity: next })
  }

export const changeTableType =
  (id: string, type: string): Action =>
  (plan) => {
    const table = plan.tables[id]
    if (!table || table.type === type) return null
    const capacity = clampCapacity(type, table.capacity)
    // Switching to a preset shape drops any custom per-side seating and resets
    // the footprint to that type's defaults, so geometry matches the new shape.
    const ppu = plan.settings?.pixelsPerUnit || DEFAULT_PPU
    const base: Table = { ...table, type, capacity, perSideSeats: null, custom: false }
    return patchTable(plan, id, 'CHANGE_TYPE', 'Change table type', { ...base, sizeUnits: deriveSizeUnits(base, ppu) })
  }

// Set independent seat counts per edge for a (custom) rectangle. Capacity is
// derived from the sum, and seat-level arrays are re-sliced side by side so a
// resize on one edge can't evict a guest sitting on a different, untouched one.
export const setPerSideSeats =
  (id: string, perSide: Partial<PerSideSeats>): Action =>
  (plan) => {
    const table = plan.tables[id]
    if (!table) return null
    const clean = clampPerSide(perSide)
    const capacity = Math.max(1, seatCountFromPerSide(clean))
    let assignedGuestIds = table.assignedGuestIds || []
    if (table.seatMode === 'seat') {
      const oldSides = table.perSideSeats || sidesFromLayout(table.capacity, getTableType(table.type))
      assignedGuestIds = remapSeatsForSides(assignedGuestIds, oldSides, clean)
    }
    return patchTable(plan, id, 'SET_PER_SIDE_SEATS', 'Set seats per side', {
      perSideSeats: clean,
      capacity,
      assignedGuestIds,
    })
  }

// Create a rectangle/square table with per-edge seat counts (the custom builder).
export const createCustomTable =
  ({
    x = 0,
    y = 0,
    width = 200,
    height = 120,
    perSideSeats,
    label,
    seatMode,
  }: {
    x?: number
    y?: number
    width?: number
    height?: number
    perSideSeats?: Partial<PerSideSeats>
    label?: string
    seatMode?: SeatMode
  } = {}): Action =>
  (plan) => {
    const clean = clampPerSide(perSideSeats || { top: 4, right: 0, bottom: 4, left: 0 })
    const capacity = Math.max(1, seatCountFromPerSide(clean))
    const id = makeId('tbl')
    const table: Table = {
      id,
      label: label || nextTableLabel(plan),
      designation: null,
      type: 'rect',
      custom: true,
      capacity,
      x: Math.round(x),
      y: Math.round(y),
      rotation: 0,
      assignedGuestIds: [],
      seatMode: seatMode || plan.settings?.defaultSeatMode || 'table',
      colour: null,
      perSideSeats: clean,
      sizeUnits: { shape: 'rect', width: Math.round(width), height: Math.round(height) },
    }
    return {
      type: 'ADD_TABLE',
      label: 'Add custom table',
      payload: { tables: { [id]: table } },
      meta: { newTableId: id },
    }
  }

export const setDesignation =
  (id: string, designation: Designation): Action =>
  (plan) =>
    patchTable(plan, id, 'SET_DESIGNATION', 'Set designation', { designation })

export const setTableColour =
  (id: string, colour: string | null): Action =>
  (plan) =>
    patchTable(plan, id, 'SET_TABLE_COLOUR', 'Recolour table', { colour })

export const rotateTable =
  (id: string, rotation: number): Action =>
  (plan) =>
    patchTable(plan, id, 'ROTATE_TABLE', 'Rotate table', { rotation })

// Set the canvas scale (px per cm). Undoable so an accidental calibration can
// be reversed — every table/room/chair re-derives its pixels from this.
export const calibrate =
  (pixelsPerUnit: number): Action =>
  (plan) => {
    if (!pixelsPerUnit || pixelsPerUnit === plan.settings.pixelsPerUnit) return null
    return { type: 'CALIBRATE', label: 'Calibrate scale', payload: { settings: { pixelsPerUnit } } }
  }

// Resize the room in real-world units. Stores cm (authoritative) plus derived
// px so legacy readers stay in sync.
export const setRoomSizeUnits =
  (widthUnits: number, heightUnits: number): Action =>
  (plan) => {
    const ppu = plan.settings?.pixelsPerUnit || DEFAULT_PPU
    return {
      type: 'RESIZE_ROOM',
      label: 'Resize room',
      payload: {
        room: {
          ...plan.room,
          widthUnits: Math.round(widthUnits),
          heightUnits: Math.round(heightUnits),
          width: Math.round(widthUnits * ppu),
          height: Math.round(heightUnits * ppu),
        },
      },
    }
  }

// ── table presets (venue defaults) ──────────────────────────────────────────
// A preset stores a table's footprint AND seating ("chairings") so it can be
// dropped from the palette to recreate the same table. Stored on settings so it
// persists with the plan; undoable like any settings change.

export const saveTablePreset =
  (id: string, name: string): Action =>
  (plan) => {
    const table = plan.tables[id]
    if (!table) return null
    const presets = plan.settings.customTablePresets || []
    const preset: TablePreset = {
      id: makeId('preset'),
      name: (name || '').trim() || table.label || 'Preset',
      type: table.type,
      sizeUnits: table.sizeUnits || null,
      capacity: table.capacity,
      perSideSeats: table.perSideSeats || null,
      seatMode: table.seatMode || 'table',
    }
    return {
      type: 'SAVE_TABLE_PRESET',
      label: 'Save table preset',
      payload: { settings: { customTablePresets: [...presets, preset] } },
    }
  }

export const deleteTablePreset =
  (presetId: string): Action =>
  (plan) => {
    const presets = plan.settings.customTablePresets || []
    if (!presets.some((p) => p.id === presetId)) return null
    return {
      type: 'DELETE_TABLE_PRESET',
      label: 'Delete table preset',
      payload: { settings: { customTablePresets: presets.filter((p) => p.id !== presetId) } },
    }
  }

export const resizeTable =
  (id: string, sizeUnits: Partial<SizeUnits>): Action =>
  (plan) => {
    const table = plan.tables[id]
    if (!table) return null
    return patchTable(plan, id, 'RESIZE_TABLE', 'Resize table', {
      sizeUnits: { ...(table.sizeUnits || {}), ...sizeUnits } as SizeUnits,
    })
  }

export const setSeatMode =
  (id: string, mode: SeatMode): Action =>
  (plan) => {
    const table = plan.tables[id]
    if (!table || table.seatMode === mode) return null
    const seated = (table.assignedGuestIds || []).filter(Boolean)
    return patchTable(plan, id, 'SET_SEAT_MODE', 'Toggle seat mode', {
      seatMode: mode,
      assignedGuestIds: mode === 'seat' ? normaliseSeats(seated, table.capacity) : seated,
    })
  }

export const clearTable =
  (id: string): Action =>
  (plan) => {
    const table = plan.tables[id]
    if (!table || !(table.assignedGuestIds || []).some(Boolean)) return null
    const guests: Record<string, Guest> = {}
    for (const gid of table.assignedGuestIds) {
      const g = gid ? plan.guests[gid] : undefined
      if (g) guests[g.id] = { ...g, assignedTableId: null, assignedSeatId: null }
    }
    return {
      type: 'CLEAR_TABLE',
      label: 'Clear table',
      payload: { tables: { [id]: { ...table, assignedGuestIds: [] } }, guests },
    }
  }

// ── guests ──────────────────────────────────────────────────────────────────

// Create a single guest manually (e.g. a late RSVP) without re-importing a CSV.
export const addGuest =
  (partial: Partial<Guest> = {}): Action =>
  () => {
    const first = (partial.firstName || '').trim()
    const last = (partial.lastName || '').trim()
    const fullName = (partial.fullName || `${first} ${last}`).trim() || 'New guest'
    const id = makeId('g')
    const guest: Guest = {
      id,
      firstName: first,
      lastName: last,
      fullName,
      email: (partial.email || '').trim(),
      dietary: partial.dietary || '',
      dietaryRaw: partial.dietaryRaw || partial.dietary || '',
      entree: partial.entree || '',
      side: partial.side || '',
      rsvpStatus: partial.rsvpStatus || 'confirmed',
      plusOneOf: partial.plusOneOf ?? null,
      groupId: partial.groupId ?? null,
      subgroupId: null,
      familyId: null,
      assignedTableId: null,
      assignedSeatId: null,
      notes: (partial.notes || '').trim(),
      tags: Array.isArray(partial.tags) ? partial.tags : [],
    }
    return {
      type: 'ADD_GUEST',
      label: 'Add guest',
      payload: { guests: { [id]: guest } },
      meta: { newGuestId: id },
    }
  }

// Edit a guest's own fields (name, email, side, RSVP, dietary, notes, tags).
// Group/subgroup/family membership and seating are NOT edited here — those have
// their own commands, since they patch several collections at once.
export const updateGuest =
  (id: string, patch: Partial<Guest>): Action =>
  (plan) => {
    const guest = plan.guests[id]
    if (!guest) return null
    const next = { ...guest, ...patch }
    next.fullName = patch.fullName || `${next.firstName} ${next.lastName}`.trim() || next.fullName
    return { type: 'UPDATE_GUEST', label: 'Edit guest', payload: { guests: { [id]: next } } }
  }

/**
 * Take a set of guests off the list, and out of everything that points at
 * them: a table's seats, a group's, subgroup's or family's members, a seating
 * rule, another guest's plus-one. Removing the guest and leaving those is how
 * a table ends up holding someone who does not exist.
 */
const removal = (plan: Plan, ids: ReadonlySet<string>) => {
  const guests: Record<string, Guest | null> = {}
  const tables: Record<string, Table> = {}
  const groups: Record<string, Group> = {}
  const subgroups: Record<string, Subgroup> = {}
  const families: Record<string, Family> = {}
  const named = (members: string[] = []) => members.some((gid) => ids.has(gid))
  const unnamed = (members: string[] = []) => members.filter((gid) => !ids.has(gid))

  ids.forEach((id) => {
    guests[id] = null
  })
  for (const t of Object.values(plan.tables)) {
    const seats = t.assignedGuestIds || []
    if (seats.some((gid) => gid && ids.has(gid))) {
      tables[t.id] = { ...t, assignedGuestIds: withoutMembers(seats, ids, t.seatMode) }
    }
  }
  for (const gr of Object.values(plan.groups)) {
    if (named(gr.memberIds)) groups[gr.id] = { ...gr, memberIds: unnamed(gr.memberIds) }
  }
  for (const sg of Object.values(plan.subgroups)) {
    if (named(sg.memberIds)) subgroups[sg.id] = { ...sg, memberIds: unnamed(sg.memberIds) }
  }
  for (const f of Object.values(plan.families)) {
    if (named(f.memberIds)) families[f.id] = { ...f, memberIds: unnamed(f.memberIds) }
  }
  for (const other of Object.values(plan.guests)) {
    if (!ids.has(other.id) && other.plusOneOf && ids.has(other.plusOneOf)) {
      guests[other.id] = { ...other, plusOneOf: null }
    }
  }
  // A rule about someone who has gone is a rule about nobody.
  const constraints = plan.constraints.filter((c) => !(c.guestIds || []).some((gid) => ids.has(gid)))
  return {
    guests,
    tables,
    groups,
    subgroups,
    families,
    ...(constraints.length !== plan.constraints.length ? { constraints } : {}),
  }
}

export const removeGuest =
  (guestId: string): Action =>
  (plan) =>
    plan.guests[guestId]
      ? { type: 'DELETE_GUEST', label: 'Delete guest', payload: removal(plan, new Set([guestId])) }
      : null

export const removeGuests =
  (ids: readonly string[]): Action =>
  (plan) => {
    const idSet = new Set((ids || []).filter((id) => plan.guests[id]))
    if (!idSet.size) return null
    return { type: 'DELETE_GUESTS', label: `Delete ${idSet.size} guests`, payload: removal(plan, idSet) }
  }

// ── assignment ────────────────────────────────────────────────────────────

export const assignGuest =
  (guestId: string, tableId: string, seatIndex: number | null = null): Action =>
  (plan) => {
    const guest = plan.guests[guestId]
    const target = plan.tables[tableId]
    if (!guest || !target) return null

    const prevTableId = guest.assignedTableId
    const affected = new Set([tableId])
    if (prevTableId && plan.tables[prevTableId]) affected.add(prevTableId)

    const working: Record<string, Seats> = {}
    affected.forEach((tid) => {
      working[tid] = [...(plan.tables[tid].assignedGuestIds || [])]
    })
    if (prevTableId && working[prevTableId]) {
      working[prevTableId] = withoutGuest(working[prevTableId], guestId, plan.tables[prevTableId].seatMode)
    }

    const guests: Record<string, Guest> = {}
    if (target.seatMode === 'seat' && seatIndex != null) {
      const arr = normaliseSeats(withoutGuest(working[tableId], guestId, 'seat'), target.capacity)
      const occupant = arr[seatIndex]
      if (occupant && occupant !== guestId) {
        guests[occupant] = { ...plan.guests[occupant], assignedTableId: null, assignedSeatId: null }
      }
      arr[seatIndex] = guestId
      working[tableId] = arr
      guests[guestId] = { ...guest, assignedTableId: tableId, assignedSeatId: seatId(tableId, seatIndex) }
    } else {
      const arr = working[tableId].filter((id) => id && id !== guestId)
      arr.push(guestId)
      working[tableId] = arr
      guests[guestId] = { ...guest, assignedTableId: tableId, assignedSeatId: null }
    }

    const tables: Record<string, Table> = {}
    affected.forEach((tid) => {
      tables[tid] = { ...plan.tables[tid], assignedGuestIds: working[tid] }
    })
    return { type: 'ASSIGN_GUEST', label: 'Assign guest', payload: { guests, tables } }
  }

// Swap two seated guests within the same seat-level table (or move one into an
// empty seat in the pair). Drag a seated guest onto an occupied seat to swap.
export const swapSeatGuests =
  (tableId: string, indexA: number, indexB: number): Action =>
  (plan) => {
    const table = plan.tables[tableId]
    if (!table || table.seatMode !== 'seat' || indexA === indexB) return null

    const arr = normaliseSeats(table.assignedGuestIds || [], table.capacity)
    if (indexA < 0 || indexB < 0 || indexA >= arr.length || indexB >= arr.length) return null

    const a = arr[indexA] ?? null
    const b = arr[indexB] ?? null
    if (!a && !b) return null

    const next = [...arr]
    next[indexA] = b
    next[indexB] = a

    const guests: Record<string, Guest> = {}
    if (a && plan.guests[a]) {
      guests[a] = { ...plan.guests[a], assignedTableId: tableId, assignedSeatId: seatId(tableId, indexB) }
    }
    if (b && plan.guests[b]) {
      guests[b] = { ...plan.guests[b], assignedTableId: tableId, assignedSeatId: seatId(tableId, indexA) }
    }
    return {
      type: 'SWAP_SEATS',
      label: 'Swap seats',
      payload: { tables: { [tableId]: { ...table, assignedGuestIds: next } }, guests },
    }
  }

export const unassignGuest =
  (guestId: string): Action =>
  (plan) => {
    const guest = plan.guests[guestId]
    if (!guest || !guest.assignedTableId) return null
    const tid = guest.assignedTableId
    const table = plan.tables[tid]
    return {
      type: 'UNASSIGN_GUEST',
      label: 'Unassign guest',
      payload: {
        guests: { [guestId]: { ...guest, assignedTableId: null, assignedSeatId: null } },
        tables: table
          ? { [tid]: { ...table, assignedGuestIds: withoutGuest(table.assignedGuestIds, guestId, table.seatMode) } }
          : {},
      },
    }
  }

export const assignGroupToTable =
  (groupId: string, tableId: string): Action =>
  (plan) => {
    const group = plan.groups[groupId]
    return group ? seatBlock(plan, group.memberIds || [], tableId, null, 'ASSIGN_GROUP', 'Seat group') : null
  }

// ── groups ──────────────────────────────────────────────────────────────────

const GROUP_COLOURS = ['#7B6FA0', '#4A7C59', '#C07C2A', '#5C7E9E', '#A6576A', '#7C6F5B', '#5E8A7C', '#9E6B4A']

export const createGroup =
  (memberIds: string[], { name, colour }: { name?: string; colour?: string } = {}): Action =>
  (plan) => {
    const ids = (memberIds || []).filter((id) => plan.guests[id])
    if (!ids.length) return null
    const group: Group = {
      id: makeId('grp'),
      name: name || 'New group',
      colour: colour || GROUP_COLOURS[Object.keys(plan.groups).length % GROUP_COLOURS.length],
      memberIds: ids,
    }
    const guests: Record<string, Guest> = {}
    ids.forEach((gid) => {
      guests[gid] = { ...plan.guests[gid], groupId: group.id }
    })
    return {
      type: 'CREATE_GROUP',
      label: 'Create group',
      payload: { groups: { [group.id]: group }, guests },
      meta: { newGroupId: group.id },
    }
  }

// Create an empty group (no members yet) — for the "+ New group" entry point,
// after which guests are added via drag or the inspector. createGroup requires
// at least one member; this one intentionally does not.
export const createEmptyGroup =
  ({ name, colour }: { name?: string; colour?: string } = {}): Action =>
  (plan) => {
    const group: Group = {
      id: makeId('grp'),
      name: name || 'New group',
      colour: colour || GROUP_COLOURS[Object.keys(plan.groups).length % GROUP_COLOURS.length],
      memberIds: [],
    }
    return {
      type: 'CREATE_EMPTY_GROUP',
      label: 'Create group',
      payload: { groups: { [group.id]: group } },
      meta: { newGroupId: group.id },
    }
  }

export const dissolveGroup =
  (groupId: string): Action =>
  (plan) => {
    const group = plan.groups[groupId]
    if (!group) return null
    // Also dissolve all subgroups belonging to this group…
    const ownSubgroups = Object.values(plan.subgroups).filter((sg) => sg.parentGroupId === groupId)
    const subgroups: Record<string, null> = {}
    ownSubgroups.forEach((sg) => {
      subgroups[sg.id] = null
    })
    // …and all families attached to this group, directly or via one of its subgroups.
    const ownSubgroupIds = new Set(ownSubgroups.map((sg) => sg.id))
    const families: Record<string, null> = {}
    Object.values(plan.families)
      .filter((f) => f.parentGroupId === groupId || (f.parentSubgroupId && ownSubgroupIds.has(f.parentSubgroupId)))
      .forEach((f) => {
        families[f.id] = null
      })
    const guests: Record<string, Guest> = {}
    ;(group.memberIds || []).forEach((gid) => {
      const g = plan.guests[gid]
      if (g) guests[gid] = { ...g, groupId: null, subgroupId: null, familyId: null }
    })
    return {
      type: 'DISSOLVE_GROUP',
      label: 'Dissolve group',
      payload: { groups: { [groupId]: null }, subgroups, families, guests },
    }
  }

export const renameGroup =
  (groupId: string, name: string): Action =>
  (plan) => {
    const group = plan.groups[groupId]
    if (!group || group.name === name) return null
    return { type: 'RENAME_GROUP', label: 'Rename group', payload: { groups: { [groupId]: { ...group, name } } } }
  }

export const recolourGroup =
  (groupId: string, colour: string): Action =>
  (plan) => {
    const group = plan.groups[groupId]
    if (!group) return null
    return { type: 'RECOLOUR_GROUP', label: 'Recolour group', payload: { groups: { [groupId]: { ...group, colour } } } }
  }

export const addToGroup =
  (groupId: string, guestId: string): Action =>
  (plan) => {
    const group = plan.groups[groupId]
    const guest = plan.guests[guestId]
    if (!group || !guest) return null
    const groups: Record<string, Group> = {}
    const subgroups: Record<string, Subgroup> = {}
    const families: Record<string, Family> = {}
    // Out of the previous group…
    const prev = guest.groupId ? plan.groups[guest.groupId] : undefined
    if (prev) groups[prev.id] = { ...prev, memberIds: withoutMember(prev.memberIds, guestId) }
    // …and subgroup and family: crossing groups leaves them stale otherwise.
    const prevSg = guest.subgroupId ? plan.subgroups[guest.subgroupId] : undefined
    if (prevSg) subgroups[prevSg.id] = { ...prevSg, memberIds: withoutMember(prevSg.memberIds, guestId) }
    const prevFam = guest.familyId ? plan.families[guest.familyId] : undefined
    if (prevFam) families[prevFam.id] = { ...prevFam, memberIds: withoutMember(prevFam.memberIds, guestId) }
    groups[groupId] = { ...group, memberIds: withMember(group.memberIds, guestId) }
    return {
      type: 'ADD_TO_GROUP',
      label: 'Add to group',
      payload: {
        groups,
        ...(Object.keys(subgroups).length ? { subgroups } : {}),
        ...(Object.keys(families).length ? { families } : {}),
        guests: { [guestId]: { ...guest, groupId, subgroupId: null, familyId: null } },
      },
    }
  }

export const mergeGroups =
  (sourceGroupId: string, targetGroupId: string): Action =>
  (plan) => {
    const source = plan.groups[sourceGroupId]
    const target = plan.groups[targetGroupId]
    if (!source || !target || sourceGroupId === targetGroupId) return null
    const memberIds = (source.memberIds || []).filter((id) => plan.guests[id])
    const guests: Record<string, Guest> = {}
    memberIds.forEach((gid) => {
      guests[gid] = { ...plan.guests[gid], groupId: targetGroupId }
    })
    const existing = new Set(target.memberIds || [])
    return {
      type: 'MERGE_GROUPS',
      label: 'Merge groups',
      payload: {
        groups: {
          [sourceGroupId]: null,
          [targetGroupId]: { ...target, memberIds: [...(target.memberIds || []), ...memberIds.filter((id) => !existing.has(id))] },
        },
        guests,
      },
    }
  }

export const removeFromGroup =
  (guestId: string): Action =>
  (plan) => {
    const guest = plan.guests[guestId]
    if (!guest || !guest.groupId) return null
    const group = plan.groups[guest.groupId]
    // Also clear any subgroup / family membership.
    const sg = guest.subgroupId ? plan.subgroups[guest.subgroupId] : undefined
    const fam = guest.familyId ? plan.families[guest.familyId] : undefined
    return {
      type: 'REMOVE_FROM_GROUP',
      label: 'Remove from group',
      payload: {
        guests: { [guestId]: { ...guest, groupId: null, subgroupId: null, familyId: null } },
        ...(group ? { groups: { [group.id]: { ...group, memberIds: withoutMember(group.memberIds, guestId) } } } : {}),
        ...(sg ? { subgroups: { [sg.id]: { ...sg, memberIds: withoutMember(sg.memberIds, guestId) } } } : {}),
        ...(fam ? { families: { [fam.id]: { ...fam, memberIds: withoutMember(fam.memberIds, guestId) } } } : {}),
      },
    }
  }

// ── subgroups ────────────────────────────────────────────────────────────────

const SUBGROUP_COLOURS = [
  '#9B7FA6', '#5C9E72', '#D08C3A', '#4E8EBE', '#B8607A',
  '#8C6E4A', '#4E9A8E', '#9E7A3A', '#5E6EAE', '#8E5E6E',
]

export const createSubgroup =
  (parentGroupId: string, { name, colour }: { name?: string; colour?: string } = {}): Action =>
  (plan) => {
    if (!plan.groups[parentGroupId]) return null
    const id = makeId('sg')
    const idx = Object.keys(plan.subgroups).length
    const subgroup: Subgroup = {
      id,
      name: name || 'Subgroup',
      colour: colour || SUBGROUP_COLOURS[idx % SUBGROUP_COLOURS.length],
      parentGroupId,
      memberIds: [],
    }
    return {
      type: 'CREATE_SUBGROUP',
      label: 'Create subgroup',
      payload: { subgroups: { [id]: subgroup } },
      meta: { newSubgroupId: id },
    }
  }

export const renameSubgroup =
  (subgroupId: string, name: string): Action =>
  (plan) => {
    const sg = plan.subgroups[subgroupId]
    if (!sg || sg.name === name) return null
    return { type: 'RENAME_SUBGROUP', label: 'Rename subgroup', payload: { subgroups: { [subgroupId]: { ...sg, name } } } }
  }

export const recolourSubgroup =
  (subgroupId: string, colour: string): Action =>
  (plan) => {
    const sg = plan.subgroups[subgroupId]
    if (!sg) return null
    return { type: 'RECOLOUR_SUBGROUP', label: 'Recolour subgroup', payload: { subgroups: { [subgroupId]: { ...sg, colour } } } }
  }

export const dissolveSubgroup =
  (subgroupId: string): Action =>
  (plan) => {
    const sg = plan.subgroups[subgroupId]
    if (!sg) return null
    // Also dissolve any families attached to this subgroup.
    const families: Record<string, null> = {}
    Object.values(plan.families)
      .filter((f) => f.parentSubgroupId === subgroupId)
      .forEach((f) => {
        families[f.id] = null
      })
    const guests: Record<string, Guest> = {}
    ;(sg.memberIds || []).forEach((gid) => {
      const g = plan.guests[gid]
      if (g) guests[gid] = { ...g, subgroupId: null, familyId: null }
    })
    return {
      type: 'DISSOLVE_SUBGROUP',
      label: 'Dissolve subgroup',
      payload: { subgroups: { [subgroupId]: null }, families, guests },
    }
  }

export const addToSubgroup =
  (subgroupId: string, guestId: string): Action =>
  (plan) => {
    const sg = plan.subgroups[subgroupId]
    const guest = plan.guests[guestId]
    if (!sg || !guest) return null
    const parentGroupId = sg.parentGroupId
    const group = parentGroupId ? plan.groups[parentGroupId] : undefined
    if (!parentGroupId || !group) return null

    const groups: Record<string, Group> = {}
    const subgroups: Record<string, Subgroup> = {}
    const families: Record<string, Family> = {}

    // Out of the previous subgroup, if it's a different one.
    const prevSg = guest.subgroupId && guest.subgroupId !== subgroupId ? plan.subgroups[guest.subgroupId] : undefined
    if (prevSg) subgroups[prevSg.id] = { ...prevSg, memberIds: withoutMember(prevSg.memberIds, guestId) }
    // Landing directly on a subgroup always exits any family — family is deeper.
    const prevFam = guest.familyId ? plan.families[guest.familyId] : undefined
    if (prevFam) families[prevFam.id] = { ...prevFam, memberIds: withoutMember(prevFam.memberIds, guestId) }
    // Out of the previous parent group, if moving to a different group.
    const prevGrp = guest.groupId && guest.groupId !== parentGroupId ? plan.groups[guest.groupId] : undefined
    if (prevGrp) groups[prevGrp.id] = { ...prevGrp, memberIds: withoutMember(prevGrp.memberIds, guestId) }

    subgroups[subgroupId] = { ...sg, memberIds: withMember(sg.memberIds, guestId) }
    // In the parent group's members too.
    groups[parentGroupId] = {
      ...group,
      memberIds: (group.memberIds || []).includes(guestId) ? group.memberIds : [...(group.memberIds || []), guestId],
    }

    return {
      type: 'ADD_TO_SUBGROUP',
      label: 'Add to subgroup',
      payload: {
        subgroups,
        groups,
        ...(Object.keys(families).length ? { families } : {}),
        guests: { [guestId]: { ...guest, groupId: parentGroupId, subgroupId, familyId: null } },
      },
    }
  }

export const removeFromSubgroup =
  (guestId: string): Action =>
  (plan) => {
    const guest = plan.guests[guestId]
    if (!guest || !guest.subgroupId) return null
    const sg = plan.subgroups[guest.subgroupId]
    const fam = guest.familyId ? plan.families[guest.familyId] : undefined
    return {
      type: 'REMOVE_FROM_SUBGROUP',
      label: 'Remove from subgroup',
      payload: {
        guests: { [guestId]: { ...guest, subgroupId: null, familyId: null } },
        ...(sg ? { subgroups: { [sg.id]: { ...sg, memberIds: withoutMember(sg.memberIds, guestId) } } } : {}),
        ...(fam ? { families: { [fam.id]: { ...fam, memberIds: withoutMember(fam.memberIds, guestId) } } } : {}),
      },
    }
  }

export const assignSubgroupToTable =
  (subgroupId: string, tableId: string): Action =>
  (plan) => {
    const sg = plan.subgroups[subgroupId]
    return sg ? seatBlock(plan, sg.memberIds || [], tableId, null, 'ASSIGN_SUBGROUP', 'Seat subgroup') : null
  }

// ── families ─────────────────────────────────────────────────────────────────
// A family is the deepest containment level: it can sit directly under a Group,
// under a Subgroup (which implies its Group), or stand alone with no parent at
// all — the same way a Group can. A guest has at most one deepest container at
// a time, mirroring how subgroupId already implies a matching groupId.

// TODO(family-ux): only 8 colours, cycles by index — confirmed real collisions
// once a plan has >8 families (two families end up sharing a ring colour,
// which defeats the "spot a family at a glance" goal the ring exists for).
// See tmp/family-ux-followups.md #1.
const FAMILY_COLOURS = ['#B3866B', '#6B8FA3', '#8FA36B', '#A36B8F', '#6BA3A0', '#A38F6B', '#7A6BA3', '#A3766B']

export const createFamily =
  ({
    parentGroupId = null,
    parentSubgroupId = null,
    name,
    colour,
  }: { parentGroupId?: string | null; parentSubgroupId?: string | null; name?: string; colour?: string } = {}): Action =>
  (plan) => {
    let resolvedGroupId = parentGroupId
    if (parentSubgroupId) {
      const parentSg = plan.subgroups[parentSubgroupId]
      if (!parentSg) return null
      resolvedGroupId = parentSg.parentGroupId
    } else if (parentGroupId && !plan.groups[parentGroupId]) {
      return null
    }
    const id = makeId('fam')
    const idx = Object.keys(plan.families).length
    const family: Family = {
      id,
      name: name || 'Family',
      colour: colour || FAMILY_COLOURS[idx % FAMILY_COLOURS.length],
      parentGroupId: resolvedGroupId,
      parentSubgroupId: parentSubgroupId || null,
      memberIds: [],
    }
    return {
      type: 'CREATE_FAMILY',
      label: 'Create family',
      payload: { families: { [id]: family } },
      meta: { newFamilyId: id },
    }
  }

export const renameFamily =
  (familyId: string, name: string): Action =>
  (plan) => {
    const f = plan.families[familyId]
    if (!f || f.name === name) return null
    return { type: 'RENAME_FAMILY', label: 'Rename family', payload: { families: { [familyId]: { ...f, name } } } }
  }

export const recolourFamily =
  (familyId: string, colour: string): Action =>
  (plan) => {
    const f = plan.families[familyId]
    if (!f) return null
    return { type: 'RECOLOUR_FAMILY', label: 'Recolour family', payload: { families: { [familyId]: { ...f, colour } } } }
  }

export const dissolveFamily =
  (familyId: string): Action =>
  (plan) => {
    const f = plan.families[familyId]
    if (!f) return null
    const guests: Record<string, Guest> = {}
    ;(f.memberIds || []).forEach((gid) => {
      const g = plan.guests[gid]
      if (g) guests[gid] = { ...g, familyId: null }
    })
    return { type: 'DISSOLVE_FAMILY', label: 'Dissolve family', payload: { families: { [familyId]: null }, guests } }
  }

// Adds a guest to a family, re-parenting them into the family's own group/
// subgroup chain (or clearing group/subgroup entirely for a standalone
// family) — the same "land on the deepest container, inherit its ancestry"
// rule addToSubgroup already applies one level up.
// TODO(family-ux): a guest's plus-one (guest.plusOneOf) never auto-follows
// into the family when the primary guest joins — undecided whether that's
// the right default or a gap. See tmp/family-ux-followups.md #13.
export const addToFamily =
  (familyId: string, guestId: string): Action =>
  (plan) => {
    const fam = plan.families[familyId]
    const guest = plan.guests[guestId]
    if (!fam || !guest) return null

    const families: Record<string, Family> = {}
    const subgroups: Record<string, Subgroup> = {}
    const groups: Record<string, Group> = {}

    const prevFam = guest.familyId && guest.familyId !== familyId ? plan.families[guest.familyId] : undefined
    if (prevFam) families[prevFam.id] = { ...prevFam, memberIds: withoutMember(prevFam.memberIds, guestId) }
    families[familyId] = { ...fam, memberIds: withMember(fam.memberIds, guestId) }

    const nextSubgroupId = fam.parentSubgroupId || null
    const nextGroupId = fam.parentGroupId
    // Out of a subgroup the family is not under.
    const prevSg = guest.subgroupId && guest.subgroupId !== nextSubgroupId ? plan.subgroups[guest.subgroupId] : undefined
    if (prevSg) subgroups[prevSg.id] = { ...prevSg, memberIds: withoutMember(prevSg.memberIds, guestId) }
    // Into the family's own subgroup, if it has one.
    const targetSg = nextSubgroupId ? plan.subgroups[nextSubgroupId] : undefined
    if (targetSg) {
      subgroups[targetSg.id] = {
        ...targetSg,
        memberIds: (targetSg.memberIds || []).includes(guestId) ? targetSg.memberIds : [...(targetSg.memberIds || []), guestId],
      }
    }

    // Out of the old group and into the family's, or into the family's if not already there.
    const prevGrp = guest.groupId && guest.groupId !== nextGroupId ? plan.groups[guest.groupId] : undefined
    if (prevGrp) groups[prevGrp.id] = { ...prevGrp, memberIds: withoutMember(prevGrp.memberIds, guestId) }
    const nextGrp = nextGroupId ? plan.groups[nextGroupId] : undefined
    if (nextGrp && !(nextGrp.memberIds || []).includes(guestId)) {
      groups[nextGrp.id] = { ...nextGrp, memberIds: [...(nextGrp.memberIds || []), guestId] }
    }

    return {
      type: 'ADD_TO_FAMILY',
      label: 'Add to family',
      payload: {
        families,
        ...(Object.keys(subgroups).length ? { subgroups } : {}),
        ...(Object.keys(groups).length ? { groups } : {}),
        guests: { [guestId]: { ...guest, groupId: nextGroupId, subgroupId: nextSubgroupId, familyId } },
      },
    }
  }

export const removeFromFamily =
  (guestId: string): Action =>
  (plan) => {
    const guest = plan.guests[guestId]
    if (!guest || !guest.familyId) return null
    const fam = plan.families[guest.familyId]
    return {
      type: 'REMOVE_FROM_FAMILY',
      label: 'Remove from family',
      payload: {
        guests: { [guestId]: { ...guest, familyId: null } },
        ...(fam ? { families: { [fam.id]: { ...fam, memberIds: withoutMember(fam.memberIds, guestId) } } } : {}),
      },
    }
  }

// `seatIndex` is set when the family was dropped onto a specific SeatSlot — it
// pins where the family's run starts. Null means "anywhere it fits".
export const assignFamilyToTable =
  (familyId: string, tableId: string, seatIndex: number | null = null): Action =>
  (plan) => {
    const fam = plan.families[familyId]
    return fam ? seatBlock(plan, fam.memberIds || [], tableId, seatIndex, 'ASSIGN_FAMILY', 'Seat family') : null
  }

// ── zones ───────────────────────────────────────────────────────────────────

export const addZone =
  ({
    x,
    y,
    width,
    height,
    shape = 'rect',
    label = 'Zone',
    colour = '#E8E0D5',
  }: Pick<Zone, 'x' | 'y' | 'width' | 'height'> & Partial<Pick<Zone, 'shape' | 'label' | 'colour'>>): Action =>
  () => {
    const zone: Zone = {
      id: makeId('zone'),
      label,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
      shape,
      colour,
    }
    return {
      type: 'ADD_ZONE',
      label: 'Add zone',
      payload: { zones: { [zone.id]: zone } },
      meta: { newZoneId: zone.id },
    }
  }

export const removeZone =
  (id: string): Action =>
  (plan) =>
    plan.zones[id] ? { type: 'REMOVE_ZONE', label: 'Remove zone', payload: { zones: { [id]: null } } } : null

/** A change to one zone's own fields. */
const patchZone = (plan: Plan, id: string, type: string, label: string, patch: Partial<Zone>) => {
  const zone = plan.zones[id]
  if (!zone) return null
  return { type, label, payload: { zones: { [id]: { ...zone, ...patch } } } }
}

export const moveZone =
  (id: string, x: number, y: number): Action =>
  (plan) =>
    patchZone(plan, id, 'MOVE_ZONE', 'Move zone', { x: Math.round(x), y: Math.round(y) })

export const resizeZone =
  (id: string, dims: Partial<Pick<Zone, 'x' | 'y' | 'width' | 'height'>>): Action =>
  (plan) => {
    const next: Partial<Zone> = {}
    for (const k of ['x', 'y', 'width', 'height'] as const) {
      const value = dims[k]
      if (value != null) next[k] = Math.round(value)
    }
    return patchZone(plan, id, 'RESIZE_ZONE', 'Resize zone', next)
  }

export const renameZone =
  (id: string, label: string): Action =>
  (plan) =>
    plan.zones[id]?.label === label ? null : patchZone(plan, id, 'RENAME_ZONE', 'Rename zone', { label })

/** Round or square, the other way from what it is. */
export const reshapeZone =
  (id: string): Action =>
  (plan) => {
    const zone = plan.zones[id]
    if (!zone) return null
    const shape = zone.shape === 'circle' ? 'rect' : 'circle'
    return patchZone(plan, id, 'RESHAPE_ZONE', shape === 'circle' ? 'Make circle' : 'Make rectangle', { shape })
  }

// ── room spaces (multi-room) ─────────────────────────────────────────────────
// The room is a single object holding a `spaces` array, so these actions patch
// the whole room (mirroring RESIZE_ROOM). Live move/resize/vertex-drag use
// updateRoom for smooth feedback and dispatch the final command on pointer-up.

const SPACE_COLOURS = ['#FAF8F5', '#F3EFEA', '#EEF3F1', '#F1EEF5', '#F5EFEA']

export const addSpace =
  (
    space: {
      shape?: Space['shape']
      vertices?: Array<{ x: number; y: number }>
      width?: number
      height?: number
      label?: string
      x?: number
      y?: number
      backgroundColour?: string
    } = {}
  ): Action =>
  (plan) => {
    const room = plan.room
    const count = (room.spaces || []).length
    const common = {
      id: makeId('space'),
      label: space.label || `Space ${count + 1}`,
      x: Math.round(space.x || 0),
      y: Math.round(space.y || 0),
      backgroundColour: space.backgroundColour || SPACE_COLOURS[count % SPACE_COLOURS.length],
    }
    const sp: Space =
      space.shape === 'polygon'
        ? { ...common, shape: 'polygon', vertices: space.vertices || [] }
        : { ...common, shape: 'rect', width: space.width || 400, height: space.height || 300 }
    return {
      type: 'ADD_SPACE',
      label: 'Add space',
      payload: { room: { ...room, spaces: [...(room.spaces || []), sp] } },
      meta: { newSpaceId: sp.id },
    }
  }

export const removeSpace =
  (id: string): Action =>
  (plan) => {
    const room = plan.room
    const spaces = room.spaces || []
    if (spaces.length <= 1 || !spaces.some((s) => s.id === id)) return null // keep at least one
    // Doors and openings on that space's walls go with it.
    const wallElements: Record<string, WallElement | null> = {}
    Object.entries(plan.wallElements || {}).forEach(([wid, we]) => {
      wallElements[wid] = we?.spaceId === id ? null : we
    })
    return {
      type: 'REMOVE_SPACE',
      label: 'Remove space',
      payload: {
        room: {
          ...room,
          spaces: spaces.filter((s) => s.id !== id),
          joins: (room.joins || []).filter((j) => j.a !== id && j.b !== id),
        },
        wallElements,
      },
    }
  }

const patchSpace =
  (type: string, label: string) =>
  (id: string, patch: Partial<Space>): Action =>
  (plan) => {
    const spaces = plan.room.spaces || []
    if (!spaces.some((s) => s.id === id)) return null
    return {
      type,
      label,
      payload: { room: { ...plan.room, spaces: spaces.map((s) => (s.id === id ? ({ ...s, ...patch } as Space) : s)) } },
    }
  }

export const renameSpace = patchSpace('RENAME_SPACE', 'Rename space')
export const recolourSpace = patchSpace('RECOLOUR_SPACE', 'Recolour space')
export const resizeSpace = patchSpace('RESIZE_SPACE', 'Resize space')

/** The room as a drag of a space left it, as one step. */
export const editRoom =
  (room: Plan['room']): Action =>
  () => ({ type: 'EDIT_SPACE', label: 'Edit space', payload: { room } })

// Toggle a join between two spaces (open boundary so they read as one floor).
export const joinSpaces =
  (a: string, b: string): Action =>
  (plan) => {
    if (a === b) return null
    const joins = plan.room.joins || []
    const same = (j: { a: string; b: string }) => (j.a === a && j.b === b) || (j.a === b && j.b === a)
    const exists = joins.some(same)
    return {
      type: exists ? 'UNJOIN_SPACES' : 'JOIN_SPACES',
      label: exists ? 'Separate spaces' : 'Join spaces',
      payload: { room: { ...plan.room, joins: exists ? joins.filter((j) => !same(j)) : [...joins, { a, b }] } },
    }
  }

// ── wall elements (doors, openings on space walls) ───────────────────────────

export const addWallElement =
  ({
    spaceId,
    wallIndex,
    position,
    type,
    widthUnits,
    swingInward = true,
    swingSide = 'left',
  }: Omit<WallElement, 'id' | 'swingInward' | 'swingSide'> & Partial<Pick<WallElement, 'swingInward' | 'swingSide'>>): Action =>
  () => {
    const id = makeId('we')
    const we: WallElement = { id, spaceId, wallIndex, position, type, widthUnits, swingInward, swingSide }
    return { type: 'ADD_WALL_ELEMENT', label: `Add ${type}`, payload: { wallElements: { [id]: we } } }
  }

export const removeWallElement =
  (id: string): Action =>
  (plan) =>
    plan.wallElements[id]
      ? { type: 'REMOVE_WALL_ELEMENT', label: 'Remove wall element', payload: { wallElements: { [id]: null } } }
      : null

export const updateWallElement =
  (id: string, patch: Partial<WallElement>): Action =>
  (plan) => {
    const we = plan.wallElements[id]
    if (!we) return null
    return { type: 'UPDATE_WALL_ELEMENT', label: 'Update wall element', payload: { wallElements: { [id]: { ...we, ...patch } } } }
  }

// ── pillars ──────────────────────────────────────────────────────────────────

export const addPillar =
  ({ x, y, radiusUnits = 15 }: { x: number; y: number; radiusUnits?: number }): Action =>
  () => {
    const id = makeId('pillar')
    return {
      type: 'ADD_PILLAR',
      label: 'Add pillar',
      payload: { pillars: { [id]: { id, x: Math.round(x), y: Math.round(y), radiusUnits } } },
    }
  }

export const movePillar =
  (id: string, x: number, y: number): Action =>
  (plan) => {
    const pillar = plan.pillars[id]
    if (!pillar) return null
    return { type: 'MOVE_PILLAR', label: 'Move pillar', payload: { pillars: { [id]: { ...pillar, x: Math.round(x), y: Math.round(y) } } } }
  }

export const removePillar =
  (id: string): Action =>
  (plan) =>
    plan.pillars[id] ? { type: 'REMOVE_PILLAR', label: 'Remove pillar', payload: { pillars: { [id]: null } } } : null

// ── settings and seating rules ──────────────────────────────────────────────

export const updateSettings =
  (patch: Partial<Settings>): Action =>
  (plan) => {
    const keys = Object.keys(patch) as Array<keyof Settings>
    if (keys.every((k) => plan.settings[k] === patch[k])) return null
    return { type: 'UPDATE_SETTINGS', label: 'Change settings', payload: { settings: patch } }
  }

/** The rule already made about these two, in either order. */
export const ruleFor = (constraints: Constraint[], a: string, b: string): Constraint | undefined =>
  constraints.find(({ guestIds: [x, y] }) => (x === a && y === b) || (x === b && y === a))

// One rule to a pair, and never about someone and themselves: a second rule
// for a pair — the same again, or its opposite — only adds a warning that
// cannot be cleared (ux-audit #G21).
export const addConstraint =
  (c: Pick<Constraint, 'kind' | 'guestIds'> & Partial<Pick<Constraint, 'note'>>): Action =>
  (plan) => {
    const [a, b] = c.guestIds
    if (a === b || ruleFor(plan.constraints, a, b)) return null
    const cst: Constraint = { id: makeId('cst'), note: '', ...c }
    return {
      type: 'ADD_CONSTRAINT',
      label: 'Add seating rule',
      payload: { constraints: [...plan.constraints, cst] },
      meta: { newConstraintId: cst.id },
    }
  }

export const removeConstraint =
  (id: string): Action =>
  (plan) => {
    if (!plan.constraints.some((c) => c.id === id)) return null
    return {
      type: 'REMOVE_CONSTRAINT',
      label: 'Remove seating rule',
      payload: { constraints: plan.constraints.filter((c) => c.id !== id) },
    }
  }

/** Every action, by name — the store binds each one to a dispatcher. */
export const actionCreators = {
  addTable,
  createCustomTable,
  setPerSideSeats,
  removeTable,
  duplicateTable,
  moveTable,
  renameTable,
  changeCapacity,
  changeTableType,
  setDesignation,
  setTableColour,
  rotateTable,
  resizeTable,
  saveTablePreset,
  deleteTablePreset,
  calibrate,
  setRoomSizeUnits,
  setSeatMode,
  clearTable,
  addGuest,
  updateGuest,
  removeGuest,
  removeGuests,
  assignGuest,
  swapSeatGuests,
  unassignGuest,
  assignGroupToTable,
  createGroup,
  createEmptyGroup,
  dissolveGroup,
  renameGroup,
  recolourGroup,
  addToGroup,
  mergeGroups,
  removeFromGroup,
  createSubgroup,
  renameSubgroup,
  recolourSubgroup,
  dissolveSubgroup,
  addToSubgroup,
  removeFromSubgroup,
  assignSubgroupToTable,
  createFamily,
  renameFamily,
  recolourFamily,
  dissolveFamily,
  addToFamily,
  removeFromFamily,
  assignFamilyToTable,
  addZone,
  removeZone,
  moveZone,
  resizeZone,
  renameZone,
  reshapeZone,
  addSpace,
  removeSpace,
  renameSpace,
  recolourSpace,
  resizeSpace,
  editRoom,
  joinSpaces,
  addWallElement,
  removeWallElement,
  updateWallElement,
  addPillar,
  movePillar,
  removePillar,
  updateSettings,
  addConstraint,
  removeConstraint,
}

export type ActionCreators = typeof actionCreators
