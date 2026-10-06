import { describe, it, expect } from 'vitest'
import { computeWarnings, buildWarningIndex, type SeatingWarning } from './warnings'
import type { Constraint, Guest, Table } from '../store/types'

// Only the fields the rules read.
const guest = (id: string, over: Partial<Guest> = {}) =>
  ({
  id,
  fullName: id,
  dietary: '',
  rsvpStatus: 'confirmed',
  assignedTableId: null,
  ...over,
  }) as Guest
const table = (id: string, over: Partial<Table> = {}) =>
  ({
  id,
  label: id,
  type: 'round',
  capacity: 8,
  designation: null,
  assignedGuestIds: [],
  ...over,
  }) as Table

describe('computeWarnings', () => {
  it('flags an over-capacity table', () => {
    const state = {
      guests: { a: guest('a'), b: guest('b'), c: guest('c') },
      tables: { t: table('t', { capacity: 2, assignedGuestIds: ['a', 'b', 'c'] }) },
      constraints: [],
    }
    const w = computeWarnings(state)
    expect(w.some((x) => x.kind === 'over-capacity' && x.tableIds.includes('t'))).toBe(true)
  })

  it('nudges to check guests with no dietary note among others who have one', () => {
    const state = {
      guests: {
        a: guest('a', { dietary: 'vegan', assignedTableId: 't' }),
        b: guest('b', { assignedTableId: 't' }),
      },
      tables: { t: table('t', { assignedGuestIds: ['a', 'b'] }) },
      constraints: [],
    }
    expect(computeWarnings(state).some((x) => x.kind === 'dietary-check')).toBe(true)
  })

  it('counts a guest who answered "None" as having a note, not as one to check', () => {
    const state = {
      guests: {
        a: guest('a', { dietary: 'vegan', assignedTableId: 't' }),
        b: guest('b', { dietaryRaw: 'None', assignedTableId: 't' }),
      },
      tables: { t: table('t', { assignedGuestIds: ['a', 'b'] }) },
      constraints: [],
    }
    expect(computeWarnings(state).some((x) => x.kind === 'dietary-check')).toBe(false)
  })

  it('warns when more than 30% of guests are unseated', () => {
    const guests: Record<string, Guest> = {}
    for (let i = 0; i < 10; i++) guests[`g${i}`] = guest(`g${i}`, { assignedTableId: i < 6 ? 't' : null })
    const w = computeWarnings({ guests, tables: { t: table('t') }, constraints: [] })
    expect(w.some((x) => x.kind === 'unassigned')).toBe(true)
  })

  it('honours "apart" and "together" constraints', () => {
    const apart = computeWarnings({
      guests: { a: guest('a', { assignedTableId: 't' }), b: guest('b', { assignedTableId: 't' }) },
      tables: { t: table('t', { assignedGuestIds: ['a', 'b'] }) },
      constraints: [{ id: 'c1', kind: 'apart', guestIds: ['a', 'b'] } as Constraint],
    })
    expect(apart.find((x) => x.kind === 'apart')).toMatchObject({ guestIds: ['a', 'b'], tableIds: ['t'] })

    const together = computeWarnings({
      guests: { a: guest('a', { assignedTableId: 't1' }), b: guest('b', { assignedTableId: 't2' }) },
      tables: { t1: table('t1', { assignedGuestIds: ['a'] }), t2: table('t2', { assignedGuestIds: ['b'] }) },
      constraints: [{ id: 'c2', kind: 'together', guestIds: ['a', 'b'] } as Constraint],
    })
    expect(together.find((x) => x.kind === 'together')).toMatchObject({ guestIds: ['a', 'b'], tableIds: ['t1', 't2'] })
  })

  it('reports a split family once, naming the family and its tables, and marks every member', () => {
    const at = (t: string) => ({ assignedTableId: t })
    const w = computeWarnings({
      guests: { a: guest('a', at('t1')), b: guest('b', at('t1')), c: guest('c', at('t1')), d: guest('d', at('t3')), e: guest('e', at('t3')) },
      tables: { t1: table('t1', { label: 'Table 1' }), t3: table('t3', { label: 'Table 3' }) },
      constraints: [],
      families: { f: { id: 'f', name: 'Smith', memberIds: ['a', 'b', 'c', 'd', 'e'] } },
    }).filter((x) => x.kind === 'family-split')

    expect(w).toHaveLength(1)
    expect(w[0].message).toBe('The Smith family is split across Table 1 and Table 3.')
    expect(w[0].guestIds).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(w[0].tableIds).toEqual(['t1', 't3'])
  })

  it('reports a clean plan with no warnings', () => {
    const state = {
      guests: { a: guest('a', { assignedTableId: 't', dietary: 'vegan' }) },
      tables: { t: table('t', { assignedGuestIds: ['a'] }) },
      constraints: [],
    }
    expect(computeWarnings(state)).toHaveLength(0)
  })
})

