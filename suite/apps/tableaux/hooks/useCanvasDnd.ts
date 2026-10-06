import { useState, useCallback } from 'react'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { useStore, type SeatingState } from '../store/useStore'
import type { Table } from '../store/types'
import { screenToCanvas, isWithinViewport } from '../utils/canvasCoords'

/** What is being dragged. */
export type DragData =
  | { type: 'palette'; tableType: string }
  | { type: 'palette-preset'; presetId: string }
  | { type: 'guest'; guestId: string; fromSeat?: { tableId: string; index: number } }
  | { type: 'group'; groupId: string }
  | { type: 'subgroup'; subgroupId: string; parentGroupId: string | null }
  | { type: 'family'; familyId: string; parentGroupId: string | null; parentSubgroupId: string | null }

/** What it is dropped on. */
export type DropData =
  | { type: 'table'; tableId: string }
  | { type: 'seat'; tableId: string; index: number }
  | { type: 'group'; groupId: string }
  | { type: 'subgroup'; subgroupId: string; parentGroupId: string | null }
  | { type: 'family'; familyId: string; parentGroupId: string | null; parentSubgroupId: string | null }

/**
 * App-root drag controller. Handles:
 *   - palette → canvas: create a table at the drop point
 *   - guest/group → table or seat: assignment (Phase 4)
 *
 * The drop point is reconstructed from the activator event + delta so it works
 * regardless of which droppable (if any) reported `over`.
 */
/**
 * Add a table from the palette at a canvas point and select it: a table type,
 * or a saved preset with its full footprint and seating. Shared by dropping an
 * item on the canvas and by pressing it, which adds it mid-view.
 */
export function addTableFromPalette(
  data: Extract<DragData, { type: 'palette' | 'palette-preset' }>,
  point: { x: number; y: number }
): void {
  const store = useStore.getState()
  let cmd = null
  if (data.type === 'palette') {
    cmd = store.addTable({ type: data.tableType, x: point.x, y: point.y })
  } else {
    const preset = (store.settings.customTablePresets || []).find((pr) => pr.id === data.presetId)
    if (!preset) return
    cmd = store.addTable({
      type: preset.type,
      x: point.x,
      y: point.y,
      capacity: preset.capacity,
      sizeUnits: preset.sizeUnits || undefined,
      perSideSeats: preset.perSideSeats || undefined,
      seatMode: preset.seatMode,
    })
  }
  if (cmd?.meta?.newTableId) store.select('table', cmd.meta.newTableId)
}

export function useCanvasDnd() {
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null)

  const onDragStart = useCallback((e: DragStartEvent) => {
    setActiveDrag((e.active?.data?.current as DragData | undefined) || null)
  }, [])

  const onDragCancel = useCallback(() => setActiveDrag(null), [])

  const onDragEnd = useCallback((e: DragEndEvent) => {
    const data = e.active?.data?.current as DragData | undefined
    setActiveDrag(null)
    if (!data) return

    const store = useStore.getState()
    const { activatorEvent, delta, over } = e
    const start = activatorEvent as PointerEvent | null
    const clientX = (start?.clientX || 0) + (delta?.x || 0)
    const clientY = (start?.clientY || 0) + (delta?.y || 0)
    const overData = over?.data?.current as DropData | undefined

    // Palette → create a table at the drop position.
    if (data.type === 'palette' || data.type === 'palette-preset') {
      if (!isWithinViewport(clientX, clientY)) return
      addTableFromPalette(data, screenToCanvas(clientX, clientY))
      return
    }

    // Guest(s) → subgroup. If multiple guests are selected, add them all.
    if (data.type === 'guest' && overData?.type === 'subgroup') {
      const selectedIds = store.selectedGuestIds || []
      if (selectedIds.length > 1 && selectedIds.includes(data.guestId)) {
        selectedIds.forEach((gid) => store.addToSubgroup(overData.subgroupId, gid))
      } else {
        store.addToSubgroup(overData.subgroupId, data.guestId)
      }
      return
    }

    // Subgroup → table (seat all subgroup members)
    if (data.type === 'subgroup' && overData?.type === 'table') {
      assignSubgroupToTable(store, data.subgroupId, overData.tableId)
      return
    }

    // Guest(s) → family. addToFamily always clears any prior family/subgroup/
    // group mismatch, so dropping a family's own members back onto it (or onto
    // a family the guest is nested one level under) is a safe no-op/demotion.
    if (data.type === 'guest' && overData?.type === 'family') {
      const selectedIds = store.selectedGuestIds || []
      if (selectedIds.length > 1 && selectedIds.includes(data.guestId)) {
        selectedIds.forEach((gid) => store.addToFamily(overData.familyId, gid))
      } else {
        store.addToFamily(overData.familyId, data.guestId)
      }
      return
    }

    // Family → table (seat all family members)
    if (data.type === 'family' && overData?.type === 'table') {
      assignFamilyToTable(store, data.familyId, overData.tableId)
      return
    }

    // Guest → group. If the guest is already in this group and has a subgroup,
    // dropping on the parent group demotes them to a direct member (removes subgroup).
    if (data.type === 'guest' && overData?.type === 'group') {
      const guest = store.guests[data.guestId]
      if (guest?.groupId === overData.groupId && guest?.subgroupId) {
        store.removeFromSubgroup(data.guestId)
      } else {
        store.addToGroup(overData.groupId, data.guestId)
      }
      return
    }

    // Group → group (merge source group into target group)
    if (data.type === 'group' && overData?.type === 'group' && data.groupId !== overData.groupId) {
      store.mergeGroups(data.groupId, overData.groupId)
      return
    }

    // Guest → seat (seat-level)
    if (data.type === 'guest' && overData?.type === 'seat') {
      assignGuestToSeat(store, data.guestId, overData.tableId, overData.index)
      return
    }

    // Guest → table (table-level). Family is an unsplittable seating unit —
    // grabbing any one member and dropping them on a table carries the whole
    // family along, same as dragging the family block itself. One member is
    // seated alone from the inspector ("Seat on their own").
    if (data.type === 'guest' && overData?.type === 'table') {
      const guest = store.guests[data.guestId]
      if (guest?.familyId) {
        assignFamilyToTable(store, guest.familyId, overData.tableId)
      } else {
        assignGuestToTable(store, data.guestId, overData.tableId)
      }
      return
    }

    // Group → table
    if (data.type === 'group' && overData?.type === 'table') {
      assignGroupToTable(store, data.groupId, overData.tableId)
      return
    }
  }, [])

  return { activeDrag, onDragStart, onDragEnd, onDragCancel }
}

