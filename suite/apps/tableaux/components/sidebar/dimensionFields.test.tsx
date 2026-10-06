import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TableInspector from './TableInspector'
import SpaceInspector from './SpaceInspector'
import { useStore } from '../../store/useStore'
import { openPlan } from '../../test/openPlan'
import type { Plan } from '../../store/types'

let tableId = ''
let spaceId = ''

beforeEach(() => {
  // Metric pinned: the default follows the browser's locale.
  openPlan({ settings: { unitSystem: 'metric' } as Plan['settings'] })
  const st = useStore.getState()
  tableId = st.addTable({ type: 'rect', x: 100, y: 100 })!.meta!.newTableId as string
  spaceId = st.addSpace({ x: 0, y: 0, width: 300, height: 200 })!.meta!.newSpaceId as string
})

/** Types into a field, leaves it, and returns it. */
const typeAndLeave = async (label: string, text: string) => {
  const user = userEvent.setup()
  const field = screen.getByRole('textbox', { name: label })
  await user.clear(field)
  if (text) await user.type(field, text)
  await user.tab()
  return field
}

const expectInvalid = (field: HTMLElement, typed: string, message: string) => {
  expect(field).toHaveValue(typed)
  expect(field).toHaveAttribute('aria-invalid', 'true')
  expect(field).toHaveAccessibleDescription(message)
}

describe('an invalid entry in an inspector field', () => {
  it('is kept and explained for a table size, and nothing is written', async () => {
    render(<TableInspector tableId={tableId} />)
    const before = useStore.getState().tables[tableId].sizeUnits
    const field = await typeAndLeave('Width', '-5')
    expectInvalid(field, '-5', 'Enter a size in cm, like 180')
    expect(useStore.getState().tables[tableId].sizeUnits).toEqual(before)
  })

  it('is kept and explained for a space size, and nothing is written', async () => {
    render(<SpaceInspector spaceId={spaceId} />)
    const field = await typeAndLeave('Height', 'abc')
    expectInvalid(field, 'abc', 'Enter a size in cm, like 180')
    const space = useStore.getState().room.spaces!.find((s) => s.id === spaceId)!
    expect(space.shape === 'rect' && space.height).toBe(200)
  })

  it('is explained for a blank table name', async () => {
    render(<TableInspector tableId={tableId} />)
    const label = useStore.getState().tables[tableId].label
    const field = await typeAndLeave('Table name', '')
    expectInvalid(field, '', 'Enter a name')
    expect(useStore.getState().tables[tableId].label).toBe(label)
  })

  it('goes back to the saved value on Escape', async () => {
    const user = userEvent.setup()
    render(<TableInspector tableId={tableId} />)
    const field = await typeAndLeave('Width', 'abc')
    await user.click(field)
    await user.keyboard('{Escape}')
    expect(field).not.toHaveAttribute('aria-invalid', 'true')
    expect(field).not.toHaveValue('abc')
  })

  it('does not commit what Escape threw away', async () => {
    const user = userEvent.setup()
    render(<TableInspector tableId={tableId} />)
    const label = useStore.getState().tables[tableId].label
    const field = screen.getByRole('textbox', { name: 'Table name' })
    await user.clear(field)
    await user.type(field, 'Oops')
    await user.keyboard('{Escape}')
    expect(useStore.getState().tables[tableId].label).toBe(label)
    expect(field).toHaveValue(label)
  })
})
