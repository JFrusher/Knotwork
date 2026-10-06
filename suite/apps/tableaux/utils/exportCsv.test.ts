import { describe, it, expect } from 'vitest'
import { buildAssignmentCsv, type PlanSource } from './exportCsv'
import type { Guest, Table } from '../store/types'

const guest = (id: string, fullName: string, extra: Partial<Guest> = {}) =>
  ({
  id,
  fullName,
  firstName: '',
  lastName: '',
  side: null,
  rsvpStatus: 'confirmed',
  dietary: '',
  notes: '',
  groupId: null,
  assignedTableId: null,
  ...extra,
  }) as Guest

describe('buildAssignmentCsv', () => {
  it('neutralises spreadsheet formula injection in guest fields', () => {
    const csv = buildAssignmentCsv({
      guests: { g1: guest('g1', '=1+1') },
      tables: {},
      groups: {},
    } as unknown as PlanSource)
    expect(csv).toContain("'=1+1") // prefixed with a quote
    expect(csv).not.toMatch(/(^|,)=1\+1/m) // never a bare formula at a cell start
  })

  it('lists seated guests under their table', () => {
    const csv = buildAssignmentCsv({
      guests: { g1: guest('g1', 'Amy', { assignedTableId: 't1' }) },
      tables: { t1: { id: 't1', label: 'Table 1', seatMode: 'table', assignedGuestIds: ['g1'] } as Table },
      groups: {},
    } as unknown as PlanSource)
    expect(csv).toContain('Table 1')
    expect(csv).toContain('Amy')
  })
})

describe('the subgroup and family columns', () => {
  it('follow Group, so the three nest left to right, and Notes stays last', () => {
    const csv = buildAssignmentCsv({
      guests: { g1: guest('g1', 'Ada Okafor', { assignedTableId: 't1', groupId: 'grp', subgroupId: 'sub', familyId: 'fam' }) },
      tables: { t1: { id: 't1', label: 'Table 1', seatMode: 'table', assignedGuestIds: ['g1'] } as Table },
      groups: { grp: { id: 'grp', name: 'Work', colour: '#000', memberIds: ['g1'] } },
      subgroups: { sub: { id: 'sub', name: 'Analysts', colour: '#000', parentGroupId: 'grp', memberIds: ['g1'] } },
      families: { fam: { id: 'fam', name: 'Okafor', colour: '#000', parentGroupId: null, parentSubgroupId: 'sub', memberIds: ['g1'] } },
    } as unknown as PlanSource)
    const [headers, row] = csv.trim().split('\r\n')
    expect(headers).toBe('Table,Seat,Guest,Side,RSVP,Dietary,Group,Subgroup,Family,Notes')
    expect(row).toBe('Table 1,,Ada Okafor,,confirmed,,Work,Analysts,Okafor,')
  })
})
