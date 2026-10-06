import { describe, it, expect } from 'vitest'
import { computeWarnings, buildWarningIndex } from './warnings'

const guest = (id, over = {}) => ({
  id,
  fullName: id,
  dietary: '',
  rsvpStatus: 'confirmed',
  assignedTableId: null,
  ...over,
})
const table = (id, over = {}) => ({
  id,
  label: id,
  type: 'round',
  capacity: 8,
  designation: null,
  assignedGuestIds: [],
  ...over,
})

describe('computeWarnings', () => {
  it('flags an over-capacity table', () => {
    const state = {
      guests: { a: guest('a'), b: guest('b'), c: guest('c') },
      tables: { t: table('t', { capacity: 2, assignedGuestIds: ['a', 'b', 'c'] }) },
      constraints: [],
    }
    const w = computeWarnings(state)
    expect(w.some((x) => x.kind === 'over-capacity' && x.tableId === 't')).toBe(true)
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
    const guests = {}
    for (let i = 0; i < 10; i++) guests[`g${i}`] = guest(`g${i}`, { assignedTableId: i < 6 ? 't' : null })
    const w = computeWarnings({ guests, tables: { t: table('t') }, constraints: [] })
    expect(w.some((x) => x.kind === 'unassigned')).toBe(true)
  })

  it('honours "apart" and "together" constraints', () => {
    const apart = computeWarnings({
      guests: { a: guest('a', { assignedTableId: 't' }), b: guest('b', { assignedTableId: 't' }) },
      tables: { t: table('t', { assignedGuestIds: ['a', 'b'] }) },
      constraints: [{ id: 'c1', kind: 'apart', guestIds: ['a', 'b'] }],
    })
    expect(apart.some((x) => x.kind === 'apart')).toBe(true)

    const together = computeWarnings({
      guests: { a: guest('a', { assignedTableId: 't1' }), b: guest('b', { assignedTableId: 't2' }) },
      tables: { t1: table('t1', { assignedGuestIds: ['a'] }), t2: table('t2', { assignedGuestIds: ['b'] }) },
      constraints: [{ id: 'c2', kind: 'together', guestIds: ['a', 'b'] }],
    })
    expect(together.some((x) => x.kind === 'together')).toBe(true)
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

describe('buildWarningIndex', () => {
  it('indexes warnings by table and guest', () => {
    const { byTable, byGuest } = buildWarningIndex([
      { id: 'w1', tableId: 't', message: 'x' },
      { id: 'w2', guestId: 'g', message: 'y' },
    ])
    expect(byTable.get('t')).toHaveLength(1)
    expect(byGuest.get('g')).toHaveLength(1)
  })
})

describe('a split family', () => {
  // Five members across two tables, as in the issue.
  const split = () => ({
    guests: {
      a: guest('a', { assignedTableId: 't1' }),
      b: guest('b', { assignedTableId: 't1' }),
      c: guest('c', { assignedTableId: 't1' }),
      d: guest('d', { assignedTableId: 't2' }),
      e: guest('e', { assignedTableId: 't2' }),
    },
    tables: {
      t1: table('t1', { label: 'Table 1', assignedGuestIds: ['a', 'b', 'c'] }),
      t2: table('t2', { label: 'Table 4', assignedGuestIds: ['d', 'e'] }),
    },
    constraints: [],
    families: { f: { id: 'f', name: 'Okafor', memberIds: ['a', 'b', 'c', 'd', 'e'] } },
  })

  it('is one warning naming the family and the tables it is split across', () => {
    const family = computeWarnings(split()).filter((w) => w.kind === 'family-split')
    expect(family).toHaveLength(1)
    expect(family[0].message).toBe('The "Okafor" family is split across Table 1 and Table 4.')
  })

  it('still badges every member and every table it is split across', () => {
    const { byTable, byGuest } = buildWarningIndex(computeWarnings(split()))
    for (const id of ['t1', 't2']) expect(byTable.get(id)).toHaveLength(1)
    for (const id of ['a', 'b', 'c', 'd', 'e']) expect(byGuest.get(id)).toHaveLength(1)
  })
})
