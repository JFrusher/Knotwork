import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TableInspector from './TableInspector'
import SpaceInspector from './SpaceInspector'
import { useStore } from '../../store/useStore'
import { openPlan } from '../../test/openPlan'

beforeEach(() => {
  openPlan({
    tables: {
      t1: {
        id: 't1',
        label: 'Table 1',
        type: 'round',
        capacity: 8,
        assignedGuestIds: [],
        seatMode: 'table',
        sizeUnits: { shape: 'circle', diameter: 180 },
      },
    },
    room: { spaces: [{ id: 'sp1', label: 'Hall', shape: 'rect', x: 0, y: 0, width: 1000, height: 600 }] },
  } as never)
})

/** The message a field is tied to by `aria-describedby`, or null. */
function messageFor(field: HTMLElement): string | null {
  const id = field.getAttribute('aria-describedby')
  return id ? document.getElementById(id)?.textContent ?? null : null
}

describe('inspector fields', () => {
  it('keeps an invalid table size, says why, and writes nothing', async () => {
    const user = userEvent.setup()
    render(<TableInspector tableId="t1" />)
    const field = screen.getByRole('textbox', { name: 'Diameter' })
    const stored = (field as HTMLInputElement).value

    await user.clear(field)
    await user.type(field, 'abc')
    await user.tab()

    expect(field).toHaveValue('abc')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(messageFor(field)).toMatch(/size/i)
    // Focus has already moved on, so the message has to announce itself.
    expect(screen.getByRole('alert')).toHaveTextContent(messageFor(field)!)
    expect(useStore.getState().tables.t1.sizeUnits).toEqual({ shape: 'circle', diameter: 180 })

    // Escape is the one way back to the last good value.
    await user.click(field)
    await user.keyboard('{Escape}')
    expect(field).toHaveValue(stored)
    expect(field).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('keeps a negative space size, says why, and writes nothing', async () => {
    const user = userEvent.setup()
    render(<SpaceInspector spaceId="sp1" />)
    const field = screen.getByRole('textbox', { name: 'Width' })

    await user.clear(field)
    await user.type(field, '-5')
    await user.tab()

    expect(field).toHaveValue('-5')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(messageFor(field)).toMatch(/size/i)
    expect(useStore.getState().room.spaces[0]).toMatchObject({ width: 1000 })
  })

  it('keeps a blank table name, says why, and writes nothing', async () => {
    const user = userEvent.setup()
    render(<TableInspector tableId="t1" />)
    const field = screen.getByRole('textbox', { name: 'Table name' })

    await user.clear(field)
    await user.tab()

    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(messageFor(field)).toMatch(/name/i)
    expect(useStore.getState().tables.t1.label).toBe('Table 1')
  })
})
