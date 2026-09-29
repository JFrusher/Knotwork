import { useStore } from '../../store/useStore'
import { useWarnings } from '../../store/warningsContext'
import IconButton from '../ui/IconButton'
import { ToolUndo } from '@/components/shell/ToolUndo'
import Icon from '../ui/Icon'
import TablePalette from '../toolbar/TablePalette'
import styles from './Toolbar.module.css'

function WarningsButton() {
  const { list } = useWarnings()
  const openModal = useStore((s) => s.openModal)
  const count = list.length
  return (
    <button
      type="button"
      className={styles.warnBtn}
      onClick={() => openModal('warnings')}
      aria-label={`Warnings (${count})`}
      title="Warnings"
    >
      <Icon name="alert" size={18} />
      {count > 0 && <span className={styles.warnCount}>{count}</span>}
    </button>
  )
}

export default function Toolbar() {
  const openModal = useStore((s) => s.openModal)
  const togglePanel = useStore((s) => s.togglePanel)

  return (
    <div className={styles.toolbar}>
      {/*
        * Unlike the other tools, this bar is not chrome: it holds the table
        * palette you drag a room out of, so it stays. Undo and redo went up
        * into the shell's header. There is no Save: the plan saves itself.
        */}
      <ToolUndo />

      <div className={styles.center}>
        <TablePalette />
      </div>

      <div className={styles.right}>
        <WarningsButton />
        <span className={styles.divider} />
        <div className={styles.group}>
          <IconButton
            icon="link"
            label="Seating rules"
            onClick={() => openModal('constraints')}
          />
          <IconButton icon="camera" label="Snapshots" onClick={() => openModal('snapshots')} />
          <IconButton icon="printer" label="Print &amp; PDF" onClick={() => openModal('print')} />
          <IconButton icon="download" label="Export" onClick={() => openModal('export')} />
          <IconButton icon="settings" label="Settings" onClick={() => openModal('settings')} />
        </div>
        <span className={styles.divider} />
        <div className={styles.group}>
          <IconButton
            icon="panel-left"
            label="Toggle guest panel"
            onClick={() => togglePanel('left')}
          />
          <IconButton
            icon="panel-right"
            label="Toggle details panel"
            onClick={() => togglePanel('right')}
          />
        </div>
      </div>
    </div>
  )
}
