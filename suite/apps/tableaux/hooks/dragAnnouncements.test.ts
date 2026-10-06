import { expect, test } from 'vitest'
import { newGuest } from '@/lib/model/factories'
import { addTable } from '../store/actions'
import { applyPatch } from '../store/patch'
import { emptyPlan } from '../store/plan'
import type { Guest, Plan } from '../store/types'
import { dragAnnouncements } from './dragAnnouncements'

/** What a screen reader hears while a guest is dragged to a table: names, not ids. */

const raj = { ...newGuest({ id: 'g_bt9u4ks7', firstName: 'Raj', lastName: 'Sharma' }), fullName: 'Raj Sharma', assignedSeatId: null } as Guest

function planWithTable(): [Plan, string] {
  const base = { ...emptyPlan(), guests: { [raj.id]: raj } }
  const command = addTable({ type: 'round', x: 100, y: 100 })(base)!
  const plan = { ...base, ...applyPatch(base, command.payload) }
  return [plan, Object.keys(plan.tables)[0]!]
}

const item = (id: string, data: object) => ({ id, data: { current: data } }) as never

test('dropping a guest on a table is read out by name', () => {
  const [plan, tableId] = planWithTable()
  const say = dragAnnouncements(() => plan)
  const active = item(`guest_${raj.id}`, { type: 'guest', guestId: raj.id })
  const over = item(`table_${tableId}`, { type: 'table', tableId })

  const heard = [
    say.onDragStart({ active }),
    say.onDragOver({ active, over } as never),
    say.onDragEnd({ active, over } as never),
  ].join(' ')

  expect(heard).toContain('Raj Sharma')
  expect(heard).toContain(plan.tables[tableId]!.label)
  expect(heard).not.toMatch(/g_bt9u4ks7|tbl_|guest_|table_/)
})

test('a seat is read as its number at its table', () => {
  const [plan, tableId] = planWithTable()
  const say = dragAnnouncements(() => plan)
  const heard = say.onDragEnd({
    active: item(`guest_${raj.id}`, { type: 'guest', guestId: raj.id }),
    over: item(`seat_${tableId}_2`, { type: 'seat', tableId, index: 2 }),
  } as never)
  expect(heard).toBe(`Raj Sharma dropped on seat 3 at ${plan.tables[tableId]!.label}.`)
})
