import { describe, it, expect, beforeEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import RoomCanvas from './RoomCanvas'
import { useStore } from '../../store/useStore'
import { openPlan } from '../../test/openPlan'

const pointer = (type: string, x: number, y: number) =>
  act(() => {
    window.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y }))
  })

// A cancelled pointer (a system gesture, an interrupted touch) is not a
// release: the draft must go, and nothing it would have committed may happen.
describe('RoomCanvas drawing, when the pointer is cancelled', () => {
  beforeEach(() => {
    openPlan({})
  })

  it('drops a half-drawn zone and adds nothing', () => {
    useStore.setState({ activeTool: 'zone' })
    const { container } = render(<RoomCanvas />)
    const canvas = container.querySelector('[data-tour="seating.canvas"]')!

    fireEvent.pointerDown(canvas, { button: 0, clientX: 10, clientY: 10 })
    pointer('pointermove', 200, 200)
    expect(container.querySelector('[class*="draftZone"]')).not.toBeNull()

    pointer('pointercancel', 200, 200)
    expect(container.querySelector('[class*="draftZone"]')).toBeNull()

    // A release after the cancel belongs to no drag.
    pointer('pointerup', 200, 200)
    expect(Object.keys(useStore.getState().zones)).toHaveLength(0)
    expect(useStore.getState().activeTool).toBe('select')
  })

  it('drops a half-drawn calibration line and opens no dialog', () => {
    useStore.setState({ activeTool: 'calibrate' })
    const { container } = render(<RoomCanvas />)
    const canvas = container.querySelector('[data-tour="seating.canvas"]')!

    fireEvent.pointerDown(canvas, { button: 0, clientX: 10, clientY: 10 })
    pointer('pointermove', 200, 200)
    expect(container.querySelector('line[stroke-dasharray]')).not.toBeNull()

    pointer('pointercancel', 200, 200)
    expect(container.querySelector('line[stroke-dasharray]')).toBeNull()

    pointer('pointerup', 200, 200)
    expect(useStore.getState().modal).toBeNull()
    expect(useStore.getState().activeTool).toBe('select')
  })

  it('still adds a zone on an ordinary release', () => {
    useStore.setState({ activeTool: 'zone' })
    const { container } = render(<RoomCanvas />)
    const canvas = container.querySelector('[data-tour="seating.canvas"]')!

    fireEvent.pointerDown(canvas, { button: 0, clientX: 10, clientY: 10 })
    pointer('pointermove', 200, 200)
    pointer('pointerup', 200, 200)
    expect(Object.keys(useStore.getState().zones)).toHaveLength(1)
  })
})
