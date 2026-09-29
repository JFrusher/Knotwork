import { expect, test } from 'vitest'
import { newTable } from '@/lib/model/factories'
import { getAdaptedSeatsForDrag, getTableGeometry } from './seatPositions'

/** Where the chairs go: around a table, and out of a neighbour's way. */

test("a round table's seats sit outside its edge, evenly spaced", () => {
  const geometry = getTableGeometry(newTable({ type: 'round', capacity: 8 }))
  expect(geometry.seats).toHaveLength(8)
  const radii = geometry.seats.map((s) => Math.hypot(s.x, s.y))
  for (const r of radii) expect(r).toBeGreaterThan(geometry.radius)
  expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(1e-9)
})

test('a top table seats everyone on one side, facing the room', () => {
  const table = newTable({ type: 'top-table', capacity: 8 })
  const geometry = getTableGeometry(table)
  expect(geometry.seats).toHaveLength(8)
  for (const seat of geometry.seats) expect(seat.y).toBeGreaterThan(0)
})

test('chairs move off an edge a neighbour has crowded, and nobody is lost', () => {
  const banquet = newTable({ type: 'banquet', capacity: 16, x: 0, y: 0 })
  const geometry = getTableGeometry(banquet)
  const adapted = getAdaptedSeatsForDrag(banquet, 0.7, [
    { cx: 0, cy: -geometry.height / 2 - 10, hw: geometry.width / 2, hh: 20 },
  ])
  expect(adapted).not.toBeNull()
  expect((adapted!.patch as { perSideSeats: { top: number } }).perSideSeats.top).toBe(0)
  expect(adapted!.seats).toHaveLength(16)
})

test('a round table crowded on one side seats everyone on the free arc', () => {
  const round = newTable({ type: 'round', capacity: 8, x: 0, y: 0 })
  const adapted = getAdaptedSeatsForDrag(round, 0.7, [{ cx: 0, cy: -70, hw: 60, hh: 20 }])
  expect(adapted).not.toBeNull()
  expect(adapted!.seats).toHaveLength(8)
  expect(adapted!.seats.every((s) => s.y > -70)).toBe(true)
})

test('a table with nothing near it keeps the seating it has', () => {
  expect(getAdaptedSeatsForDrag(newTable({ type: 'round', x: 300, y: 300 }), 0.7, [])).toBeNull()
})
