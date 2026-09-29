import { sideShort } from '@/lib/model/partners'
import { isComing } from '@/lib/model/slices'
import type { Guest, Plan } from '../store/types'
import { downloadFile, slug } from './download'

type Cell = string | number | null | undefined

/** What the exports read: the plan, or as much of it as they need. */
export type PlanSource = Partial<Plan> & Pick<Plan, 'meta'>

// Cells beginning with these characters can be executed as formulas by Excel /
// Google Sheets; prefix with a quote to neutralise spreadsheet injection.
const FORMULA_LEAD = /^[=+\-@\t\r]/
export const escCsvCell = (v: Cell): string => {
  let s = v == null ? '' : String(v)
  if (FORMULA_LEAD.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const esc = escCsvCell
export const toCsv = (headers: Cell[], rows: Cell[][]): string =>
  [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n'

/** "Alex's", "Sam's", "Both", after the partners in the plan's `meta`. */
const sideLabel = (side: Guest['side'], meta: Plan['meta']): string =>
  side === 'a' || side === 'b' || side === 'both' ? sideShort(side, meta) : ''

// TODO(family-ux): headers below have a Group column but no Subgroup or
// Family column — inconsistent with exportXlsx.js's buildGroupSheetRows,
// which already has Group/Subgroup/Family. See tmp/family-ux-followups.md #6.
/** Caterer-friendly assignment rows, ordered by table then seat. */
export function buildAssignmentTable(state: PlanSource): { headers: string[]; rows: Cell[][] } {
  const { guests = {}, tables = {}, groups = {} } = state
  const headers = ['Table', 'Seat', 'Guest', 'Side', 'RSVP', 'Dietary', 'Group', 'Notes']
  const rows: Cell[][] = []

  const tableList = Object.values(tables).sort((a, b) =>
    String(a.label).localeCompare(String(b.label), undefined, { numeric: true })
  )
  const seated = new Set<string>()

  for (const t of tableList) {
    for (const [idx, gid] of (t.assignedGuestIds || []).entries()) {
      const g = gid ? guests[gid] : undefined
      if (!g || !gid) continue
      seated.add(gid)
      rows.push([
        t.label,
        t.seatMode === 'seat' ? String(idx + 1) : '',
        g.fullName,
        sideLabel(g.side, state.meta),
        g.rsvpStatus || '',
        g.dietary || '',
        (g.groupId && groups[g.groupId]?.name) || '',
        g.notes || '',
      ])
    }
  }

  Object.values(guests)
    .filter((g) => !seated.has(g.id) && isComing(g))
    .sort((a, b) => String(a.fullName).localeCompare(b.fullName))
    .forEach((g) => {
      rows.push([
        '(Unassigned)',
        '',
        g.fullName,
        sideLabel(g.side, state.meta),
        g.rsvpStatus || '',
        g.dietary || '',
        (g.groupId && groups[g.groupId]?.name) || '',
        g.notes || '',
      ])
    })

  return { headers, rows }
}

export function buildAssignmentCsv(state: PlanSource): string {
  const { headers, rows } = buildAssignmentTable(state)
  return toCsv(headers, rows)
}

export function exportCsv(state: PlanSource, name: string): void {
  downloadFile(`${slug(name)}-assignments.csv`, buildAssignmentCsv(state), 'text/csv')
}
