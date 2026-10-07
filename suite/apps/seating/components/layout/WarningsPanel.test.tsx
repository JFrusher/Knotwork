import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import WarningsPanel from './WarningsPanel'
import { WarningsProvider } from '../../store/warningsContext'
import { openPlan } from '../../test/openPlan'

beforeEach(() => {
  openPlan({
    guests: {
      a: { id: 'a', fullName: 'Ada', assignedTableId: 't1', rsvpStatus: 'confirmed', familyId: 'f' },
      b: { id: 'b', fullName: 'Ben', assignedTableId: 't3', rsvpStatus: 'confirmed', familyId: 'f' },
    },
    tables: {
      t1: { id: 't1', label: 'Table 1', capacity: 8, assignedGuestIds: ['a'], seatMode: 'table' },
      t3: { id: 't3', label: 'Table 3', capacity: 8, assignedGuestIds: ['b'], seatMode: 'table' },
    },
    families: { f: { id: 'f', name: 'Smith', colour: '#B3866B', memberIds: ['a', 'b'], parentGroupId: null, parentSubgroupId: null } },
  } as never)
})

describe('WarningsPanel', () => {
  it('shows a split family as one row, labelled as a family', () => {
    render(
      <WarningsProvider>
        <WarningsPanel />
      </WarningsProvider>
    )
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveTextContent('FamilyThe Smith family is split across Table 1 and Table 3.')
  })
})
