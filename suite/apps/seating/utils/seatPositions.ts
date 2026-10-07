import type { PerSideSeats, SizeUnits, Table } from '../store/types'
import { getTableType, type TableShape, type TableTypeDef } from './tableTypes'

export interface Seat {
  x: number
  y: number
}

export interface TableGeometry {
  shape: TableShape
  width: number
  height: number
  radius: number
  /** A half-circle's centre, below its top edge. */
  cy?: number
  rounded?: boolean
  seats: Seat[]
}

/** What the geometry is read from: a table, or the start of one. */
export type TableShapeSource = Pick<Table, 'type' | 'capacity'> & {
  sizeUnits?: SizeUnits
  perSideSeats?: PerSideSeats | null
  seatArcRange?: { start: number; total: number } | null
}

/** A neighbour's box, centre and half-extents, for moving chairs out of its way. */
export interface NeighbourBox {
  id?: string
  cx: number
  cy: number
  hw: number
  hh: number
}

export interface AdaptedSeats {
  seats: Seat[]
  /** The table fields to commit on drop. */
  patch: { perSideSeats: PerSideSeats } | { seatArcRange: { start: number; total: number } }
}

type Side = keyof PerSideSeats

/**
 * Table geometry + seat placement. Returns, for a given table, the bounding
 * box of its shape (canvas px, centred on the table's x/y) and the position of
 * every seat relative to the centre.
 *
 *   circle      → seats evenly around the circumference (polar)
 *   half-circle → seats fanned along the curved (top) edge
 *   rect        → seats distributed along the configured edges (or per-side)
 *
 * Seat order matches assignedGuestIds indices for seat-level tables.
 *
 * Footprint sizing has two modes:
 *   - Legacy (no `table.sizeUnits`): size derived from the type preset +
 *     capacity, exactly as before — keeps old plans and tests pixel-identical.
 *   - Real-units (`table.sizeUnits` present, cm): size = cm × pixelsPerUnit,
 *     clamped up to the minimum that fits the seats so they never overlap.
 * Rotation is intentionally NOT applied here — it is a presentational CSS
 * transform on the table node, so local seat coordinates stay rotation-free
 * and @dnd-kit drop targets rotate with the DOM for free.
 */
const SEAT_PITCH = 30 // spacing between seat centres along an edge
export const SEAT_OFFSET = 19 // distance from table edge to seat centre
export const SEAT_RADIUS = 14 // seat slot radius (px)

// Locked default scale: pixels per centimetre. Chosen so legacy plans (whose
// sizes were authored in these px) read as realistic real-world dimensions
// (a default round ≈ 1.5 m). NEVER recompute this for existing plans — changing
// it would rescale every stored layout. New plans may override via calibration.
export const DEFAULT_PPU = 0.7
// Standard banquet chair footprint diameter (cm), used for always-on chair nubs.
export const DEFAULT_CHAIR_CM = 45

// ── seat-count distribution for rectangles ──────────────────────────────────

/** Split a capacity across rectangle edges according to the preset's layout. */
export function sidesFromLayout(cap: number, def: TableTypeDef): PerSideSeats {
  const layout = def.seatLayout
  let top = 0
  let bottom = 0
  let left = 0
  let right = 0
  if (layout === 'one-side') {
    bottom = cap
  } else if (layout === 'long-sides') {
    top = Math.ceil(cap / 2)
    bottom = Math.floor(cap / 2)
  } else {
    // perimeter — put one seat on each short end when there's room
    const ends = cap >= 6 ? 2 : 0
    left = ends ? 1 : 0
    right = ends ? 1 : 0
    const rem = cap - ends
    top = Math.ceil(rem / 2)
    bottom = Math.floor(rem / 2)
  }
  return { top, bottom, left, right }
}

/** Minimum px box that fits the given per-side seat counts (and preset min). */
function minRectSize(sides: PerSideSeats, def: TableTypeDef): { width: number; height: number } {
  const perLong = Math.max(sides.top, sides.bottom, 1)
  const perShort = Math.max(sides.left, sides.right, 0)
  return {
    width: Math.max(def.width || 0, perLong * SEAT_PITCH + 24),
    height: Math.max(def.height || 0, perShort * SEAT_PITCH + 24),
  }
}

