import type { ReactElement } from 'react'
import { useStore } from '../../store/useStore'
import StatsPanel from './StatsPanel'
import TableInspector from './TableInspector'
import GuestInspector from './GuestInspector'
import SpaceInspector from './SpaceInspector'
import SelectionPanel from './SelectionPanel'
import styles from './RightSidebar.module.css'

export default function RightSidebar() {
  const selection = useStore((s) => s.selection)
  const selectedGuestIds = useStore((s) => s.selectedGuestIds)
  const id = selection.id ?? ''
  const exists = useStore((s) => {
    if (selection.type === 'table') return !!s.tables[id]
    if (selection.type === 'guest') return !!s.guests[id]
    if (selection.type === 'space') return (s.room.spaces || []).some((sp) => sp.id === selection.id)
    return false
  })

  let body: ReactElement
  // Selecting several guests clears `selection`, so this comes first.
  if (selectedGuestIds.length > 1) body = <SelectionPanel guestIds={selectedGuestIds} />
  else if (exists && selection.type === 'table') body = <TableInspector tableId={id} />
  else if (exists && selection.type === 'guest') body = <GuestInspector guestId={id} />
  else if (exists && selection.type === 'space') body = <SpaceInspector spaceId={id} />
  else body = <StatsPanel />

  return <div className={styles.sidebar}>{body}</div>
}
