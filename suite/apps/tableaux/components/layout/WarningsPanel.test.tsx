import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import WarningsPanel from './WarningsPanel'
import { WarningsProvider } from '../../store/warningsContext'
import { useStore } from '../../store/useStore'
import { openPlan } from '../../test/openPlan'
import { newGuest } from '@/lib/model/factories'
import type { Guest } from '../../store/types'

const guest = (id: string, fullName: string): Guest =>
  ({ ...newGuest({ id, rsvpStatus: 'confirmed' }), fullName, assignedSeatId: null }) as Guest

describe('WarningsPanel', () => {
  it('labels a split family as a family, not as a broken rule', () => {
    openPlan({
      guests: { g1: guest('g1', 'Ada Okafor'), g2: guest('g2', 'Bola Okafor') },
      families: { f: { id: 'f', name: 'Okafor', colour: '#000', parentGroupId: null, parentSubgroupId: null, memberIds: ['g1', 'g2'] } },
    })
    const st = useStore.getState()
    const t1 = st.addTable({ type: 'round', x: 100, y: 100 })!.meta!.newTableId as string
    const t2 = st.addTable({ type: 'round', x: 400, y: 100 })!.meta!.newTableId as string
    // Each family member drags the rest along, so seat them apart in the data.
    useStore.setState((s) => ({
      guests: { ...s.guests, g1: { ...s.guests.g1, assignedTableId: t1 }, g2: { ...s.guests.g2, assignedTableId: t2 } },
    }))
    render(
      <WarningsProvider>
        <WarningsPanel />
      </WarningsProvider>
    )
    const row = screen.getByRole('button', { name: /Okafor" family is split/ })
    expect(row).toHaveTextContent(/^Family/)
  })
})
