import type { Announcements } from '@dnd-kit/core'
import type { Plan } from '../store/types'
import type { DragData, DropData } from './useCanvasDnd'

type Named = Pick<Plan, 'guests' | 'tables' | 'groups' | 'subgroups' | 'families'>

/** What a dragged thing or a drop target is called aloud: the names on screen, never ids. */
export function dragName(plan: Named, data: DragData | DropData): string {
  switch (data.type) {
    case 'palette':
    case 'palette-preset':
      return 'a new table'
    case 'guest':
      return plan.guests[data.guestId]!.fullName
    case 'table':
      return plan.tables[data.tableId]!.label
    case 'seat':
      return `seat ${data.index + 1} at ${plan.tables[data.tableId]!.label}`
    case 'group':
      return plan.groups[data.groupId]!.name
    case 'subgroup':
      return plan.subgroups[data.subgroupId]!.name
    case 'family':
      return plan.families[data.familyId]!.name
  }
}

/**
 * Read out as a drag goes. The library's defaults speak each draggable's id
 * ("guest_g_bt9u4ks7"); these speak names. Whether a drop is taken (a full
 * table refuses) is said by the toast that follows.
 */
export function dragAnnouncements(plan: () => Named): Announcements {
  const name = (data: unknown) => dragName(plan(), data as DragData | DropData)
  return {
    onDragStart: ({ active }) => `Picked up ${name(active.data.current)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${name(active.data.current)} is over ${name(over.data.current)}.` : `${name(active.data.current)} is over nothing.`,
    onDragEnd: ({ active, over }) =>
      over ? `${name(active.data.current)} dropped on ${name(over.data.current)}.` : `${name(active.data.current)} dropped.`,
    onDragCancel: ({ active }) => `Moving ${name(active.data.current)} was cancelled.`,
  }
}
