import { useMemo, useState } from 'react'
import { useStore } from '../../store/useStore'
import { tableChoices } from '../../utils/tableChoices'
import IconButton from '../ui/IconButton'
import Button from '../ui/Button'
import f from './fields.module.css'
import styles from './GuestInspector.module.css'

/**
 * Several guests selected in the guest panel: how many, and the few things
 * worth doing to all of them at once. Each is one step on the undo history.
 */
export default function SelectionPanel({ guestIds }: { guestIds: string[] }) {
  const tables = useStore((s) => s.tables)
  const groups = useStore((s) => s.groups)
  const guests = useStore((s) => s.guests)
  const seatGuests = useStore((s) => s.seatGuests)
  const familyFrom = useStore((s) => s.familyFrom)
  const addGuestsToGroup = useStore((s) => s.addGuestsToGroup)
  const createGroup = useStore((s) => s.createGroup)
  const clearSelection = useStore((s) => s.clearSelection)
  const [refused, setRefused] = useState('')
  const choices = useMemo(() => tableChoices(tables), [tables])

  const seatAt = (tableId: string) => {
    const table = choices.find((t) => t.id === tableId)
    if (!table) return
    // Those already at this table need no seat of their own.
    const incoming = guestIds.filter((id) => guests[id]?.assignedTableId !== tableId).length
    if (incoming > table.free) {
      setRefused(`${table.label} has ${table.free} free ${table.free === 1 ? 'seat' : 'seats'}, not ${incoming}.`)
      return
    }
    setRefused('')
    seatGuests(guestIds, tableId)
  }

  return (
    <div className={styles.inspector}>
      <header className={styles.header}>
        <h2 className={f.label}>{guestIds.length} guests selected</h2>
        <IconButton icon="x" label="Clear selection" size={32} iconSize={15} onClick={clearSelection} />
      </header>

      <div className={f.group}>
        <Button variant="secondary" icon="users" onClick={() => familyFrom(guestIds)}>
          Make a family
        </Button>
      </div>

      <div className={f.group}>
        <span className={f.label}>Seat them at</span>
        <select className={f.select} aria-label="Seat them at" value="" onChange={(e) => e.target.value && seatAt(e.target.value)}>
          <option value="">Choose a table…</option>
          {choices.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label} — {t.free <= 0 ? 'full' : `${t.free} free`}
            </option>
          ))}
        </select>
        <p role="status" className={styles.unassigned}>
          {refused}
        </p>
      </div>

      <div className={f.group}>
        <span className={f.label}>Add them to</span>
        <select
          className={f.select}
          aria-label="Add them to"
          value=""
          onChange={(e) => {
            const v = e.target.value
            if (v === '__new__') createGroup(guestIds)
            else if (v) addGuestsToGroup(v, guestIds)
          }}
        >
          <option value="">Choose a group…</option>
          {Object.values(groups).map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
          <option value="__new__">+ New group…</option>
        </select>
      </div>
    </div>
  )
}