/** Minimum radius that fits `cap` seats around a circle (and preset baseRadius). */
function minRoundRadius(cap: number, def: TableTypeDef): number {
  return Math.max(def.baseRadius || 0, (cap * SEAT_PITCH) / (2 * Math.PI))
}

function minHalfRadius(cap: number, def: TableTypeDef): number {
  return Math.max(def.baseRadius || 0, (cap * SEAT_PITCH) / Math.PI)
}

// ── seat-fit-only minimums (real-units path) ────────────────────────────────
// When a table carries explicit `sizeUnits`, the only hard floor is "seats must
// not overlap" — the preset's cosmetic size (def.width/height/baseRadius) is
// NOT a floor, so the user can shrink a table right down to its seating. A small
// absolute floor keeps seatless / tiny tables visible and clickable.
const SEAT_FIT_FLOOR = 16

/** Smallest radius that fits `cap` seats around a circle (seats only). */
function seatFitRadius(cap: number): number {
  return Math.max(SEAT_FIT_FLOOR, (cap * SEAT_PITCH) / (2 * Math.PI))
}

function seatFitHalfRadius(cap: number): number {
  return Math.max(SEAT_FIT_FLOOR, (cap * SEAT_PITCH) / Math.PI)
}

/** Smallest px box that fits the given per-side seat counts (seats only). */
function seatFitRect(sides: PerSideSeats): { width: number; height: number } {
  const perLong = Math.max(sides.top, sides.bottom, 1)
  const perShort = Math.max(sides.left, sides.right, 0)
  return {
    width: Math.max(SEAT_FIT_FLOOR, perLong * SEAT_PITCH + 24),
    height: Math.max(SEAT_FIT_FLOOR, perShort * SEAT_PITCH + 24),
  }
}

// ── seat coordinate emitters (take explicit px geometry) ────────────────────

// When startAngle/arcTotal are provided, distribute seats across that arc
// (half-step centering keeps them evenly spaced within the available arc).
// Defaults reproduce the original full-circle behaviour exactly.
function roundSeatsAt(cap: number, radius: number, startAngle?: number, arcTotal?: number): Seat[] {
  const start = startAngle ?? -Math.PI / 2
  const arc = arcTotal ?? 2 * Math.PI
  const partial = arcTotal != null
  const seatR = radius + SEAT_OFFSET
  const seats: Seat[] = []
  for (let i = 0; i < cap; i++) {
    const angle = partial
      ? start + (i + 0.5) * (arc / cap)
      : start + (i * arc) / cap
    seats.push({ x: Math.cos(angle) * seatR, y: Math.sin(angle) * seatR })
  }
  return seats
}

function halfCircleSeatsAt(cap: number, radius: number, cy: number): Seat[] {
  const seatR = radius + SEAT_OFFSET
  const seats: Seat[] = []
  for (let i = 0; i < cap; i++) {
    const t = (i + 0.5) / cap
    const angle = Math.PI - t * Math.PI // π (left) → 0 (right) across the top
    seats.push({ x: Math.cos(angle) * seatR, y: cy - Math.sin(angle) * seatR })
  }
  return seats
}

// Matches the seat order rectSeatsFromSides lays out in, and therefore the
// order assignedGuestIds indices are grouped in for a seat-mode rect table.
const SIDE_ORDER = ['top', 'bottom', 'left', 'right'] as const

/**
 * Re-slice a seat-mode rect table's assignedGuestIds when its per-side seat
 * counts change, side by side — instead of truncating the flat array by raw
 * index against the new total capacity, which has no idea which side the
 * user actually resized and can evict a guest on an untouched side while the
 * side that shrank sails through even though it had a free seat to give up.
 *
 * A side that grows keeps its guests' positions and gets empty seats
 * appended. A side that shrinks drops its own empty seats first; a guest is
 * only bumped into the returned overflow when every remaining seat on that
 * specific side is already taken. A side whose count didn't change is left
 * completely untouched.
 */
