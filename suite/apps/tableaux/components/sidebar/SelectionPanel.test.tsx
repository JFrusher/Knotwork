import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RightSidebar from './RightSidebar'
import { useStore } from '../../store/useStore'
import { openPlan } from '../../test/openPlan'
import { newGuest } from '@/lib/model/factories'
import type { Guest } from '../../store/types'

const guest = (id: string): Guest =>
  ({ ...newGuest({ id, firstName: id, lastName: 'Okafor', rsvpStatus: 'confirmed' }), fullName: `${id} Okafor`, assignedSeatId: null }) as Guest

const s = () => useStore.getState()
let small = ''
let big = ''

beforeEach(() => {
  openPlan({
    guests: { g1: guest('g1'), g2: guest('g2'), g3: guest('g3') },
    groups: { grp: { id: 'grp', name: 'School', colour: '#000', memberIds: [] } },
  })
  small = s().addTable({ type: 'round', x: 0, y: 0, capacity: 2 })!.meta!.newTableId as string
  big = s().addTable({ type: 'round', x: 400, y: 0 })!.meta!.newTableId as string
  s().setSelectedGuestIds(['g1', 'g2', 'g3'])
})

describe('several guests selected', () => {
  it('says how many, in place of the overview', () => {
    render(<RightSidebar />)
    expect(screen.getByRole('heading', { name: '3 guests selected' })).toBeInTheDocument()
  })

  it('makes them a family', async () => {
    render(<RightSidebar />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Make a family' }))
    expect(Object.values(s().families)).toHaveLength(1)
    expect(Object.values(s().families)[0].memberIds).toEqual(['g1', 'g2', 'g3'])
  })

  it('seats them at a table with room for all of them, and says why not at one without', async () => {
    const user = userEvent.setup()
    render(<RightSidebar />)
    const seat = screen.getByRole('combobox', { name: 'Seat them at' })
    await user.selectOptions(seat, small)
    expect(screen.getByRole('status')).toHaveTextContent(`${s().tables[small].label} has 2 free seats, not 3.`)
    expect(s().guests.g1.assignedTableId).toBeNull()
    await user.selectOptions(seat, big)
    expect(['g1', 'g2', 'g3'].map((id) => s().guests[id].assignedTableId)).toEqual([big, big, big])
  })

  it('adds them to a group', async () => {
    render(<RightSidebar />)
    await userEvent.setup().selectOptions(screen.getByRole('combobox', { name: 'Add them to' }), 'grp')
    expect(s().groups.grp.memberIds).toEqual(['g1', 'g2', 'g3'])
  })
})
