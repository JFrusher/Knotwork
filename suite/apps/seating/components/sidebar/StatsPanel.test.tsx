import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatsPanel from './StatsPanel'
import { useStore } from '../../store/useStore'
import { openPlan } from '../../test/openPlan'
import type { Guest, Table } from '../../store/types'

// Only the fields the panel counts.
const guest = (g: Partial<Guest>) => g as Guest
const table = (t: Partial<Table>) => t as Table

beforeEach(() => {
  openPlan({
    guests: {
      g1: guest({ id: 'g1', fullName: 'Ada Lovelace', assignedTableId: 't1', dietary: 'vegan', rsvpStatus: 'confirmed' }),
      g2: guest({ id: 'g2', fullName: 'Alan Turing', assignedTableId: null, dietary: '', rsvpStatus: 'confirmed' }),
    },
    tables: {
      t1: table({ id: 't1', label: 'Table 1', capacity: 8, assignedGuestIds: ['g1'], seatMode: 'table' }),
    },
  })
})

describe('StatsPanel', () => {
  it('renders the overview with live counts driven by the store', () => {
    render(<StatsPanel />)
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Guests')).toBeInTheDocument()
    expect(screen.getByText('Seated')).toBeInTheDocument()
    expect(screen.getByText('Unseated')).toBeInTheDocument()
  })

  it('shows the dietary breakdown and the table-fill list', () => {
    render(<StatsPanel />)
    expect(screen.getByText('Vegan')).toBeInTheDocument()
    expect(screen.getByText('Table 1')).toBeInTheDocument()
    expect(screen.getByText('1/8')).toBeInTheDocument()
  })

  it('counts someone who declined as neither unseated nor a meal', () => {
    openPlan({
      guests: {
        g1: guest({ id: 'g1', fullName: 'Ada Lovelace', assignedTableId: 't1', dietary: 'vegan', rsvpStatus: 'confirmed' }),
        g2: guest({ id: 'g2', fullName: 'Alan Turing', assignedTableId: null, dietary: 'kosher', rsvpStatus: 'declined' }),
      },
      tables: {
        t1: table({ id: 't1', label: 'Table 1', capacity: 8, assignedGuestIds: ['g1'], seatMode: 'table' }),
      },
    })
    render(<StatsPanel />)
    const unseated = screen.getByText('Unseated').previousElementSibling
    expect(unseated).toHaveTextContent('0')
    expect(screen.queryByText('Kosher')).not.toBeInTheDocument()
  })

  it('prompts to import when there are no guests', () => {
    openPlan({ guests: {}, tables: {} })
    render(<StatsPanel />)
    expect(screen.getByText(/import your guest list/i)).toBeInTheDocument()
  })
})
