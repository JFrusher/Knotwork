import { describe, it, expect } from 'vitest'
import { layoutFloorPlan } from './floorPlanSvg'
import type { Guest, Space, Table } from '../store/types'

type FloorPlanSource = Parameters<typeof layoutFloorPlan>[0]

// Two 8-seat trestles side by side plus a rotated 4-seat top table, matching the
// shape of a real plan: rect tables with seats on the long sides only.
const trestle = (id: string, label: string, x: number, y: number, extra: Partial<Table> = {}) =>
  ({
  id,
  label,
  type: 'rect',
  x,
  y,
  rotation: 0,
  capacity: 8,
  seatMode: 'seat',
  perSideSeats: { top: 4, bottom: 4, left: 0, right: 0 },
  sizeUnits: { shape: 'rect', width: 365.76, height: 76.2 },
  assignedGuestIds: [],
  ...extra,
  }) as Table

const guest = (id: string, firstName: string, lastName: string) =>
  ({ id, firstName, lastName, fullName: `${firstName} ${lastName}` }) as Guest

function makeDoc(): FloorPlanSource {
  const guests: Record<string, Guest> = {}
  const ids: string[] = []
  const names = [
    ['Sam', 'Sparkes'],
    ['Jude', 'Silk'],
    ['Seren', 'Silk'],
    ['Emmanuel', 'Adu-Essah'],
    ['Elijah', 'Brown'],
    ['Katie', 'Sneddon'],
    ['Frankie', 'Hartland'],
    ['Jess', 'Mihaylova'],
    ['Ewan', 'Gadd-Chapman'],
    ['Georgina', 'Loveridge'],
    ['Kate', 'Seymour'],
    ['Lois', 'Steven'],
  ]
  names.forEach(([f, l], i) => {
    const id = `g${i}`
    guests[id] = guest(id, f, l)
    ids.push(id)
  })

  return {
    settings: { pixelsPerUnit: 0.7 },
    guests,
    tables: {
      t1: trestle('t1', 'Table 1', 140, 113, { assignedGuestIds: ids.slice(0, 8) }),
      // Deliberately short: seats 3 and 4 stay empty.
      t2: trestle('t2', 'Table 2', 396, 113, { assignedGuestIds: ids.slice(8, 10) }),
      t3: {
        ...trestle('t3', 'Table 3', 900, 300),
        type: 'top-table',
        rotation: 270,
        capacity: 2,
        perSideSeats: { top: 0, bottom: 2, left: 0, right: 0 },
        sizeUnits: { shape: 'rect', width: 300, height: 91.43 },
        assignedGuestIds: ids.slice(10, 12),
      },
    },
    // Sits at negative x, i.e. outside the room rect.
    zones: { z1: { id: 'z1', label: 'Stage', shape: 'rect', x: -103, y: 158, width: 103, height: 336 } },
    room: { spaces: [{ id: 'sp1', shape: 'rect', x: 0, y: 0, width: 1261, height: 629 }] },
  } as unknown as FloorPlanSource
}

describe('layoutFloorPlan', () => {
  it('includes zones that sit outside the room rect in the bounds', () => {
    const m = layoutFloorPlan(makeDoc())
    expect(m.minX).toBeLessThanOrEqual(-103)
  })

  it('does not drag the origin in when the room is drawn away from it', () => {
    const doc = makeDoc()
    doc.room!.spaces = [{ id: 'sp1', shape: 'rect', x: 600, y: 400, width: 500, height: 400 } as Space]
    doc.zones = {}
    doc.tables = {}
    const m = layoutFloorPlan(doc)
    expect(m.minX).toBeGreaterThan(0)
    expect(m.minY).toBeGreaterThan(0)
  })
})
