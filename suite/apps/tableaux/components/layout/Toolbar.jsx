import { useTrousseauStore } from '@/lib/store/useTrousseauStore'
import { useStore } from '../../store/useStore.js'
import { useWarnings } from '../../store/warningsContext.jsx'
import IconButton from '../ui/IconButton.jsx'
import { ToolUndo } from '@/components/shell/ToolUndo'
import Icon from '../ui/Icon.jsx'
import TablePalette from '../toolbar/TablePalette.jsx'
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
  // Seating keeps no history of its own: its edits are on the wedding's. The
  // stack is shared, so saying what the next undo takes back makes it safe.
  const past = useTrousseauStore((s) => s.past)
  const future = useTrousseauStore((s) => s.future)
  const openModal = useStore((s) => s.openModal)
  const togglePanel = useStore((s) => s.togglePanel)

  return (
    <div className={styles.toolbar}>
      {/*
        * Unlike the other tools, this bar is not chrome: it holds the table
        * palette you drag a room out of, so it stays. Undo and redo went up
        * into the shell's header. There is no Save: the plan saves itself.
        */}
      <ToolUndo
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        onUndo={() => useTrousseauStore.getState().undo()}
        onRedo={() => useTrousseauStore.getState().redo()}
        undoLabel={past[past.length - 1]?.label ?? null}
        redoLabel={future[future.length - 1]?.label ?? null}
      />

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