// Only what the index reads.
const warning = (w: Pick<SeatingWarning, 'id' | 'tableIds' | 'guestIds' | 'message'>) => w as SeatingWarning

describe('buildWarningIndex', () => {
  it('indexes warnings by table and guest', () => {
    const { byTable, byGuest } = buildWarningIndex([
      warning({ id: 'w1', tableIds: ['t'], guestIds: [], message: 'x' }),
      warning({ id: 'w2', tableIds: [], guestIds: ['g'], message: 'y' }),
      warning({ id: 'w3', tableIds: ['t', 'u'], guestIds: ['g', 'h'], message: 'z' }),
    ])
    expect(byTable.get('t')).toHaveLength(2)
    expect(byTable.get('u')).toHaveLength(1)
    expect(byGuest.get('g')).toHaveLength(2)
    expect(byGuest.get('h')).toHaveLength(1)
  })
})

describe('tables on top of each other', () => {
  // At one pixel per centimetre, so the sizes below are the distances.
  const settings = { pixelsPerUnit: 1, chairSizeUnits: 28 }
  const round = (id: string, x: number, y: number) =>
    table(id, { id, label: id, type: 'round', capacity: 8, x, y, rotation: 0, sizeUnits: { shape: 'circle', diameter: 150 } })
  const long = (id: string, x: number, y: number, rotation: number) =>
    table(id, { id, label: id, type: 'rect', capacity: 8, x, y, rotation, sizeUnits: { shape: 'rect', width: 300, height: 80 } })
  const overlaps = (tables: Record<string, Table>) =>
    computeWarnings({ tables, settings }).filter((w) => w.kind === 'overlap')

  it('are one warning naming both, when the tables themselves overlap', () => {
    const w = overlaps({ a: round('Table 1', 0, 0), b: round('Table 2', 140, 0) })
    expect(w).toHaveLength(1)
    expect(w[0].message).toBe('Table 1 and Table 2 overlap. Move one so the chairs clear.')
    expect(w[0].tableIds).toEqual(['Table 1', 'Table 2'])
  })

  it('count the chairs, not only the tables', () => {
    // 200 apart the tables clear by 50, but the chairs facing each other do not.
    expect(overlaps({ a: round('Table 1', 0, 0), b: round('Table 2', 200, 0) })).toHaveLength(1)
  })

  it('say nothing when the tables and their chairs are clear', () => {
    expect(overlaps({ a: round('Table 1', 0, 0), b: round('Table 2', 300, 0) })).toHaveLength(0)
  })

  it('turn a rectangle with its rotation', () => {
    // Two long tables 200 apart: side by side they clear, but turned across
    // the gap the second one reaches into the first.
    expect(overlaps({ a: long('Table 1', 0, 0, 0), b: long('Table 2', 0, 200, 0) })).toHaveLength(0)
    expect(overlaps({ a: long('Table 1', 0, 0, 0), b: long('Table 2', 0, 200, 90) })).toHaveLength(1)
  })
})
