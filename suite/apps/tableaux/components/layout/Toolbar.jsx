import clsx from 'clsx'
import { useStore, selectCanUndo, selectCanRedo } from '../../store/useStore.js'
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

const fmtTime = (iso) => {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function SaveIndicator() {
  const save = useStore((s) => s.save)
  if (save.status === 'saving') return <span className={styles.saveStatus}>Saving…</span>
  if (save.status === 'conflict')
    return <span className={clsx(styles.saveStatus, styles.saveError)}>Sync conflict</span>
  if (save.status === 'error')
    return <span className={clsx(styles.saveStatus, styles.saveError)}>Save failed</span>
  if (save.status === 'saved' && save.lastSavedAt)
    return <span className={styles.saveStatus}>Saved {fmtTime(save.lastSavedAt)}</span>
  return <span className={styles.saveStatus} />
}

export default function Toolbar() {
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const canUndo = useStore(selectCanUndo)
  const canRedo = useStore(selectCanRedo)
  const openModal = useStore((s) => s.openModal)
  const togglePanel = useStore((s) => s.togglePanel)

  return (
    <header className={styles.toolbar}>
      {/*
        * Unlike the other tools, this bar is not chrome: it holds the table
        * palette you drag a room out of, so it stays. Undo and redo went up
        * into the shell's header. There is no Save: the plan saves itself.
        */}
      <ToolUndo canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo} />

      <div className={styles.center}>
        <TablePalette />
      </div>

      <div className={styles.right}>
        <SaveIndicator />
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
    </header>
  )
}
