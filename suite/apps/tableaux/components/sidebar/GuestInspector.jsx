import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { useStore } from '../../store/useStore'
import { DIETARY_META, normaliseDietary } from '@/lib/model/dietary'
import { partnerNames } from '@/lib/model/partners'
import Icon from '../ui/Icon'
import IconButton from '../ui/IconButton'
import Button from '../ui/Button'
import TextField from './TextField'
import f from './fields.module.css'
import styles from './GuestInspector.module.css'

const RSVPS = ['confirmed', 'pending', 'declined']

export default function GuestInspector({ guestId }) {
  const guest = useStore((s) => s.guests[guestId])
  const groups = useStore((s) => s.groups)
  const table = useStore((s) => (guest?.assignedTableId ? s.tables[guest.assignedTableId] : null))
  const updateGuest = useStore((s) => s.updateGuest)
  const addToGroup = useStore((s) => s.addToGroup)
  const createGroup = useStore((s) => s.createGroup)
  const removeFromGroup = useStore((s) => s.removeFromGroup)
  const unassignGuest = useStore((s) => s.unassignGuest)
  const assignGuest = useStore((s) => s.assignGuest)
  const tables = useStore((s) => s.tables)
  const removeGuest = useStore((s) => s.removeGuest)
  // Whose side, in the partners' names.
  const meta = useStore((s) => s.meta)
  const [nameA, nameB] = partnerNames(meta)
  const sides = [
    { value: 'a', label: nameA },
    { value: 'b', label: nameB },
    { value: 'both', label: 'Both' },
  ]
  const select = useStore((s) => s.select)
  const clearSelection = useStore((s) => s.clearSelection)
  const openModal = useStore((s) => s.openModal)

  const [tagDraft, setTagDraft] = useState('')

  // Every table, by its label, with how many seats are left. The way to seat
  // someone without dragging — which is the only way from a keyboard.
  const tableChoices = useMemo(
    () =>
      Object.values(tables)
        .map((t) => ({
          id: t.id,
          label: t.label,
          free: t.capacity - (t.assignedGuestIds || []).filter(Boolean).length,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true })),
    [tables]
  )

  if (!guest) return null

  const seatIndex =
    guest.assignedSeatId && table
      ? (table.assignedGuestIds || []).indexOf(guest.id)
      : -1

  const addTag = () => {
    const t = tagDraft.trim()
    if (!t) return
    if (!(guest.tags || []).includes(t)) updateGuest(guestId, { tags: [...(guest.tags || []), t] })
    setTagDraft('')
  }
  const removeTag = (t) =>
    updateGuest(guestId, { tags: (guest.tags || []).filter((x) => x !== t) })

  const handleDelete = () =>
    openModal('confirm', {
      title: 'Delete guest?',
      message: `"${guest.fullName}" will be permanently removed from the plan.`,
      confirmLabel: 'Delete guest',
      danger: true,
      onConfirm: () => {
        removeGuest(guestId)
        clearSelection()
      },
    })

  return (
    <div className={styles.inspector}>
      <header className={styles.header}>
        <span className={f.label}>Guest</span>
        <IconButton icon="x" label="Close" size={32} iconSize={15} onClick={clearSelection} />
      </header>

      <div className={f.group}>
        <div className={f.row}>
          <div className={clsx(f.field, f.grow)}>
            <span className={f.label}>First</span>
            <TextField
              className={f.input}
              aria-label="First name"
              value={guest.firstName}
              onCommit={(v) => updateGuest(guestId, { firstName: v })}
            />
          </div>
          <div className={clsx(f.field, f.grow)}>
            <span className={f.label}>Last</span>
            <TextField
              className={f.input}
              aria-label="Last name"
              value={guest.lastName}
              onCommit={(v) => updateGuest(guestId, { lastName: v })}
            />
          </div>
        </div>
        <div className={f.field}>
          <span className={f.label}>Email</span>
          <TextField
            className={f.input}
            type="email"
            aria-label="Guest email"
            value={guest.email}
            onCommit={(v) => updateGuest(guestId, { email: v })}
          />
        </div>
      </div>

      <div className={f.group}>
        <div className={f.field}>
          <span className={f.label}>Dietary</span>
          <TextField
            className={f.input}
            list="diet-suggestions"
            aria-label="Dietary requirements"
            placeholder="None"
            value={guest.dietaryRaw || ''}
            onCommit={(v) =>
              updateGuest(guestId, { dietaryRaw: v, dietary: normaliseDietary(v) })
            }
          />
          <datalist id="diet-suggestions">
            {Object.values(DIETARY_META)
              .filter((d) => d.key !== 'other')
              .map((d) => (
                <option key={d.key} value={d.label} />
              ))}
          </datalist>
        </div>

        <div className={f.field}>
          <span className={f.label}>Side</span>
          <div className={f.segmented}>
            {sides.map((s) => (
              <button
                key={s.value}
                type="button"
                className={clsx(f.segment, guest.side === s.value && f.segmentActive)}
                onClick={() =>
                  updateGuest(guestId, { side: guest.side === s.value ? null : s.value })
                }
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className={f.field}>
          <span className={f.label}>RSVP</span>
          <select
            className={f.select}
            aria-label="RSVP status"
            value={guest.rsvpStatus}
            onChange={(e) => updateGuest(guestId, { rsvpStatus: e.target.value })}
          >
            {RSVPS.map((r) => (
              <option key={r} value={r}>
                {r[0].toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className={f.field}>
          <span className={f.label}>Group</span>
          <select
            className={f.select}
            aria-label="Group"
            value={guest.groupId || ''}
            onChange={(e) => {
              const v = e.target.value
              // Sentinel: create a brand-new group containing this guest.
              if (v === '__new__') createGroup([guestId])
              else if (v) addToGroup(v, guestId)
              else removeFromGroup(guestId)
            }}
          >
            <option value="">No group</option>
            {Object.values(groups).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
            <option value="__new__">+ New group…</option>
          </select>
        </div>
      </div>
      {/* TODO(family-ux): subgroup/family membership is invisible here — the
          store has guest.subgroupId/guest.familyId but neither is read or
          shown anywhere in this panel, only the sidebar tree shows them.
          See tmp/family-ux-followups.md #7. */}

      <div className={f.group}>
        <span className={f.label}>Seating</span>
        {table ? (
          <div className={styles.assignment}>
            <button
              type="button"
              className={styles.tableLink}
              onClick={() => select('table', table.id)}
            >
              <Icon name="maximize" size={14} />
              {table.label}
              {seatIndex >= 0 && <span className={styles.seatNo}>· seat {seatIndex + 1}</span>}
            </button>
            <IconButton
              icon="x"
              label="Remove from table"
              size={26}
              iconSize={14}
              onClick={() => unassignGuest(guestId)}
            />
          </div>
        ) : (
          <p className={styles.unassigned}>Not seated. Drag onto a table, or choose one below.</p>
        )}
        <select
          className={f.select}
          aria-label="Seat at table"
          value={guest.assignedTableId || ''}
          onChange={(e) => {
            if (e.target.value) assignGuest(guestId, e.target.value)
            else unassignGuest(guestId)
          }}
        >
          <option value="">No table</option>
          {tableChoices.map((t) => (
            <option
              key={t.id}
              value={t.id}
              disabled={t.free <= 0 && t.id !== guest.assignedTableId}
            >
              {t.label} — {t.free <= 0 ? 'full' : `${t.free} free`}
            </option>
          ))}
        </select>
      </div>

      <div className={f.group}>
        <span className={f.label}>Notes</span>
        <TextField
          as="textarea"
          className={f.textarea}
          aria-label="Notes"
          placeholder="Allergies, accessibility, who they should sit near…"
          value={guest.notes || ''}
          onCommit={(v) => updateGuest(guestId, { notes: v })}
        />
      </div>

      <div className={f.group}>
        <span className={f.label}>Tags</span>
        <div className={styles.tags}>
          {(guest.tags || []).map((t) => (
            <button key={t} type="button" className={styles.tag} onClick={() => removeTag(t)}>
              {t}
              <Icon name="x" size={11} />
            </button>
          ))}
        </div>
        <input
          className={f.input}
          aria-label="Add a tag"
          placeholder="Add a tag, press Enter"
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addTag()
            }
          }}
        />
      </div>

      <div className={f.group}>
        <Button variant="danger" icon="trash" fullWidth onClick={handleDelete}>
          Delete guest
        </Button>
      </div>
    </div>
  )
}