function tableFullToast(store: SeatingState, table: Table): void {
  store.addToast({
    type: 'error',
    message: `${table.label} is full — ${table.capacity} of ${table.capacity} seats taken.`,
  })
}

function assignGuestToTable(store: SeatingState, guestId: string, tableId: string): void {
  const table = store.tables[tableId]
  const guest = store.guests[guestId]
  if (!table || !guest) return
  const seated = (table.assignedGuestIds || []).filter(Boolean).length
  // Dropping a guest back onto the table they already sit at (e.g. releasing a
  // name box over its own table) is a no-op — avoid a redundant history entry.
  if (guest.assignedTableId === tableId) return
  if (seated >= table.capacity) {
    tableFullToast(store, table)
    return
  }
  store.assignGuest(guestId, tableId)
}

function assignGuestToSeat(store: SeatingState, guestId: string, tableId: string, index: number): void {
  const table = store.tables[tableId]
  if (!table) return
  const occupant = table.assignedGuestIds?.[index] ?? null
  if (occupant === guestId) return // dropped back onto its own seat — no-op
  if (occupant) {
    // Seat taken. If the dragged guest already sits at this table, swap the two;
    // otherwise leave the occupant be and tell the user.
    const fromIndex = (table.assignedGuestIds || []).indexOf(guestId)
    if (fromIndex !== -1) {
      store.swapSeatGuests(tableId, fromIndex, index)
      return
    }
    store.addToast({ type: 'warning', message: `Seat ${index + 1} is already taken.` })
    return
  }
  store.assignGuest(guestId, tableId, index)
}

function assignGroupToTable(store: SeatingState, groupId: string, tableId: string): void {
  const table = store.tables[tableId]
  const group = store.groups[groupId]
  if (!table || !group) return
  const members = (group.memberIds || []).filter((id) => store.guests[id])
  const here = new Set((table.assignedGuestIds || []).filter(Boolean))
  const incoming = members.filter((id) => !here.has(id)).length
  const seated = here.size
  if (seated + incoming > table.capacity) {
    store.addToast({
      type: 'error',
      message: `${table.label} can't fit the whole group (${seated + incoming}/${table.capacity}).`,
    })
    return
  }
  store.assignGroupToTable(groupId, tableId)
}

function assignSubgroupToTable(store: SeatingState, subgroupId: string, tableId: string): void {
  const table = store.tables[tableId]
  const sg = store.subgroups[subgroupId]
  if (!table || !sg) return
  const members = (sg.memberIds || []).filter((id) => store.guests[id])
  const here = new Set((table.assignedGuestIds || []).filter(Boolean))
  const incoming = members.filter((id) => !here.has(id)).length
  const seated = here.size
  if (seated + incoming > table.capacity) {
    store.addToast({
      type: 'error',
      message: `${table.label} can't fit the whole subgroup (${seated + incoming}/${table.capacity}).`,
    })
    return
  }
  store.assignSubgroupToTable(subgroupId, tableId)
}

function assignFamilyToTable(store: SeatingState, familyId: string, tableId: string): void {
  const table = store.tables[tableId]
  const fam = store.families[familyId]
  if (!table || !fam) return
  const members = (fam.memberIds || []).filter((id) => store.guests[id])
  const here = new Set((table.assignedGuestIds || []).filter(Boolean))
  const incoming = members.filter((id) => !here.has(id)).length
  const seated = here.size
  if (seated + incoming > table.capacity) {
    store.addToast({
      type: 'error',
      message: `${table.label} can't fit the whole family (${seated + incoming}/${table.capacity}).`,
    })
    return
  }
  store.assignFamilyToTable(familyId, tableId)
}
