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
    if (w.tableId && store.tables[w.tableId]) {
      const t = store.tables[w.tableId]
      select('table', w.tableId)
      centerCanvasOn(t.x, t.y)
    } else if (w.guestId) {
      select('guest', w.guestId)
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
                <Icon
                  name={w.kind === 'family-split' ? 'users' : w.level === 'warn' ? 'alert' : 'info'}
                  size={16}
                  className={w.level === 'warn' ? styles.warn : styles.info}
                />
                <span className={styles.message}>
                  {w.kind === 'family-split' && <span className={styles.kind}>Family</span>}
                  {w.message}
                </span>
                {(w.tableId || w.guestId) && (
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