export function remapSeatsForSides(
  guestIds: Array<string | null> = [],
  oldSides: Partial<PerSideSeats> | null,
  newSides: Partial<PerSideSeats> | null
): Array<string | null> {
  let cursor = 0
  const nextSegments: Array<Array<string | null>> = []
  const overflow: string[] = []

  for (const side of SIDE_ORDER) {
    const oldCount = Math.max(0, Math.round(oldSides?.[side] || 0))
    const newCount = Math.max(0, Math.round(newSides?.[side] || 0))
    const raw = guestIds.slice(cursor, cursor + oldCount)
    const segment = Array.from({ length: oldCount }, (_, i) => raw[i] ?? null)
    cursor += oldCount

    if (newCount >= oldCount) {
      nextSegments.push([...segment, ...new Array(newCount - oldCount).fill(null)])
      continue
    }
    const occupied = segment.filter((id): id is string => Boolean(id))
    if (occupied.length <= newCount) {
      nextSegments.push([...occupied, ...new Array(newCount - occupied.length).fill(null)])
    } else {
      nextSegments.push(occupied.slice(0, newCount))
      overflow.push(...occupied.slice(newCount))
    }
  }

  // Anything beyond the last known side (e.g. the array already carried
  // overflow from an earlier resize) rides along rather than being dropped.
  if (cursor < guestIds.length) overflow.push(...guestIds.slice(cursor).filter((id): id is string => Boolean(id)))

  const out = nextSegments.flat()
  return overflow.length ? [...out, ...overflow] : out
}

/**
 * Place seats on the edges of a rect of the given px size, in the order
 * top → bottom → left → right (matching assignedGuestIds indices).
 */
export function rectSeatsFromSides(sides: Partial<PerSideSeats> | null, width: number, height: number): Seat[] {
  const { top = 0, bottom = 0, left = 0, right = 0 } = sides || {}
  const seats: Seat[] = []
  const row = (n: number, edge: Side) => {
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n
      if (edge === 'top') seats.push({ x: -width / 2 + t * width, y: -height / 2 - SEAT_OFFSET })
      else if (edge === 'bottom')
        seats.push({ x: -width / 2 + t * width, y: height / 2 + SEAT_OFFSET })
      else if (edge === 'left')
        seats.push({ x: -width / 2 - SEAT_OFFSET, y: -height / 2 + t * height })
      else seats.push({ x: width / 2 + SEAT_OFFSET, y: -height / 2 + t * height })
    }
  }
  row(top, 'top')
  row(bottom, 'bottom')
  row(left, 'left')
  row(right, 'right')
  return seats
}

// ── main entry ──────────────────────────────────────────────────────────────

export function getTableGeometry(table: TableShapeSource, pixelsPerUnit = DEFAULT_PPU): TableGeometry {
  const def = getTableType(table.type)
  const cap = Math.max(1, table.capacity || def.defaultCapacity)
  const shape = table.sizeUnits?.shape || def.shape
  const ppu = pixelsPerUnit || DEFAULT_PPU
  const su = table.sizeUnits
  // The footprint in centimetres, of whichever kind the size is.
  const diameter = su && 'diameter' in su ? su.diameter : null
  const box = su && 'width' in su ? su : null

  if (shape === 'circle') {
    const noSeats = def.seatLayout === 'none'
    const minR = noSeats ? def.baseRadius || 0 : minRoundRadius(cap, def)
    // Real-units: clamp only to the seat-fit minimum so tables can shrink below
    // the cosmetic preset size. Legacy (no sizeUnits): keep the preset min.
    const seatFloor = noSeats ? SEAT_FIT_FLOOR : seatFitRadius(cap)
    const radius = diameter !== null ? Math.max((diameter * ppu) / 2, seatFloor) : minR
    const arc = table.seatArcRange || null
    return {
      shape: 'circle',
      width: radius * 2,
      height: radius * 2,
      radius,
      seats: noSeats ? [] : roundSeatsAt(cap, radius, arc?.start, arc?.total),
    }
  }

  if (shape === 'half-circle') {
    const minR = minHalfRadius(cap, def)
    const radius = diameter !== null ? Math.max((diameter * ppu) / 2, seatFitHalfRadius(cap)) : minR
    const cy = radius / 2
    return {
      shape: 'half-circle',
      width: radius * 2,
      height: radius,
      radius,
      cy,
      seats: halfCircleSeatsAt(cap, radius, cy),
    }
  }

  // rect — either per-side custom counts or the preset layout distribution
  const sides = table.perSideSeats || sidesFromLayout(cap, def)
  const min = minRectSize(sides, def)
  const fit = seatFitRect(sides)
  const width = su ? Math.max((box?.width || def.width || 0) * ppu, fit.width) : min.width
  const height = su ? Math.max((box?.height || def.height || 0) * ppu, fit.height) : min.height
  return {
    shape: 'rect',
    width,
    height,
    rounded: !!def.rounded,
    radius: 0,
    seats: rectSeatsFromSides(sides, width, height),
  }
}

