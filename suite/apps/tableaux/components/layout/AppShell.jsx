import clsx from 'clsx'
import { useStore } from '../../store/useStore.js'
import Toolbar from './Toolbar.jsx'
import GuestPanel from '../guestPanel/GuestPanel.jsx'
import RoomCanvas from '../canvas/RoomCanvas.jsx'
import RightSidebar from '../sidebar/RightSidebar.jsx'
import ErrorBoundary from '../ui/ErrorBoundary.jsx'
import styles from './AppShell.module.css'

// Renders straight away: Seating is shown only once the wedding has been read
// (`WhenDocumentReady`), and its plan is the wedding's from the first frame,
// so there is no blank moment to cover with a skeleton (ux-audit #A6).
export default function AppShell() {
  const panels = useStore((s) => s.panels)

  return (
    <div className={styles.shell}>
      <ErrorBoundary label="The toolbar hit a snag">
        <Toolbar />
      </ErrorBoundary>
      <div className={styles.body}>
        <aside
          aria-label="Guests"
          className={clsx('panel-dark', styles.left, !panels.left && styles.collapsedLeft)}
        >
          <ErrorBoundary label="The guest panel hit a snag">
            <GuestPanel />
          </ErrorBoundary>
        </aside>

        <div className={styles.center}>
          <ErrorBoundary label="The canvas hit a snag">
            <RoomCanvas />
          </ErrorBoundary>
        </div>

        <aside
          aria-label="Details"
          className={clsx(styles.right, !panels.right && styles.collapsedRight)}
        >
          <ErrorBoundary label="The inspector hit a snag">
            <RightSidebar />
          </ErrorBoundary>
        </aside>
      </div>
    </div>
  )
}
