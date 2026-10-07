import type { Table } from '../store/types'
import { DEFAULT_PPU, SEAT_RADIUS, getTableGeometry } from './seatPositions'

/**
 * Whether two tables, with their chairs, take up the same floor.
 *
 * Each table is its real shape — a circle as a circle, a rectangle turned by
 * its rotation, a half-circle as its arc — plus a circle for every chair, in
 * the room's own pixels. Two tables overlap when any piece of one meets any
 * piece of the other. Touching is not overlapping.
 */

type Pt = { x: number; y: number }
type Piece = { kind: 'circle'; c: Pt; r: number } | { kind: 'poly'; pts: Pt[] }

export type PlacedTable = Pick<Table, 'type' | 'capacity' | 'x' | 'y' | 'rotation' | 'sizeUnits' | 'perSideSeats' | 'seatArcRange'>

// Less than this is a rounding error, not two tables in each other's way.
const EPS = 0.5

/** Every piece of floor the table and its chairs cover. */
function footprint(table: PlacedTable, ppu: number, chairR: number): Piece[] {
  const g = getTableGeometry(table, ppu)
  const turn = ((table.rotation || 0) * Math.PI) / 180
  const cos = Math.cos(turn)
  const sin = Math.sin(turn)
  const place = (p: Pt): Pt => ({ x: table.x + p.x * cos - p.y * sin, y: table.y + p.x * sin + p.y * cos })

  let body: Piece
  if (g.shape === 'circle') {
    body = { kind: 'circle', c: place({ x: 0, y: 0 }), r: g.radius }
  } else if (g.shape === 'half-circle') {
    // The arc's centre sits `cy` below the middle of the node, curving upward.
    const cy = g.cy ?? 0
    const arc = Array.from({ length: 17 }, (_, i) => {
      const a = Math.PI + (i / 16) * Math.PI
      return place({ x: g.radius * Math.cos(a), y: cy + g.radius * Math.sin(a) })
    })
    body = { kind: 'poly', pts: arc }
  } else {
    const w = g.width / 2
    const h = g.height / 2
    body = { kind: 'poly', pts: [{ x: -w, y: -h }, { x: w, y: -h }, { x: w, y: h }, { x: -w, y: h }].map(place) }
  }
  return [body, ...g.seats.map((s): Piece => ({ kind: 'circle', c: place(s), r: chairR }))]
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy })
}

function inside(p: Pt, pts: Pt[]): boolean {
  let hit = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]
    const b = pts[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit
  }
  return hit
}

/** Separating axes: two convex shapes are apart if some edge's normal separates them. */
function polysMeet(a: Pt[], b: Pt[]): boolean {
  for (const pts of [a, b]) {
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]
      const q = pts[(i + 1) % pts.length]
      const n = { x: q.y - p.y, y: p.x - q.x }
      const len = Math.hypot(n.x, n.y)
      if (len === 0) continue
      const span = (s: Pt[]) => s.map((v) => (v.x * n.x + v.y * n.y) / len)
      const sa = span(a)
      const sb = span(b)
      if (Math.max(...sa) - EPS <= Math.min(...sb) || Math.max(...sb) - EPS <= Math.min(...sa)) return false
    }
  }
  return true
}

function circlePolyMeet(c: Pt, r: number, pts: Pt[]): boolean {
  if (inside(c, pts)) return true
  return pts.some((p, i) => distToSegment(c, p, pts[(i + 1) % pts.length]) < r - EPS)
}

function piecesMeet(a: Piece, b: Piece): boolean {
  if (a.kind === 'circle') return b.kind === 'circle' ? dist(a.c, b.c) < a.r + b.r - EPS : circlePolyMeet(a.c, a.r, b.pts)
  return b.kind === 'circle' ? circlePolyMeet(b.c, b.r, a.pts) : polysMeet(a.pts, b.pts)
}

/** Pairs of tables that overlap, each pair once, in the order given. */
export function overlappingTables<T extends PlacedTable>(
  tables: T[],
  settings: { pixelsPerUnit?: number; chairSizeUnits?: number } = {}
): [T, T][] {
  const ppu = settings.pixelsPerUnit || DEFAULT_PPU
  // As the canvas draws a chair: never smaller than its slot.
  const chairR = Math.max(SEAT_RADIUS, ((settings.chairSizeUnits || 45) * ppu) / 2)
  const prints = tables.map((t) => footprint(t, ppu, chairR))
  const out: [T, T][] = []
  for (let i = 0; i < tables.length; i++) {
    for (let j = i + 1; j < tables.length; j++) {
      if (prints[i].some((a) => prints[j].some((b) => piecesMeet(a, b)))) out.push([tables[i], tables[j]])
    }
  }
  return out
}
