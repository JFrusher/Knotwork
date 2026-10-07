import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './useStore'
import { useKnotworkStore } from '@/lib/store/useKnotworkStore'
import { openPlan } from '../test/openPlan'
import { newGuest } from '@/lib/model/factories'
import type { Guest } from './types'

const guest = (id: string, lastName: string, where: Partial<Guest> = {}): Guest =>
  ({ ...newGuest({ id, firstName: id, lastName, rsvpStatus: 'confirmed' }), fullName: `${id} ${lastName}`, assignedSeatId: null, ...where }) as Guest

const s = () => useStore.getState()
const undo = () => useKnotworkStore.getState().undo()
const ids = ['g1', 'g2', 'g3']

beforeEach(() => {
  openPlan({
    guests: {
      g1: guest('g1', 'Okafor', { groupId: 'grp', subgroupId: 'sub' }),
      g2: guest('g2', 'Okafor', { groupId: 'grp', subgroupId: 'sub' }),
      g3: guest('g3', 'Okafor', { groupId: 'grp', subgroupId: 'sub' }),
      g4: guest('g4', 'Lind'),
    },
    groups: { grp: { id: 'grp', name: 'Work', colour: '#000', memberIds: ['g1', 'g2', 'g3'] }, other: { id: 'other', name: 'School', colour: '#111', memberIds: [] } },
    subgroups: { sub: { id: 'sub', name: 'Analysts', colour: '#000', parentGroupId: 'grp', memberIds: ['g1', 'g2', 'g3'] } },
  })
})

describe('acting on several selected guests at once', () => {
  it('seats them all at one table, as one step', () => {
    const table = s().addTable({ type: 'round', x: 0, y: 0 })!.meta!.newTableId as string
    s().seatGuests(ids, table)
    expect(ids.map((id) => s().guests[id].assignedTableId)).toEqual([table, table, table])
    undo()
    expect(ids.map((id) => s().guests[id].assignedTableId)).toEqual([null, null, null])
  })

  it('makes them a family, in the subgroup they share and named for the surname they share, as one step', () => {
    const id = s().familyFrom(ids)!.meta!.newFamilyId as string
    const family = s().families[id]
    expect(family).toMatchObject({ name: 'Okafor', parentSubgroupId: 'sub', parentGroupId: 'grp' })
    expect(family.memberIds).toEqual(ids)
    expect(ids.map((g) => s().guests[g].familyId)).toEqual([id, id, id])
    undo()
    expect(s().families[id]).toBeUndefined()
    expect(ids.map((g) => s().guests[g].familyId ?? null)).toEqual([null, null, null])
  })

  it('adds them to a group, as one step', () => {
    s().addGuestsToGroup('other', ['g1', 'g4'])
    expect(s().groups.other.memberIds).toEqual(['g1', 'g4'])
    expect([s().guests.g1.groupId, s().guests.g4.groupId]).toEqual(['other', 'other'])
    undo()
    expect(s().groups.other.memberIds).toEqual([])
    expect(s().guests.g1.groupId).toBe('grp')
  })
})
