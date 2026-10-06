import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import GuestInspector from './GuestInspector'
import { openPlan } from '../../test/openPlan'
import { newGuest } from '@/lib/model/factories'
import type { Guest } from '../../store/types'

const guest = (id: string, where: Partial<Guest>): Guest =>
  ({ ...newGuest({ id, firstName: 'Ada', lastName: 'Okafor', rsvpStatus: 'confirmed' }), fullName: 'Ada Okafor', assignedSeatId: null, ...where }) as Guest

describe('GuestInspector', () => {
  it("shows the guest's subgroup and family, which only the sidebar tree showed", () => {
    openPlan({
      guests: { g1: guest('g1', { groupId: 'grp', subgroupId: 'sub', familyId: 'fam' }) },
      groups: { grp: { id: 'grp', name: 'Work', colour: '#000', memberIds: ['g1'] } },
      subgroups: { sub: { id: 'sub', name: 'Analysts', colour: '#000', parentGroupId: 'grp', memberIds: ['g1'] } },
      families: { fam: { id: 'fam', name: 'Okafor', colour: '#000', parentGroupId: null, parentSubgroupId: 'sub', memberIds: ['g1'] } },
    })
    render(<GuestInspector guestId="g1" />)
    expect(screen.getByRole('group', { name: 'Subgroup' })).toHaveTextContent('Analysts')
    expect(screen.getByRole('group', { name: 'Family' })).toHaveTextContent('Okafor')
  })

  it('shows neither for a guest in no subgroup or family', () => {
    openPlan({ guests: { g1: guest('g1', {}) } })
    render(<GuestInspector guestId="g1" />)
    expect(screen.queryByRole('group', { name: 'Subgroup' })).toBeNull()
    expect(screen.queryByRole('group', { name: 'Family' })).toBeNull()
  })
})
