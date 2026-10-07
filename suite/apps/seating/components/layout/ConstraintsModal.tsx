import { useState, useMemo } from 'react'
import clsx from 'clsx'
import type { ConstraintKind } from '@/lib/model/types'
import { ruleFor } from '../../store/actions'
import { useStore } from '../../store/useStore'
import { computeWarnings } from '../../utils/warnings'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import IconButton from '../ui/IconButton'
import f from '../sidebar/fields.module.css'
import styles from './ConstraintsModal.module.css'

export default function ConstraintsModal() {
  const guests = useStore((s) => s.guests)
  const tables = useStore((s) => s.tables)
  const constraints = useStore((s) => s.constraints)
  const addConstraint = useStore((s) => s.addConstraint)
  const removeConstraint = useStore((s) => s.removeConstraint)
  const closeModal = useStore((s) => s.closeModal)

  const sorted = useMemo(
    () => Object.values(guests).sort((a, b) => String(a.fullName).localeCompare(b.fullName)),
    [guests]
  )

  const [kind, setKind] = useState<ConstraintKind>('apart')
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [broken, setBroken] = useState('')
  /** Any change to the form, or to the rules, moves on from the rule the notice was about. */
  const moveOn =
    <T,>(change: (value: T) => void) =>
    (value: T) => {
      setBroken('')
      change(value)
    }

  const paired = a && b ? ruleFor(constraints, a, b) : undefined
  const ready = Boolean(a && b && a !== b && !paired)

  const add = () => {
    if (!ready) return
    addConstraint({ kind, guestIds: [a, b] })
    // Allowed, since a rule is often set just before fixing the plan, but said
    // here rather than left for the warning badge behind the dialog.
    const rule = { id: 'new', kind, guestIds: [a, b] as [string, string], note: '' }
    const warning = computeWarnings({ guests, tables, constraints: [rule] }).find((w) => w.id === `cst_${rule.id}`)
    setBroken(warning ? `Already broken: ${warning.message}` : '')
    setA('')
    setB('')
  }

  const nameOf = (id: string) => guests[id]?.fullName || 'Unknown'

  return (
    <Modal
      title="Seating rules"
      onClose={closeModal}
      footer={
        <Button variant="primary" onClick={closeModal}>
          Done
        </Button>
      }
    >
      <p className={styles.intro}>
        Add rules and Seating will flag a warning if a plan breaks them — it never blocks you.
      </p>

      <div className={styles.builder}>
        <div className={f.segmented}>
          <button
            type="button"
            className={clsx(f.segment, kind === 'apart' && f.segmentActive)}
            onClick={() => moveOn(setKind)('apart')}
          >
            Shouldn&rsquo;t sit together
          </button>
          <button
            type="button"
            className={clsx(f.segment, kind === 'together' && f.segmentActive)}
            onClick={() => moveOn(setKind)('together')}
          >
            Should sit together
          </button>
        </div>
        <div className={styles.pair}>
          <select className={f.select} value={a} onChange={(e) => moveOn(setA)(e.target.value)}>
            <option value="">Choose a guest…</option>
            {sorted.map((g) => (
              <option key={g.id} value={g.id}>
                {g.fullName}
              </option>
            ))}
          </select>
          <span className={styles.amp}>and</span>
          <select className={f.select} value={b} onChange={(e) => moveOn(setB)(e.target.value)}>
            <option value="">Choose a guest…</option>
            {sorted.map((g) => (
              <option key={g.id} value={g.id}>
                {g.fullName}
              </option>
            ))}
          </select>
          <Button variant="secondary" icon="plus" disabled={!ready} onClick={add}>
            Add
          </Button>
        </div>
        <p role="status" className={styles.broken}>
          {broken}
        </p>
        {paired && (
          <p className={styles.none}>
            These two already have a rule. Remove it below to change it.
          </p>
        )}
      </div>

      {constraints.length > 0 ? (
        <ul className={styles.list}>
          {constraints.map((c) => (
            <li key={c.id} className={styles.rule}>
              <span className={clsx(styles.tag, c.kind === 'apart' ? styles.apart : styles.together)}>
                {c.kind === 'apart' ? 'Apart' : 'Together'}
              </span>
              <span className={styles.names}>
                {nameOf(c.guestIds[0])} &amp; {nameOf(c.guestIds[1])}
              </span>
              <IconButton
                icon="trash"
                label="Remove rule"
                size={26}
                iconSize={14}
                onClick={() => moveOn(removeConstraint)(c.id)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.none}>No rules yet.</p>
      )}
    </Modal>
  )
}
