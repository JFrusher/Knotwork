import { describe, it, expect, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import GuestPanel from './GuestPanel'
import { useStore } from '../../store/useStore'
import { openPlan } from '../../test/openPlan'
import { newGuest } from '@/lib/model/factories'
import type { Guest } from '../../store/types'

const guest = (id: string, fullName: string, where: Partial<Guest>): Guest =>
  ({ ...newGuest({ id, rsvpStatus: 'confirmed' }), fullName, assignedSeatId: null, ...where }) as Guest

// Families sit inside a subgroup inside a group, which is how a real plan is
// built. Searching any container's name should find the people in it.
beforeEach(() => {
  openPlan({
    guests: {
      g1: guest('g1', 'Ada Lovelace', { groupId: 'grp', subgroupId: 'sub', familyId: 'fam' }),
      g2: guest('g2', 'Byron Lovelace', { groupId: 'grp', subgroupId: 'sub', familyId: 'fam' }),
      g3: guest('g3', 'Mary Somerville', { groupId: 'grp', subgroupId: 'sub' }),
      g4: guest('g4', 'Alan Turing', { groupId: 'grp' }),
    },
    groups: { grp: { id: 'grp', name: 'Work', colour: '#000', memberIds: ['g1', 'g2', 'g3', 'g4'] } },
    subgroups: { sub: { id: 'sub', name: 'Analysts', colour: '#000', parentGroupId: 'grp', memberIds: ['g1', 'g2', 'g3'] } },
    families: {
      fam: { id: 'fam', name: 'The Engines', colour: '#000', parentGroupId: null, parentSubgroupId: 'sub', memberIds: ['g1', 'g2'] },
    },
  })
})

const search = (query: string) => {
  useStore.setState({ search: query })
  render(<GuestPanel />)
}

describe('GuestPanel search', () => {
  it("finds a family's members by the family's name", () => {
    search('engines')
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('Byron Lovelace')).toBeInTheDocument()
    expect(screen.queryByText('Mary Somerville')).toBeNull()
    expect(screen.queryByText('Alan Turing')).toBeNull()
  })

  it("finds a subgroup's members by the subgroup's name", () => {
    search('analysts')
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('Mary Somerville')).toBeInTheDocument()
    expect(screen.queryByText('Alan Turing')).toBeNull()
  })

  it("still finds a group's members by the group's name", () => {
    search('work')
    expect(screen.getByText('Alan Turing')).toBeInTheDocument()
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
  })

  it('still finds a person by their own name', () => {
    search('turing')
    expect(screen.getByText('Alan Turing')).toBeInTheDocument()
    expect(screen.queryByText('Ada Lovelace')).toBeNull()
  })
})

describe("a family member's menu", () => {
  it('offers to seat them on their own, opening them in the inspector', () => {
    search('lovelace')
    fireEvent.contextMenu(screen.getByText('Ada Lovelace'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Seat on their own…' }))
    expect(useStore.getState().selection).toEqual({ type: 'guest', id: 'g1' })
  })

  it('is not offered to someone in no family', () => {
    search('turing')
    fireEvent.contextMenu(screen.getByText('Alan Turing'))
    expect(screen.queryByRole('menuitem', { name: 'Seat on their own…' })).toBeNull()
  })
})
