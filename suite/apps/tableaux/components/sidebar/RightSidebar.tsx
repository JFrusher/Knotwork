import type { ReactElement } from 'react'
import { useStore } from '../../store/useStore'
import StatsPanel from './StatsPanel'
import TableInspector from './TableInspector'
import GuestInspector from './GuestInspector'
import SpaceInspector from './SpaceInspector'
import styles from './RightSidebar.module.css'

export default function RightSidebar() {
  const selection = useStore((s) => s.selection)
  const id = selection.id ?? ''
  const exists = useStore((s) => {
    if (selection.type === 'table') return !!s.tables[id]
    if (selection.type === 'guest') return !!s.guests[id]
    if (selection.type === 'space') return (s.room.spaces || []).some((sp) => sp.id === selection.id)
    return false
  })

  // TODO(ux-audit): multi-selecting guests in GuestPanel resets
  // selection.type to null (useStore.js toggleGuestSelected/
  // setSelectedGuestIds), so this always falls through to the generic
  // StatsPanel below with no "N guests selected" summary or bulk-edit
  // affordance -- the only way to act on a multi-selection is right-clicking
  // one of the selected cards for its context menu. See tmp/ux-audit.md #G5.
  let body: ReactElement
  if (exists && selection.type === 'table') body = <TableInspector tableId={id} />
  else if (exists && selection.type === 'guest') body = <GuestInspector guestId={id} />
  else if (exists && selection.type === 'space') body = <SpaceInspector spaceId={id} />
  else body = <StatsPanel />

  return <div className={styles.sidebar}>{body}</div>
}
