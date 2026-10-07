import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('idb-keyval', () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined }))

const { migrate } = await import('@jfrusher/knotwork')
const { useKnotworkStore } = await import('@/lib/store/useKnotworkStore')
const { useStore } = await import('./useStore')

/*
 * Seating holds no copy of the wedding: its plan is the wedding's guests and
 * seating, every edit lands there at once on the one history, and a change to
 * either from anywhere is what the room shows.
 */
const example = JSON.parse(readFileSync(join(process.cwd(), 'public', 'fixtures', 'example-wedding.knotwork.json'), 'utf8'))
const shared = () => useKnotworkStore.getState()
const seating = () => useStore.getState()
// The wedding as stored, shaped like the example it was opened from.
const stored = () => shared().raw as typeof example
const tableIds = Object.keys(example.seating.tables)
const [t1, t2] = tableIds

beforeEach(() => {
  useKnotworkStore.setState({ status: 'ready', raw: example, doc: migrate(example), past: [], future: [] })
  useStore.setState({ selection: { type: null, id: null }, selectedGuestIds: [] })
})

it('an edit is in the wedding the moment it is made', () => {
  seating().renameTable(t1, 'The top table')
  expect(stored().seating.tables[t1].label).toBe('The top table')
})

it('a guest changed elsewhere is what the room shows, and the next Seating edit keeps it', () => {
  const guestId = Object.keys(example.guests)[0]
  shared().setSlice('guests', { ...example.guests, [guestId]: { ...example.guests[guestId], firstName: 'Changed' } }, { label: 'a guest' })
  expect(seating().guests[guestId].firstName).toBe('Changed')

  seating().renameTable(t1, 'The top table')
  expect(stored().guests[guestId].firstName).toBe('Changed')
})

it("the header's undo takes a Seating edit back, on the wedding's one history", () => {
  seating().renameTable(t1, 'The top table')
  expect(shared().past.at(-1)?.label).toBe('rename table')
  shared().undo()
  expect(seating().tables[t1].label).toBe(example.seating.tables[t1].label)
})

it("a drag's frames stay in this window; the drop is one step, and undo goes back to where it began", () => {
  const { x, y } = example.seating.tables[t1]
  seating().patchEntityLive('tables', t1, { x: x + 10, y })
  seating().patchEntityLive('tables', t1, { x: x + 20, y })
  expect(stored().seating.tables[t1].x).toBe(x)

  seating().moveTable(t1, x + 20, y)
  expect(stored().seating.tables[t1].x).toBe(x + 20)
  shared().undo()
  expect(seating().tables[t1].x).toBe(x)
})

it('a selected table undone out of existence is no longer selected', () => {
  seating().dispatch((state) => ({
    type: 'ADD_TABLE',
    label: 'Add table',
    payload: { tables: { t_new: { ...state.tables[t1], id: 't_new', assignedGuestIds: [] } } },
  }))
  seating().select('table', 't_new')
  shared().undo()
  expect(seating().selection).toEqual({ type: null, id: null })
})

it("pan and zoom are this window's own, not the wedding's", () => {
  const before = stored()
  seating().setCanvas({ zoom: 1.5, panX: 40 })
  expect(seating().canvas.zoom).toBe(1.5)
  expect(stored()).toBe(before)
})

it('an edit leaves every table it did not touch as the same object, so the room does not redraw', () => {
  const other = seating().tables[t2]
  seating().renameTable(t1, 'The top table')
  expect(seating().tables[t2]).toBe(other)
})
