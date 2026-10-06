import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConstraintsModal from './ConstraintsModal'
import { useStore } from '../../store/useStore'
import { openPlan } from '../../test/openPlan'
import { newGuest } from '@/lib/model/factories'
import type { Guest } from '../../store/types'

const guest = (id: string, fullName: string): Guest =>
  ({ ...newGuest({ id, rsvpStatus: 'confirmed' }), fullName, assignedSeatId: null }) as Guest

beforeEach(() => {
  openPlan({ guests: { g1: guest('g1', 'Ada Lovelace'), g2: guest('g2', 'Alan Turing') } })
  const st = useStore.getState()
  st.addTable({ type: 'round', x: 100, y: 100 })
  const [table] = Object.values(useStore.getState().tables)
  st.assignGuest('g1', table.id)
  st.assignGuest('g2', table.id)
})

const addRule = async (kind: string) => {
  const user = userEvent.setup()
  render(<ConstraintsModal />)
  await user.click(screen.getByRole('button', { name: kind }))
  const [a, b] = screen.getAllByRole('combobox')
  await user.selectOptions(a, 'g1')
  await user.selectOptions(b, 'g2')
  await user.click(screen.getByRole('button', { name: 'Add' }))
}

describe('ConstraintsModal', () => {
  it('says, in words and to screen readers, when a new rule is already broken', async () => {
    await addRule('Shouldn’t sit together')
    const table = Object.values(useStore.getState().tables)[0]
    expect(useStore.getState().constraints).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent(
      `Already broken: Ada Lovelace and Alan Turing shouldn't sit together — both are at ${table.label}.`
    )
  })

  it('says nothing when the new rule holds', async () => {
    await addRule('Should sit together')
    expect(useStore.getState().constraints).toHaveLength(1)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })
})