/**
 * Derive real-world `sizeUnits` (cm) for a table from its current legacy
 * (preset + capacity) geometry. Used to migrate older plans so the first render
 * is pixel-identical: `sizeUnits × ppu` reproduces the legacy px footprint.
 */
export function deriveSizeUnits(table: TableShapeSource, pixelsPerUnit = DEFAULT_PPU): SizeUnits {
  const ppu = pixelsPerUnit || DEFAULT_PPU
  const g = getTableGeometry({ ...table, sizeUnits: undefined, perSideSeats: null }, ppu)
  const r2 = (n: number) => Math.round((n / ppu) * 100) / 100
  if (g.shape === 'circle' || g.shape === 'half-circle') {
    return { shape: g.shape, diameter: r2(g.radius * 2) }
  }
  return { shape: 'rect', width: r2(g.width), height: r2(g.height) }
}

/** Fill-level colour for the capacity ring: green → amber → red. */
export function fillColour(ratio: number): string {
  if (ratio > 1) return 'var(--danger)'
  if (ratio >= 0.85) return 'var(--warn)'
  return 'var(--ok)'
}

// ── adaptive seat collision ──────────────────────────────────────────────────
// Gap (px) between a table edge and a neighbour that triggers chair relocation.
const CHAIR_BUFFER = SEAT_OFFSET * 2 + 8

/**
 * Given a table at its candidate position and an array of neighbour bounding
 * boxes (from dragCtx), returns { seats, patch } if any chairs would collide
 * with a neighbour, or null when no adaptation is needed.
 *
 *   patch — the table fields to commit on drop:
 *           { perSideSeats } for rects, { seatArcRange } for circles.
 */
export function getAdaptedSeatsForDrag(
  table: TableShapeSource & Pick<Table, 'x' | 'y'>,
  ppu: number,
  neighbourBoxes: NeighbourBox[] | null | undefined
): AdaptedSeats | null {
  if (!neighbourBoxes?.length) return null
  const p = ppu || DEFAULT_PPU
  const geom = getTableGeometry(table, p)
  if (geom.shape === 'rect') return _adaptRect(table, geom, neighbourBoxes)
  if (geom.shape === 'circle') return _adaptCircle(table, geom, neighbourBoxes)
  return null
}

