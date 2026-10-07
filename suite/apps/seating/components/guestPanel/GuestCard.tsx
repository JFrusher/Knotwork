import { memo, type MouseEvent } from 'react'
import type { Side } from '@/lib/model/types'
import type { Guest, Meta } from '../../store/types'
import { useDraggable } from '@dnd-kit/core'
import clsx from 'clsx'
import { useStore } from '../../store/useStore'
import Icon from '../ui/Icon'
import { useGuestWarnings } from '../../store/warningsContext'
import { dietaryMeta } from '@/lib/model/dietary'
import { partnerNames, sideLabel } from '@/lib/model/partners'
import styles from './GuestCard.module.css'

const SIDE_COLOUR: Record<Exclude<Side, ''>, string> = { a: '#A6576A', b: '#5C7E9E', both: '#7C6F5B' }

/** The badge for a guest's side: each partner's initial, and both for both. */
function sideBadge(side: Exclude<Side, ''>, meta: Meta) {
  const [a, b] = partnerNames(meta).map((name) => name[0]?.toUpperCase() ?? '?')
  const letter = side === 'a' ? a : side === 'b' ? b : `${a}·${b}`
  return { letter, colour: SIDE_COLOUR[side], label: sideLabel(side, meta) }
}

function GuestCardBase({
  guest,
  selected = false,
  multiSelected = false,
  onContextMenu,
}: {
  guest: Guest
  selected?: boolean
  multiSelected?: boolean
  onContextMenu?: (e: MouseEvent) => void
}) {
  const select = useStore((s) => s.select)
  const toggleGuestSelected = useStore((s) => s.toggleGuestSelected)
  const showBadges = useStore((s) => s.settings.showDietaryBadges)
  const meta = useStore((s) => s.meta)
  const showGroupColours = useStore((s) => s.settings.showGroupColours)
  // Single colour dot: family colour takes priority over subgroup, then group.
  const dotColour = useStore((s) => {
    if (!showGroupColours) return null
    if (guest.familyId) return s.families[guest.familyId]?.colour || null
    if (guest.subgroupId) return s.subgroups[guest.subgroupId]?.colour || null
    if (guest.groupId) return s.groups[guest.groupId]?.colour || null
    return null
  })

  const { listeners, attributes, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: `guest_${guest.id}`,
    data: { type: 'guest', guestId: guest.id },
  })

  const warnings = useGuestWarnings(guest.id)
  const assigned = !!guest.assignedTableId
  const diet = guest.dietary ? dietaryMeta(guest.dietary) : null
  const side = guest.side ? sideBadge(guest.side, meta) : null

  const handleClick = (e: MouseEvent) => {
    if (e.shiftKey || e.metaKey || e.ctrlKey) toggleGuestSelected(guest.id)
    else select('guest', guest.id)
  }

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        styles.card,
        selected && styles.selected,
        multiSelected && styles.multi,
        assigned && styles.assigned,
        isDragging && styles.dragging
      )}
      onClick={handleClick}
      onContextMenu={onContextMenu}
      style={dotColour ? { borderLeftColor: dotColour, borderLeftWidth: 4 } : undefined}
      data-guest-id={guest.id}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className={styles.handle}
        // Drags from a pointer; a press opens the guest, which is also the way
        // in from the keyboard — the guest's panel is where they are seated.
        aria-label={`${guest.fullName}${assigned ? '' : ', no table'}`}
        {...listeners}
        {...attributes}
        onClick={(e) => {
          e.stopPropagation()
          handleClick(e)
        }}
      >
        <Icon name="grip" size={16} />
      </button>

      {dotColour && (
        <span className={styles.groupDot} style={{ background: dotColour }} aria-hidden="true" />
      )}
      {showGroupColours && guest.familyId && (
        <Icon name="link" size={10} className={styles.familyBadge} />
      )}
      <span className={styles.name}>{guest.fullName}</span>

      <span className={styles.meta}>
        {warnings.length > 0 && (
          <span
            className={styles.warn}
            title={warnings.map((w) => w.message).join('\n')}
          >
            <Icon name="alert" size={12} />
          </span>
        )}
        {showBadges && diet && (
          <span className={styles.diet} title={diet.label}>
            <span className={styles.dietDot} style={{ background: diet.colour }} />
            {diet.abbrev}
          </span>
        )}
        {side && (
          <span className={styles.side} style={{ background: side.colour }} title={side.label}>
            {side.letter}
          </span>
        )}
      </span>
    </div>
  )
}

const GuestCard = memo(GuestCardBase)
export default GuestCard
