import { beforeEach, describe, expect, test } from 'vitest'
import { newGuest } from '@/lib/model/factories'
import { addConstraint, addToFamily, createFamily, createGroup, dissolveGroup, removeConstraint, removeFromFamily } from './actions'
import { applyPatch } from './patch'
import { emptyPlan } from './plan'
import type { Action, Guest, Plan } from './types'

/**
 * Groups, families and seating rules, through Seating's own commands. Each is
 * recorded twice — on the group and on the guest — and a rule names a pair.
 */

const guest = (id: string, firstName: string): Guest =>
  ({ ...newGuest({ id, firstName, rsvpStatus: 'confirmed' }), fullName: firstName, assignedSeatId: null }) as Guest

/** The plan after `action`, and what its command said about itself. */
function step(plan: Plan, action: Action): [Plan, Record<string, unknown>] {
  const command = action(plan)
  return command ? [{ ...plan, ...applyPatch(plan, command.payload) }, command.meta ?? {}] : [plan, {}]
}
const run = (plan: Plan, ...actions: Action[]) => actions.reduce((p, a) => step(p, a)[0], plan)

let plan: Plan

beforeEach(() => {
  plan = { ...emptyPlan(), guests: { g1: guest('g1', 'Charis'), g2: guest('g2', 'Alexander'), g3: guest('g3', 'Eleanor') } }
})

test('dissolving a group lets its members go rather than deleting them', () => {
  const [grouped, meta] = step(plan, createGroup(['g1']))
  const groupId = meta.newGroupId as string
  expect(grouped.guests.g1.groupId).toBe(groupId)

  const next = run(grouped, dissolveGroup(groupId))
  expect(Object.keys(next.guests)).toHaveLength(3)
  expect(next.guests.g1.groupId).toBeNull()
})

test('a family records its members on both sides', () => {
  const [withFamily, meta] = step(plan, createFamily())
  const familyId = meta.newFamilyId as string

  let next = run(withFamily, addToFamily(familyId, 'g1'))
  expect(next.families[familyId].memberIds).toEqual(['g1'])
  expect(next.guests.g1.familyId).toBe(familyId)

  next = run(next, removeFromFamily('g1'))
  expect(next.families[familyId]?.memberIds ?? []).toEqual([])
  expect(next.guests.g1.familyId).toBeNull()
})

// A second rule for a pair — the same one again, or its opposite — only ever
// adds a warning that cannot be cleared.
test('a pair with a rule cannot be given another, in either order', () => {
  const next = run(
    plan,
    addConstraint({ kind: 'apart', guestIds: ['g1', 'g2'] }),
    addConstraint({ kind: 'together', guestIds: ['g2', 'g1'] }),
    addConstraint({ kind: 'apart', guestIds: ['g1', 'g2'] }),
  )
  expect(next.constraints.map((c) => c.kind)).toEqual(['apart'])
})

test('a rule about someone and themselves is refused', () => {
  expect(run(plan, addConstraint({ kind: 'apart', guestIds: ['g1', 'g1'] })).constraints).toHaveLength(0)
})

test('removing a rule removes only that rule', () => {
  const next = run(
    plan,
    addConstraint({ kind: 'apart', guestIds: ['g1', 'g2'] }),
    addConstraint({ kind: 'together', guestIds: ['g1', 'g3'] }),
  )
  expect(run(next, removeConstraint(next.constraints[0].id)).constraints.map((c) => c.kind)).toEqual(['together'])
})

// A plus-one goes where their guest goes. Someone deliberately put in another
// family stays where they were put.
describe('a plus-one and families', () => {
  const withPlusOne = (): Plan => ({
    ...plan,
    guests: { ...plan.guests, p1: { ...guest('p1', 'Plus One'), plusOneOf: 'g1' } },
  })

  test('follows their guest into a family', () => {
    const [withFamily, meta] = step(withPlusOne(), createFamily())
    const familyId = meta.newFamilyId as string
    const next = run(withFamily, addToFamily(familyId, 'g1'))
    expect(next.guests.p1.familyId).toBe(familyId)
    expect(next.families[familyId].memberIds).toEqual(['g1', 'p1'])
  })

  test('follows their guest from one family to another', () => {
    const [one, m1] = step(withPlusOne(), createFamily())
    const [two, m2] = step(run(one, addToFamily(m1.newFamilyId as string, 'g1')), createFamily())
    const next = run(two, addToFamily(m2.newFamilyId as string, 'g1'))
    expect(next.guests.p1.familyId).toBe(m2.newFamilyId)
    expect(next.families[m1.newFamilyId as string].memberIds).toEqual([])
  })

  test('stays in a different family someone put them in', () => {
    const [one, m1] = step(withPlusOne(), createFamily())
    const [two, m2] = step(run(one, addToFamily(m1.newFamilyId as string, 'p1')), createFamily())
    const next = run(two, addToFamily(m2.newFamilyId as string, 'g1'))
    expect(next.guests.p1.familyId).toBe(m1.newFamilyId)
    expect(next.families[m2.newFamilyId as string].memberIds).toEqual(['g1'])
  })

  test('leaves the family with their guest', () => {
    const [withFamily, meta] = step(withPlusOne(), createFamily())
    const familyId = meta.newFamilyId as string
    const next = run(withFamily, addToFamily(familyId, 'g1'), addToFamily(familyId, 'p1'), removeFromFamily('g1'))
    expect(next.guests.p1.familyId).toBeNull()
    expect(next.families[familyId].memberIds).toEqual([])
  })
})
