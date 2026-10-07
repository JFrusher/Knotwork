import { useStore } from '../../store/useStore'
import { useWarnings } from '../../store/warningsContext'
import { centerCanvasOn } from '../../utils/canvasCoords'
import type { SeatingWarning } from '../../utils/warnings'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import styles from './WarningsPanel.module.css'

export default function WarningsPanel() {
  const { list } = useWarnings()
  const closeModal = useStore((s) => s.closeModal)
  const openModal = useStore((s) => s.openModal)
  const select = useStore((s) => s.select)

  const navigate = (w: SeatingWarning) => {
    const store = useStore.getState()
    const [tableId] = w.tableIds
    const [guestId] = w.guestIds
    if (tableId && store.tables[tableId]) {
      const t = store.tables[tableId]
      select('table', tableId)
      centerCanvasOn(t.x, t.y)
    } else if (guestId) {
      select('guest', guestId)
    }
    closeModal()
  }

  return (
    <Modal
      title="Warnings"
      onClose={closeModal}
      footer={
        <>
          <Button variant="ghost" icon="users" onClick={() => openModal('constraints')}>
            Manage rules
          </Button>
          <Button variant="primary" onClick={closeModal}>
            Done
          </Button>
        </>
      }
    >
      {list.length === 0 ? (
        <div className={styles.empty}>
          <Icon name="check" size={24} className={styles.emptyIcon} />
          <p>No issues — your plan is looking good.</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {list.map((w) => (
            <li key={w.id}>
              <button type="button" className={styles.row} onClick={() => navigate(w)}>
                {/* A split family is not a broken rule, and says so in words, not colour. */}
                <Icon
                  name={w.kind === 'family-split' ? 'users' : w.level === 'warn' ? 'alert' : 'info'}
                  size={16}
                  className={w.level === 'warn' ? styles.warn : styles.info}
                />
                <span className={styles.message}>
                  {w.kind === 'family-split' && <span className={styles.tag}>Family</span>}
                  {w.message}
                </span>
                {(w.tableIds.length > 0 || w.guestIds.length > 0) && (
                  <Icon name="chevron-right" size={14} className={styles.chevron} />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
