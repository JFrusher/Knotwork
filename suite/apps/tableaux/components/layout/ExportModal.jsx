import { useStore } from '../../store/useStore.js'
import Modal from '../ui/Modal.jsx'
import Icon from '../ui/Icon.jsx'
import { exportCsv } from '../../utils/exportCsv.js'
import { exportReportCsv } from '../../utils/exportReports.js'
import styles from './ExportModal.module.css'

/**
 * Sheets for the people who need the room but not the app, such as the
 * caterer. A copy of the whole wedding is the backup in the Data panel, so
 * there is no plan file of Seating's own to export or import here.
 */
export default function ExportModal() {
  const closeModal = useStore((s) => s.closeModal)

  const handleCsv = () => {
    const s = useStore.getState()
    exportCsv(s, s.meta.weddingName)
    closeModal()
  }
  const handleReport = () => {
    const s = useStore.getState()
    exportReportCsv(s, s.meta.weddingName)
    closeModal()
  }

  return (
    <Modal title="Export" size="sm" onClose={closeModal}>
      <div className={styles.options}>
        <button type="button" className={styles.option} onClick={handleCsv}>
          <Icon name="download" size={20} className={styles.icon} />
          <span className={styles.label}>Table assignments (CSV)</span>
          <span className={styles.desc}>
            A caterer-friendly sheet of who&rsquo;s at each table.
          </span>
        </button>
        <button type="button" className={styles.option} onClick={handleReport}>
          <Icon name="download" size={20} className={styles.icon} />
          <span className={styles.label}>Dietary &amp; headcount report (CSV)</span>
          <span className={styles.desc}>
            Dietary totals and a per-table summary for caterers.
          </span>
        </button>
      </div>
    </Modal>
  )
}
