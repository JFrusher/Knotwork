import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './useStore'
import { openPlan } from '../test/openPlan'
import { useKnotworkStore } from '@/lib/store/useKnotworkStore'
import type { Plan } from './types'

const mkGuest = (id: string, first: string, last: string) => ({
  id,
  firstName: first,
  lastName: last,
  fullName: `${first} ${last}`,
  email: '',
  dietary: '',
  dietaryRaw: '',
  side: null,
  rsvpStatus: 'confirmed',
  plusOneOf: null,
  groupId: null,
  assignedTableId: null,
  assignedSeatId: null,
  notes: '',
  tags: [],
})

const fixture = () =>
  ({
  meta: { weddingName: 'Test', venue: '', date: '', createdAt: '', updatedAt: '' },
  guests: { g1: mkGuest('g1', 'A', 'X'), g2: mkGuest('g2', 'B', 'Y') },
  groups: {},
  tables: {
    t1: {
      id: 't1',
      label: 'Table 1',
      designation: null,
      type: 'round',
      capacity: 8,
      x: 0,
      y: 0,
      rotation: 0,
      assignedGuestIds: [],
      seatMode: 'table',
      colour: null,
    },
  },
  zones: {},
  room: { width: 1200, height: 900, backgroundColour: '#FAF8F5' },
  canvas: { zoom: 1, panX: 0, panY: 0 },
  snapshots: [],
  constraints: [],
  settings: {
    defaultSeatMode: 'table',
    showDietaryBadges: true,
    showGroupColours: true,
    gridSnap: true,
    gridSize: 20,
  },
  }) as unknown as Partial<Plan>

const s = () => useStore.getState()
const countTables = () => Object.keys(s().tables).length

beforeEach(() => {
  openPlan(fixture())
})

describe('tables', () => {
  it('adds a table and supports undo / redo', () => {
    const cmd = s().addTable({ type: 'round', x: 10, y: 10 })
    expect(cmd!.meta!.newTableId).toBeTruthy()
    expect(countTables()).toBe(2)

    useKnotworkStore.getState().undo()
    expect(countTables()).toBe(1)
    useKnotworkStore.getState().redo()
    expect(countTables()).toBe(2)
  })

  it('deleting a table unassigns its guests, and undo restores both', () => {
    s().assignGuest('g1', 't1')
    expect(s().guests.g1.assignedTableId).toBe('t1')

    s().removeTable('t1')
    expect(s().tables.t1).toBeUndefined()
    expect(s().guests.g1.assignedTableId).toBeNull()

    useKnotworkStore.getState().undo()
    expect(s().tables.t1).toBeDefined()
    expect(s().guests.g1.assignedTableId).toBe('t1')
  })
})

describe('assignment', () => {
  it('assigns and unassigns a guest, keeping table + guest in sync', () => {
    s().assignGuest('g1', 't1')
    expect(s().tables.t1.assignedGuestIds).toContain('g1')

    useKnotworkStore.getState().undo()
    expect(s().guests.g1.assignedTableId).toBeNull()
    expect(s().tables.t1.assignedGuestIds).not.toContain('g1')
  })

  it('moving a guest to another table clears the original', () => {
    const t2 = s().addTable({ type: 'round', x: 5, y: 5 })!.meta!.newTableId as string
    s().assignGuest('g1', 't1')
    s().assignGuest('g1', t2)
    expect(s().tables.t1.assignedGuestIds).not.toContain('g1')
    expect(s().tables[t2].assignedGuestIds).toContain('g1')
  })
})

describe('guest field edits', () => {
  it('are undoable', () => {
    s().updateGuest('g1', { rsvpStatus: 'declined' })
    expect(s().guests.g1.rsvpStatus).toBe('declined')
    useKnotworkStore.getState().undo()
    expect(s().guests.g1.rsvpStatus).toBe('confirmed')
    useKnotworkStore.getState().redo()
    expect(s().guests.g1.rsvpStatus).toBe('declined')
  })

  it('keep fullName in sync, and undo restores the old one', () => {
    s().updateGuest('g1', { lastName: 'Z' })
    expect(s().guests.g1.fullName).toBe('A Z')
    useKnotworkStore.getState().undo()
    expect(s().guests.g1.fullName).toBe('A X')
  })
})

describe('plan details, settings and seating rules', () => {
  it('undoes a settings change without clobbering untouched keys', () => {
    s().updateSettings({ gridSize: 40 })
    expect(s().settings.gridSize).toBe(40)
    useKnotworkStore.getState().undo()
    expect(s().settings.gridSize).toBe(20)
    expect(s().settings.gridSnap).toBe(true)
  })

  it('ignores a no-op settings patch', () => {
    const before = useKnotworkStore.getState().past.length
    s().updateSettings({ gridSize: s().settings.gridSize })
    expect(useKnotworkStore.getState().past).toHaveLength(before)
  })

  it('adds and removes a seating rule undoably', () => {
    const id = s().addConstraint({ kind: 'apart', guestIds: ['g1', 'g2'] })!.meta!.newConstraintId as string
    expect(s().constraints).toHaveLength(1)
    useKnotworkStore.getState().undo()
    expect(s().constraints).toHaveLength(0)
    useKnotworkStore.getState().redo()
    expect(s().constraints).toHaveLength(1)

    s().removeConstraint(id)
    expect(s().constraints).toHaveLength(0)
    useKnotworkStore.getState().undo()
    expect(s().constraints).toHaveLength(1)
  })
})

describe('history stack', () => {
  it('tracks past / future across undo and redo', () => {
    expect(useKnotworkStore.getState().past).toHaveLength(0)
    s().addTable({ type: 'round', x: 0, y: 0 })
    expect(useKnotworkStore.getState().past).toHaveLength(1)
    expect(useKnotworkStore.getState().future).toHaveLength(0)
    useKnotworkStore.getState().undo()
    expect(useKnotworkStore.getState().past).toHaveLength(0)
    expect(useKnotworkStore.getState().future).toHaveLength(1)
  })
})

describe('groups', () => {
  it('creates a group and dissolves it via undo', () => {
    s().createGroup(['g1', 'g2'], { name: 'Family' })
    const gid = Object.keys(s().groups)[0]
    expect(s().guests.g1.groupId).toBe(gid)
    expect(s().guests.g2.groupId).toBe(gid)

    useKnotworkStore.getState().undo()
    expect(Object.keys(s().groups)).toHaveLength(0)
    expect(s().guests.g1.groupId).toBeNull()
  })
})

describe('snapshots', () => {
  it('captures and restores a point-in-time copy', () => {
    s().addTable({ type: 'round', x: 1, y: 1 }) // now 2 tables
    const snap = s().saveSnapshot('checkpoint')
    expect(s().snapshots).toHaveLength(1)

    s().addTable({ type: 'round', x: 2, y: 2 }) // now 3 tables
    expect(countTables()).toBe(3)

    s().restoreSnapshot(snap.id)
    expect(countTables()).toBe(2)
    expect(s().snapshots).toHaveLength(1) // snapshot list preserved
  })
})
