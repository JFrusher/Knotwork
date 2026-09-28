import { describe, it, expect } from 'vitest'
import { buildDietaryTotals, buildPerTableSummary, buildReportCsv } from './exportReports.js'

const state = () => ({
  guests: {
    g1: { id: 'g1', fullName: 'A', dietary: 'vegan', side: 'a', rsvpStatus: 'confirmed' },
    g2: { id: 'g2', fullName: 'B', dietary: 'vegan', side: 'b', rsvpStatus: 'confirmed' },
    g3: { id: 'g3', fullName: 'C', dietary: '', side: 'a', rsvpStatus: 'confirmed' },
    g4: { id: 'g4', fullName: 'D', dietary: 'gluten-free', side: null, rsvpStatus: 'declined' },
  },
  tables: {
    t1: { id: 't1', label: 'Table 1', type: 'round', capacity: 8, assignedGuestIds: ['g1', 'g2'] },
  },
  groups: {},
  meta: { partners: ['Alex', 'Sam'] },
})

describe('buildDietaryTotals', () => {
  it('counts requirements, excludes declined, totals attendees', () => {
    const { rows } = buildDietaryTotals(state())
    const map = Object.fromEntries(rows)
    expect(map['Vegan']).toBe(2)
    expect(map['Standard / no requirement']).toBe(1)
    expect(map['Total attending']).toBe(3) // declined g4 excluded
    expect(map['Gluten-free']).toBeUndefined() // only the declined guest had it
  })
})

describe('buildPerTableSummary', () => {
  it('summarises seated count, dietary and side mix per table', () => {
    const { headers, rows } = buildPerTableSummary(state())
    // The side columns are the partners', by name.
    expect(headers.slice(-2)).toEqual(['Alex’s', 'Sam’s'])
    const [label, seated, capacity, diet, a, b] = rows[0]
    expect(label).toBe('Table 1')
    expect(seated).toBe(2)
    expect(capacity).toBe(8)
    expect(diet).toContain('2 VG')
    expect(a).toBe(1)
    expect(b).toBe(1)
  })
})

describe('buildReportCsv', () => {
  it('neutralises formula-injection in labels', () => {
    const s = state()
    s.tables.t1.label = '=cmd()'
    const csv = buildReportCsv(s)
    expect(csv).toContain("'=cmd()")
  })
})
