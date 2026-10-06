import { useStore } from '../../store/useStore'
import ConfirmDialog from '../ui/ConfirmDialog'
import WarningsPanel from './WarningsPanel'
import ConstraintsModal from './ConstraintsModal'
import SnapshotsModal from './SnapshotsModal'
import ExportModal from './ExportModal'
import SettingsModal from './SettingsModal'
import CalibrationModal from './CalibrationModal'
import CustomTableModal from './CustomTableModal'
import PrintModal from './PrintModal'

/**
 * Renders the single store-driven modal. New modal types are added to the
 * switch as their features are built (settings, snapshots, …).
 */
export default function ModalRoot() {
  const modal = useStore((s) => s.modal)
  const closeModal = useStore((s) => s.closeModal)

  if (!modal) return null

  switch (modal.name) {
    case 'warnings':
      return <WarningsPanel />
    case 'constraints':
      return <ConstraintsModal />
    case 'snapshots':
      return <SnapshotsModal />
    case 'export':
      return <ExportModal />
    case 'settings':
      return <SettingsModal />
    case 'calibrate':
      return <CalibrationModal {...modal.props} />
    case 'customTable':
      return <CustomTableModal />
    case 'print':
      return <PrintModal />
    case 'confirm': {
      // TODO(ux-audit): onConfirm is called without awaiting it, and the
      // dialog closes at once. The example that made this bite was
      // AccountModal's "Delete my account", which has since moved to the
      // shell; every remaining caller writes to this device and returns at
      // once, so the race is currently unreachable rather than fixed, and has
      // no issue: open one if a caller ever awaits real work here.
      const { onConfirm, ...ask } = modal.props
      return (
        <ConfirmDialog
          {...ask}
          onConfirm={() => {
            onConfirm()
            closeModal()
          }}
          onCancel={closeModal}
        />
      )
    }
  }
}
