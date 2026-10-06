import type { Guest, Join, Pillar, Plan, Space, Table, WallElement } from '../store/types'
import { getTableGeometry, DEFAULT_PPU, type Seat, type TableGeometry } from './seatPositions'

/** What the plan is drawn from: Seating's plan, or as much of it as there is. */
type FloorPlanSource = Partial<Pick<Plan, 'guests' | 'tables' | 'zones' | 'wallElements' | 'pillars'>> & {
  settings?: Partial<Plan['settings']>
  room?: Partial<Plan['room']>
}

interface FloorPlanOptions {
  ppu?: number
  padPx?: number
}

/** A seat in world coordinates, with its outward direction and who sits there. */
interface PlacedSeat {
  x: number
  y: number
  nx: number
  ny: number
  index: number
  table: Table
  guest: Guest | null
}

interface WallSeg {
  wallIndex: number
  x1: number
  y1: number
  x2: number
  y2: number
}

type Point = { x: number; y: number }

/** Wall segments for a space (absolute canvas coords). */
export function getWallSegs(sp: Space): WallSeg[] {
  if (sp.shape === 'polygon') {
    return sp.vertices.map((v, i) => {
      const nxt = sp.vertices[(i + 1) % sp.vertices.length]
      return { wallIndex: i, x1: sp.x + v.x, y1: sp.y + v.y, x2: sp.x + nxt.x, y2: sp.y + nxt.y }
    })
  }
  return [
    { wallIndex: 0, x1: sp.x, y1: sp.y, x2: sp.x + sp.width, y2: sp.y },
    { wallIndex: 1, x1: sp.x + sp.width, y1: sp.y, x2: sp.x + sp.width, y2: sp.y + sp.height },
    { wallIndex: 2, x1: sp.x + sp.width, y1: sp.y + sp.height, x2: sp.x, y2: sp.y + sp.height },
    { wallIndex: 3, x1: sp.x, y1: sp.y + sp.height, x2: sp.x, y2: sp.y },
  ]
}

// ── seats ───────────────────────────────────────────────────────────────────

/**
 * Which way is "away from the table" for one seat, in the table's own
 * coordinates.
 *
 * A round table pushes straight out from its centre. A rectangle pushes square
 * off the edge the seat sits on — taking the direction from the centre instead
 * would send an end seat's cell out diagonally and straight into its neighbour's,
 * costing the long tables the width they have least of.
 */
function seatNormal(seat: Seat, geom: TableGeometry): Point {
  if (geom.shape === 'rect') {
    if (Math.abs(seat.y) > geom.height / 2) return { x: 0, y: Math.sign(seat.y) }
    if (Math.abs(seat.x) > geom.width / 2) return { x: Math.sign(seat.x), y: 0 }
  }
  const cy = geom.shape === 'half-circle' ? (geom.cy ?? 0) : 0
  const len = Math.hypot(seat.x, seat.y - cy)
  return len < 1e-6 ? { x: 0, y: 1 } : { x: seat.x / len, y: (seat.y - cy) / len }
}

// ── layout ──────────────────────────────────────────────────────────────────

const spaceBox = (sp: Space): { minX: number; minY: number; maxX: number; maxY: number } =>
  sp.shape === 'polygon'
    ? {
        minX: Math.min(...sp.vertices.map((v) => sp.x + v.x)),
        minY: Math.min(...sp.vertices.map((v) => sp.y + v.y)),
        maxX: Math.max(...sp.vertices.map((v) => sp.x + v.x)),
        maxY: Math.max(...sp.vertices.map((v) => sp.y + v.y)),
      }
    : { minX: sp.x, minY: sp.y, maxX: sp.x + sp.width, maxY: sp.y + sp.height }

/**
 * The room as Stationery's floor plan draws it: the scale, every table's
 * geometry, the seat list in world (rotation-applied) coordinates, and the
 * drawing bounds. The same getTableGeometry the editor uses, so the printed
 * plan matches the screen.
 */
export function layoutFloorPlan(doc: FloorPlanSource, { ppu, padPx }: FloorPlanOptions = {}) {
  const settings = doc.settings || {}
  const scale = ppu || settings.pixelsPerUnit || DEFAULT_PPU
  const guests = doc.guests || {}
  const tables = Object.values(doc.tables || {})
  const zones = Object.values(doc.zones || {})
  const wallElements = Object.values(doc.wallElements || {}).filter((we): we is WallElement => Boolean(we))
  const pillars = Object.values(doc.pillars || {}).filter((p): p is Pillar => Boolean(p))
  const room: Partial<Plan['room']> = doc.room || {}
  const roomW = (room.widthUnits ? room.widthUnits * scale : room.width) || 1200
  const roomH = (room.heightUnits ? room.heightUnits * scale : room.height) || 900

  // Multi-room: render each floor space; fall back to a single rect for old docs.
  const spaces: Space[] =
    Array.isArray(room.spaces) && room.spaces.length
      ? room.spaces
      : [{ id: 'room', label: 'Room', shape: 'rect', x: 0, y: 0, width: roomW, height: roomH, backgroundColour: '#FAF8F5' }]
  const joins: Join[] = Array.isArray(room.joins) ? room.joins : []

  // Deliberately not seeded at the origin. A room drawn away from (0,0) would
  // otherwise drag all the empty ground back to it onto the printed sheet.
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const grow = (x1: number, y1: number, x2: number, y2: number) => {
    minX = Math.min(minX, x1)
    minY = Math.min(minY, y1)
    maxX = Math.max(maxX, x2)
    maxY = Math.max(maxY, y2)
  }
  spaces.forEach((sp) => {
    const b = spaceBox(sp)
    grow(b.minX, b.minY, b.maxX, b.maxY)
  })
  // Zones and pillars are frequently placed outside the room rect (a stage or
  // a marquee annexe); they must extend the bounds or they get clipped away.
  zones.forEach((z) => grow(z.x, z.y, z.x + z.width, z.y + z.height))
  pillars.forEach((p) => {
    const r = p.radiusUnits * scale
    grow(p.x - r, p.y - r, p.x + r, p.y + r)
  })

  const seats: PlacedSeat[] = []
  const geoms = tables.map((t) => {
    const g = getTableGeometry(t, scale)
    const rad = ((t.rotation || 0) * Math.PI) / 180
    const hw = g.width / 2 + 24
    const hh = g.height / 2 + 24
    const ex = Math.abs(hw * Math.cos(rad)) + Math.abs(hh * Math.sin(rad))
    const ey = Math.abs(hw * Math.sin(rad)) + Math.abs(hh * Math.cos(rad))
    grow(t.x - ex, t.y - ey, t.x + ex, t.y + ey)

    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const assigned = t.assignedGuestIds || []
    g.seats.forEach((s, i) => {
      const n = seatNormal(s, g)
      seats.push({
        x: t.x + s.x * cos - s.y * sin,
        y: t.y + s.x * sin + s.y * cos,
        nx: n.x * cos - n.y * sin,
        ny: n.x * sin + n.y * cos,
        index: i,
        table: t,
        guest: (assigned[i] && guests[assigned[i]]) || null,
      })
    })
    return { t, g }
  })

  // An empty plan still needs a page to draw on.
  if (!Number.isFinite(minX)) {
    minX = 0
    minY = 0
    maxX = roomW
    maxY = roomH
  }

  const pad = padPx ?? 32
  minX -= pad
  minY -= pad
  maxX += pad
  maxY += pad

  return {
    scale,
    spaces,
    joins,
    zones,
    wallElements,
    pillars,
    geoms,
    seats,
    minX,
    minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  }
}

