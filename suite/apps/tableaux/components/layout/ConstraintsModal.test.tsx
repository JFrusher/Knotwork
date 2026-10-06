import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConstraintsModal from './ConstraintsModal'
import { useStore } from '../../store/useStore'
import { openPlan } from '../../test/openPlan'

beforeEach(() => {
  openPlan({
    guests: {
      g1: { id: 'g1', fullName: 'Ada Lovelace', assignedTableId: 't4', rsvpStatus: 'confirmed' },
      g2: { id: 'g2', fullName: 'Alan Turing', assignedTableId: 't4', rsvpStatus: 'confirmed' },
    },
    tables: {
      t4: { id: 't4', label: 'Table 4', capacity: 8, assignedGuestIds: ['g1', 'g2'], seatMode: 'table' },
    },
  } as never)
})

async function addRule(kind: 'apart' | 'together') {
  const user = userEvent.setup()
  render(<ConstraintsModal />)
  if (kind === 'together') await user.click(screen.getByRole('button', { name: 'Should sit together' }))
  const [first, second] = screen.getAllByRole('combobox')
  await user.selectOptions(first, 'g1')
  await user.selectOptions(second, 'g2')
  await user.click(screen.getByRole('button', { name: 'Add' }))
}

describe('ConstraintsModal', () => {
  it('says so, aloud, when a rule is broken the moment it is added', async () => {
    await addRule('apart')

    expect(useStore.getState().constraints).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent(
      "Already broken: Ada Lovelace and Alan Turing shouldn't sit together — both are at Table 4."
    )
  })

  it('says nothing when the plan already keeps the rule', async () => {
    await addRule('together')

    expect(useStore.getState().constraints).toHaveLength(1)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })
})
