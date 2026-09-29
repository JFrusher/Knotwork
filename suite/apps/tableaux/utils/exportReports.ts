import { DIETARY_META, dietaryMeta } from '@/lib/model/dietary'
import { sideShort } from '@/lib/model/partners'
import { isComing } from '@/lib/model/slices'
import { getTableType } from './tableTypes'
import { toCsv, type PlanSource } from './exportCsv'
import { downloadFile, slug } from './download'

/**
 * Vendor/caterer reporting built purely from the live document — works in both
 * SaaS and local modes since it never touches the server. Each builder returns
 * `{ headers, rows }` (arrays of arrays) so the same data shapes back both the
 * CSV report and the XLSX workbook (single source of truth).
 */

/** Headcount by dietary requirement among non-declined guests. */
export function buildDietaryTotals(state: PlanSource): { headers: string[]; rows: Array<[string, number]> } {
  const { guests = {} } = state
  const counts: Record<string, number> = {}
  let standard = 0
  let total = 0
  for (const g of Object.values(guests)) {
    if (!isComing(g)) continue
    total++
    const key = g.dietary || ''
    if (!key) standard++
    else counts[key] = (counts[key] || 0) + 1
  }
  const rows: Array<[string, number]> = []
  rows.push(['Standard / no requirement', standard])
  Object.values(DIETARY_META)
    .filter((meta) => counts[meta.key])
    .forEach((meta) => rows.push([meta.label, counts[meta.key]]))
  // any unknown keys not in DIETARY_META
  Object.keys(counts)
    .filter((k) => !dietaryMeta(k))
    .forEach((k) => rows.push([k, counts[k]]))
  rows.push(['Total attending', total])
  return { headers: ['Dietary requirement', 'Guests'], rows }
}

/** Per-table summary: occupancy, capacity, dietary breakdown, side mix. */
export function buildPerTableSummary(state: PlanSource): { headers: string[]; rows: Array<Array<string | number>> } {
  const { guests = {}, tables = {}, meta } = state
  const headers = ['Table', 'Seated', 'Capacity', 'Dietary', sideShort('a', meta), sideShort('b', meta)]
  const rows: Array<Array<string | number>> = []
  const tableList = Object.values(tables).sort((a, b) =>
    String(a.label).localeCompare(String(b.label), undefined, { numeric: true })
  )
  for (const t of tableList) {
    const ids = (t.assignedGuestIds || []).filter((id): id is string => Boolean(id))
    const diet: Record<string, number> = {}
    let a = 0
    let b = 0
    for (const gid of ids) {
      const g = guests[gid]
      if (!g) continue
      if (g.dietary) {
        const ab = dietaryMeta(g.dietary)?.abbrev || g.dietary
        diet[ab] = (diet[ab] || 0) + 1
      }
      if (g.side === 'a') a++
      else if (g.side === 'b') b++
    }
    const dietStr = Object.entries(diet)
      .map(([ab, n]) => `${n} ${ab}`)
      .join(', ')
    rows.push([
      t.label,
      ids.length,
      t.capacity ?? getTableType(t.type).defaultCapacity,
      dietStr,
      a || '',
      b || '',
    ])
  }
  return { headers, rows }
}

/** A single CSV report combining dietary totals and the per-table summary. */
export function buildReportCsv(state: PlanSource): string {
  const diet = buildDietaryTotals(state)
  const perTable = buildPerTableSummary(state)
  return (
    toCsv(diet.headers, diet.rows) +
    '\r\n' +
    toCsv(perTable.headers, perTable.rows)
  )
}

export function exportReportCsv(state: PlanSource, name: string): void {
  downloadFile(`${slug(name)}-report.csv`, buildReportCsv(state), 'text/csv')
}
