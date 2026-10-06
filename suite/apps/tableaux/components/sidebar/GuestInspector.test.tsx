import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import GuestInspector from './GuestInspector'
import userEvent from '@testing-library/user-event'
import { openPlan } from '../../test/openPlan'
import { useStore } from '../../store/useStore'
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

describe('seating one member of a family on their own', () => {
  const family = () => {
    openPlan({
      guests: { g1: guest('g1', { familyId: 'fam' }), g2: { ...guest('g2', { familyId: 'fam' }), fullName: 'Bola Okafor' } },
      families: { fam: { id: 'fam', name: 'Okafor', colour: '#000', parentGroupId: null, parentSubgroupId: null, memberIds: ['g1', 'g2'] } },
    })
    const st = useStore.getState()
    const t1 = st.addTable({ type: 'round', x: 100, y: 100 })!.meta!.newTableId as string
    st.assignGuest('g1', t1)
    st.assignGuest('g2', t1)
    return { t2: st.addTable({ type: 'round', x: 400, y: 100 })!.meta!.newTableId as string, t1 }
  }

  it('moves only that guest, and says so beside the choice', async () => {
    const { t1, t2 } = family()
    render(<GuestInspector guestId="g1" />)
    const choice = screen.getByRole('combobox', { name: 'Seat on their own' })
    expect(choice).toHaveAccessibleDescription('Moves Ada Okafor alone. Dragging moves the whole Okafor family.')
    await userEvent.setup().selectOptions(choice, t2)
    expect(useStore.getState().guests.g1.assignedTableId).toBe(t2)
    expect(useStore.getState().guests.g2.assignedTableId).toBe(t1)
  })
})