function _adaptRect(
  table: TableShapeSource & Pick<Table, 'x' | 'y'>,
  geom: TableGeometry,
  neighbours: NeighbourBox[]
): AdaptedSeats | null {
  const ax = table.x, ay = table.y
  const aw = geom.width / 2, ah = geom.height / 2
  const blocked: Record<Side, boolean> = { top: false, bottom: false, left: false, right: false }

  for (const n of neighbours) {
    // Use <= / >= so exactly-touching edges (gap === 0) count as overlapping.
    const xOverlap = ax - aw <= n.cx + n.hw && ax + aw >= n.cx - n.hw
    const yOverlap = ay - ah <= n.cy + n.hh && ay + ah >= n.cy - n.hh

    // Directionality is enforced by centre comparison (n.cy < ay means neighbour
    // is above this table), so the gap check no longer needs >= 0.  Removing
    // that guard lets already-adjacent or slightly-overlapping static neighbours
    // in a line still register as blocking, which is the correct behaviour.
    if (xOverlap) {
      if (n.cy < ay && (ay - ah) - (n.cy + n.hh) < CHAIR_BUFFER) blocked.top = true
      if (n.cy > ay && (n.cy - n.hh) - (ay + ah) < CHAIR_BUFFER) blocked.bottom = true
    }
    if (yOverlap) {
      if (n.cx < ax && (ax - aw) - (n.cx + n.hw) < CHAIR_BUFFER) blocked.left = true
      if (n.cx > ax && (n.cx - n.hw) - (ax + aw) < CHAIR_BUFFER) blocked.right = true
    }
  }

  if (!blocked.top && !blocked.bottom && !blocked.left && !blocked.right) return null

  const def = getTableType(table.type)
  const cap = Math.max(1, table.capacity || def.defaultCapacity)
  const origSides = table.perSideSeats || sidesFromLayout(cap, def)
  const adapted = { ...origSides }
  const freeSides: Side[] = []
  let displaced = 0

  for (const side of SIDE_ORDER) {
    if (blocked[side]) {
      displaced += adapted[side]
      adapted[side] = 0
    } else {
      freeSides.push(side)
    }
  }

  if (freeSides.length === 0 || displaced === 0) return null

  for (let i = 0; i < displaced; i++) {
    adapted[freeSides[i % freeSides.length]]++
  }

  return {
    seats: rectSeatsFromSides(adapted, geom.width, geom.height),
    patch: { perSideSeats: adapted },
  }
}

function _adaptCircle(
  table: TableShapeSource & Pick<Table, 'x' | 'y'>,
  geom: TableGeometry,
  neighbours: NeighbourBox[]
): AdaptedSeats | null {
  const ax = table.x, ay = table.y
  const r = geom.radius
  const cap = Math.max(1, table.capacity || 0)
  const TAU = 2 * Math.PI
  const blocks: Array<{ center: number; half: number }> = []

  for (const n of neighbours) {
    const dx = n.cx - ax, dy = n.cy - ay
    const dist = Math.hypot(dx, dy)
    const θ = Math.atan2(dy, dx)
    const βToA = θ + Math.PI
    const bHalf = n.hw * Math.abs(Math.cos(βToA)) + n.hh * Math.abs(Math.sin(βToA))
    const gap = dist - r - bHalf

    if (gap < CHAIR_BUFFER) {
      const perpHalf = n.hw * Math.abs(Math.sin(θ)) + n.hh * Math.abs(Math.cos(θ))
      const halfAngle = Math.atan2(perpHalf + SEAT_OFFSET + SEAT_RADIUS, Math.max(dist - r, 1))
      blocks.push({ center: θ, half: halfAngle })
    }
  }

  if (!blocks.length) return null

  // Convert each blocking arc to an interval in [0, TAU), splitting any that
  // cross the 0/TAU boundary into two pieces so standard interval merge works.
  const norm = (a: number) => ((a % TAU) + TAU) % TAU
  const intervals: Array<[number, number]> = []
  for (const { center, half } of blocks) {
    const lo = norm(center - half)
    const hi = norm(center + half)
    if (lo <= hi) {
      intervals.push([lo, hi])
    } else {
      intervals.push([lo, TAU])
      intervals.push([0, hi])
    }
  }

  // Sort then merge overlapping intervals.
  intervals.sort((a, b) => a[0] - b[0])
  const merged: Array<[number, number]> = []
  for (const [lo, hi] of intervals) {
    if (merged.length && lo <= merged[merged.length - 1][1]) {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], hi)
    } else {
      merged.push([lo, hi])
    }
  }

  // Find the largest free arc between consecutive blocking intervals.
  // The last interval's gap wraps back to the first interval's start.
  let bestStart = 0
  let bestTotal = 0
  const m = merged.length
  for (let i = 0; i < m; i++) {
    const gapStart = merged[i][1]
    const gapEnd = i + 1 < m ? merged[i + 1][0] : merged[0][0] + TAU
    const gapLen = gapEnd - gapStart
    if (gapLen > bestTotal) {
      bestTotal = gapLen
      bestStart = gapStart
    }
  }

  if (bestTotal <= 0) return null

  const seatArcRange = { start: bestStart, total: bestTotal }
  return {
    seats: roundSeatsAt(cap, r, bestStart, bestTotal),
    patch: { seatArcRange },
  }
}
