import Link from 'next/link'
import { useStore } from '../../store/useStore'
import Modal from '../ui/Modal'
import Icon from '../ui/Icon'
import styles from './ExportModal.module.css'

/**
 * Everything printed from this room is made in Place cards, from the room as
 * it stands: one design for each piece, in the wedding's own fonts, at any
 * size from a place card to a board for the door. Seating keeps no second way
 * to print, so a board and its place cards cannot disagree.
 */
const PIECES: Array<{ piece: string; label: string; desc: string; icon: 'maximize' | 'layers' }> = [
  { piece: 'floor-plan', label: 'Floor plan', desc: 'This room to scale, a name at every chair.', icon: 'maximize' },
  { piece: 'seating-board', label: 'Seating board', desc: 'Every table and who sits at it, for the door.', icon: 'maximize' },
  { piece: 'finder', label: 'Finder', desc: 'Every guest A to Z, with their table.', icon: 'maximize' },
  { piece: 'place-cards', label: 'Place cards', desc: 'One for each seat, with its table.', icon: 'layers' },
  { piece: 'escort-card', label: 'Escort cards', desc: 'One for each guest: where to go.', icon: 'layers' },
  { piece: 'table-card', label: 'Table cards', desc: 'One for each table: who sits there.', icon: 'layers' },
]

export default function PrintModal() {
  const closeModal = useStore((s) => s.closeModal)

  return (
    <Modal title="Print" size="sm" onClose={closeModal}>
      <div className={styles.options}>
        {PIECES.map((p) => (
          <Link
            key={p.piece}
            href={`/place-cards?piece=${p.piece}`}
            className={styles.option}
            onClick={closeModal}
          >
            <Icon name={p.icon} size={20} className={styles.icon} />
            <span className={styles.label}>{p.label}</span>
            <span className={styles.desc}>{p.desc}</span>
          </Link>
        ))}
      </div>
    </Modal>
  )
}
