import type { MouseEvent } from 'react'
import type { Family, Group, Guest, Subgroup } from '../../store/types'

/**
 * The guest list as the panel shows it: each group, subgroup and family with
 * the members that match the search and filters, built by `GuestPanel`.
 */
export interface ShownFamily {
  family: Family
  members: Guest[]
}

export interface ShownSubgroup {
  subgroup: Subgroup
  members: Guest[]
  families: ShownFamily[]
}

export interface ShownGroup {
  group: Group
  /** In the group, not through one of its subgroups or families. */
  members: Guest[]
  subgroups: ShownSubgroup[]
  families: ShownFamily[]
}

/** What each block is told about the list around it. */
export interface ListProps {
  selectedGuestId: string | null
  selectedSet: Set<string>
  onCardContextMenu: (guestId: string, e: MouseEvent) => void
}
