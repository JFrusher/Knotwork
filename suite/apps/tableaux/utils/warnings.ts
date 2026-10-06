import { isComing } from '@/lib/model/slices'
import type { Constraint, Family, Guest, Table } from '../store/types'
import { getTableType } from './tableTypes'

export interface SeatingWarning {
  id: string
  level: 'warn' | 'info'
  kind: 'over-capacity' | 'dietary-check' | 'empty-special' | 'unassigned' | 'apart' | 'together' | 'family-split'
  message: string
  tableId?: string | null
  guestId?: string
  /** For a warning about several tables or people, all of them, for badges. */
  tableIds?: string[]
  guestIds?: string[]
}

/**
 * Pure rules engine. Given the document, returns a flat list of warnings:
 *   { id, level: 'warn' | 'info', kind, message, tableId?, guestId? }
 * Surfaced as amber badges on tables/cards and in the warnings panel; never
 * blocks the user.
 */
type WarnedGuest = Pick<Guest, 'id' | 'fullName' | 'dietary' | 'dietaryRaw' | 'assignedTableId' | 'rsvpStatus'>
type WarnedTable = Pick<Table, 'id' | 'label' | 'type' | 'capacity' | 'designation' | 'assignedGuestIds'>
type WarnedFamily = Pick<Family, 'id' | 'name' | 'memberIds'>

/** Only what the rules read, so anything holding a plan's shape can be checked. */
export function computeWarnings(state: {
  guests?: Record<string, WarnedGuest>
  tables?: Record<string, WarnedTable>
  constraints?: Constraint[]
  families?: Record<string, WarnedFamily>
}): SeatingWarning[] {
  const { guests = {}, tables = {}, constraints = [], families = {} } = state
  const guestList = Object.values(guests)
  const tableList = Object.values(tables)
  const out: SeatingWarning[] = []

  for (const t of tableList) {
    const ids = (t.assignedGuestIds || []).filter((id): id is string => Boolean(id))
    const seated = ids.length

    if (seated > t.capacity) {
      out.push({
        id: `cap_${t.id}`,
        level: 'warn',
        kind: 'over-capacity',
        tableId: t.id,
        message: `${t.label} is over capacity (${seated}/${t.capacity}).`,
      })
    }

    const gs = ids.map((id) => guests[id]).filter(Boolean)
    // A note is anything the guest said: "None" is an answer, and is kept in
    // `dietaryRaw` while `dietary` holds only a requirement.
    const noted = (g: WarnedGuest) => Boolean(g.dietary || g.dietaryRaw?.trim())
    const withDiet = gs.filter(noted).length
    const without = gs.filter((g) => !noted(g)).length
    if (withDiet > 0 && without > 0) {
      out.push({
        id: `diet_${t.id}`,
        level: 'info',
        kind: 'dietary-check',
        tableId: t.id,
        message: `${t.label}: ${without} ${
          without === 1 ? 'guest has' : 'guests have'
        } no dietary note while others do — worth checking.`,
      })
    }

    const isSpecial =
      t.type === 'sweetheart' || t.type === 'top-table' || t.designation === 'top-table'
    if (isSpecial && seated === 0) {
      out.push({
        id: `special_${t.id}`,
        level: 'info',
        kind: 'empty-special',
        tableId: t.id,
        message: `${t.label} (your ${getTableType(t.type).label.toLowerCase()}) has no one seated yet.`,
      })
    }
  }

  const eligible = guestList.filter(isComing)
  const unassigned = eligible.filter((g) => !g.assignedTableId).length
  if (eligible.length > 0 && unassigned / eligible.length > 0.3) {
    out.push({
      id: 'unassigned',
      level: 'info',
      kind: 'unassigned',
      message: `${unassigned} of ${eligible.length} guests (${Math.round(
        (unassigned / eligible.length) * 100
      )}%) are still unseated.`,
    })
  }

  for (const c of constraints) {
    const [a, b] = c.guestIds || []
    const ga = guests[a]
    const gb = guests[b]
    if (!ga || !gb) continue
    if (
      c.kind === 'apart' &&
      ga.assignedTableId &&
      ga.assignedTableId === gb.assignedTableId
    ) {
      out.push({
        id: `cst_${c.id}`,
        level: 'warn',
        kind: 'apart',
        tableId: ga.assignedTableId,
        guestId: a,
        message: `${ga.fullName} and ${gb.fullName} shouldn't sit together — both are at ${tables[ga.assignedTableId]?.label}.`,
      })
    }
    if (
      c.kind === 'together' &&
      ga.assignedTableId &&
      gb.assignedTableId &&
      ga.assignedTableId !== gb.assignedTableId
    ) {
      out.push({
        id: `cst_${c.id}`,
        level: 'warn',
        kind: 'together',
        guestId: a,
        message: `${ga.fullName} and ${gb.fullName} should sit together, but they're at different tables.`,
      })
    }
  }

  // One warning per family, however many members are apart.
  for (const f of Object.values(families)) {
    const seated = (f.memberIds || [])
      .map((id) => guests[id])
      .filter((g): g is WarnedGuest => Boolean(g && g.assignedTableId))
    const tableIds = [...new Set(seated.map((g) => g.assignedTableId as string))]
    if (tableIds.length > 1) {
      const labels = tableIds.map((id) => tables[id]?.label || 'a table')
      out.push({
        id: `fam_${f.id}`,
        level: 'warn',
        kind: 'family-split',
        guestId: seated[0].id,
        guestIds: seated.map((g) => g.id),
        tableIds,
        message: `The "${f.name}" family is split across ${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}.`,
      })
    }
  }

  return out
}

export function buildWarningIndex(list: SeatingWarning[]): {
  byTable: Map<string, SeatingWarning[]>
  byGuest: Map<string, SeatingWarning[]>
} {
  const byTable = new Map<string, SeatingWarning[]>()
  const byGuest = new Map<string, SeatingWarning[]>()
  for (const w of list) {
    for (const id of w.tableIds ?? (w.tableId ? [w.tableId] : [])) {
      if (!byTable.has(id)) byTable.set(id, [])
      byTable.get(id)!.push(w)
    }
    for (const id of w.guestIds ?? (w.guestId ? [w.guestId] : [])) {
      if (!byGuest.has(id)) byGuest.set(id, [])
      byGuest.get(id)!.push(w)
    }
  }
  return { byTable, byGuest }
}
