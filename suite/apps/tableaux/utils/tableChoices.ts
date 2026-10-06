import type { Table } from '../store/types'

/** Every table, in label order, with how many seats are free at it. */
export function tableChoices(tables: Record<string, Pick<Table, 'id' | 'label' | 'capacity' | 'assignedGuestIds'>>) {
  return Object.values(tables)
    .map((t) => ({ id: t.id, label: t.label, free: t.capacity - (t.assignedGuestIds || []).filter(Boolean).length }))
    .sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }))
}
