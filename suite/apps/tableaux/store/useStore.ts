import { create } from 'zustand'
import { useTrousseauStore } from '@/lib/store/useTrousseauStore'
import type { Guide } from '../utils/alignmentSnap'
import { makeId } from '../utils/ids'
import type { Seat } from '../utils/seatPositions'
import { actionCreators, type ActionCreators } from './actions'
import { applyPatch } from './patch'
import { normalizePlan, PLAN_KEYS } from './plan'
import { isWriting, readDoc, writeDoc } from './sliceBridge'
import type { Action, Collection, Command, Plan, PlanSnapshot, Room } from './types'

export type Tool = 'select' | 'zone' | 'door' | 'opening' | 'pillar' | 'room-draw' | 'calibrate'

export interface Selection {
  type: 'table' | 'guest' | 'zone' | 'space' | null
  id: string | null
}

export interface Toast {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  message: string
  duration: number
}

export interface Canvas {
  zoom: number
  panX: number
  panY: number
}

/** Every action, bound: `addTable({...})` runs the command and returns it, or null. */
type Bound = { [K in keyof ActionCreators]: (...args: Parameters<ActionCreators[K]>) => Command | null }

/**
 * Seating's store: the plan, which is the wedding's guests and seating and
 * only ever shown here, and what belongs to this window — the selection, the
 * filters, a modal, where the canvas is looking.
 */
export interface SeatingState extends Plan, Bound {
  /** True once the wedding has been read. */
  loaded: boolean
  selection: Selection
  /** Multi-select within the guest panel. */
  selectedGuestIds: string[]
  search: string
  /** Active filter chips — see `guestFilters`. */
  filters: string[]
  activeTool: Tool
  panels: { left: boolean; right: boolean; history: boolean }
  modal: { name: string; props: Record<string, unknown> } | null
  toasts: Toast[]
  /** Alignment and spacing guides while a table is dragged. */
  dragGuides: Guide[]
  /** Live chair overrides on the tables near the one being dragged. */
  neighbourDragAdaptations: Record<string, Seat[]>
  /** Where this window is looking. Not the wedding's: a partner panning their room must not move yours. */
  canvas: Canvas

  /** Runs a command into the wedding, as one step on its history. Returns it, so callers can read its `meta`. */
  dispatch: (action: Action | Command) => Command | null
  /** The plan as it stands. */
  serialize: () => Plan

  // Live previews, this window's own until the gesture ends.
  updateRoom: (patch: Partial<Room>) => void
  patchEntityLive: <C extends Collection>(collection: C, id: string, patch: Partial<Plan[C][string]>) => void
  setCanvas: (patch: Partial<Canvas>) => void

  saveSnapshot: (name: string) => PlanSnapshot
  restoreSnapshot: (id: string) => void
  deleteSnapshot: (id: string) => void

  setDragGuides: (guides: Guide[]) => void
  setNeighbourDragAdaptations: (map: Record<string, Seat[]>) => void
  select: (type: Selection['type'], id: string | null) => void
  clearSelection: () => void
  setSelectedGuestIds: (ids: string[]) => void
  toggleGuestSelected: (id: string) => void
  setSearch: (search: string) => void
  toggleFilter: (key: string) => void
  clearFilters: () => void
  setActiveTool: (tool: Tool) => void
  togglePanel: (which: keyof SeatingState['panels']) => void
  openModal: (name: string, props?: Record<string, unknown>) => void
  closeModal: () => void
  addToast: (toast: { type?: Toast['type']; message: string; duration?: number }) => string
  dismissToast: (id: string) => void
}

/** The plan out of the store's state. */
const planIn = (s: Plan): Plan => {
  const plan = {} as Record<string, unknown>
  PLAN_KEYS.forEach((k) => {
    plan[k] = s[k]
  })
  return plan as unknown as Plan
}

/** Shown as "Undo <label>": the commands' own labels, read mid-sentence. */
const asUndo = (label: string) => (label ? label.charAt(0).toLowerCase() + label.slice(1) : 'a change to the room')

const NO_SELECTION: Selection = { type: null, id: null }

export const useStore = create<SeatingState>()((set, get) => {
  /**
   * Into the wedding: this window's plan with `update` applied, as one step on
   * the wedding's history. The store shows it at once, and the wedding's copy
   * coming back is not read again (see `isWriting`).
   */
  const commit = (update: Partial<SeatingState>, label: string) => {
    set(update)
    writeDoc(planIn(get()), { label })
  }

  // Bind every action creator to a thin dispatcher: components call
  // `addTable({...})` and the command flows into the wedding.
  const bound = {} as Record<string, (...args: never[]) => Command | null>
  for (const [name, creator] of Object.entries(actionCreators)) {
    bound[name] = (...args: never[]) => get().dispatch((creator as (...a: never[]) => Action)(...args))
  }

  return {
    ...readDoc(),
    loaded: useTrousseauStore.getState().status === 'ready',
    selection: NO_SELECTION,
    selectedGuestIds: [],
    search: '',
    filters: [],
    activeTool: 'select',
    panels: { left: true, right: true, history: false },
    modal: null,
    toasts: [],
    dragGuides: [],
    neighbourDragAdaptations: {},
    canvas: { zoom: 1, panX: 0, panY: 0 },
    ...(bound as Bound),

    dispatch: (action) => {
      const state = get()
      const command = typeof action === 'function' ? action(state) : action
      if (!command || !command.payload) return null
      commit(applyPatch(state, command.payload), asUndo(command.label))
      return command
    },

    serialize: () => planIn(get()),

    // ── live previews, this window's own until the gesture ends ──────────
    // A drag calls these every frame, and dispatches one command on
    // pointer-up (RoomSpaces, TableNode). Nothing here reaches the wedding,
    // so the step undo takes back starts where the drag did.
    updateRoom: (patch) => set({ room: { ...get().room, ...patch } }),
    patchEntityLive: (collection, id, patch) => {
      const coll = get()[collection] as Record<string, unknown>
      const entity = coll[id]
      if (!entity) return
      set({ [collection]: { ...coll, [id]: { ...(entity as object), ...patch } } } as Partial<SeatingState>)
    },
    setCanvas: (patch) => set({ canvas: { ...get().canvas, ...patch } }),

    // ── snapshots (kept in the plan, so they travel with the wedding) ─────
    saveSnapshot: (name) => {
      const s = get()
      const { snapshots: _snapshots, ...rest } = s.serialize()
      const snap: PlanSnapshot = {
        id: makeId('snap'),
        name: (name || '').trim() || 'Untitled snapshot',
        savedAt: new Date().toISOString(),
        state: rest,
      }
      commit({ snapshots: [snap, ...(s.snapshots || [])].slice(0, 10) }, 'keeping a snapshot')
      return snap
    },
    restoreSnapshot: (id) => {
      const s = get()
      const snap = (s.snapshots || []).find((x) => x.id === id)
      if (!snap) return
      // One step on the wedding's history, so putting a snapshot back can be
      // undone like anything else.
      commit({ ...normalizePlan(snap.state), snapshots: s.snapshots, selection: NO_SELECTION }, 'putting back a snapshot')
    },
    deleteSnapshot: (id) =>
      commit({ snapshots: (get().snapshots || []).filter((x) => x.id !== id) }, 'deleting a snapshot'),

    // ── ephemeral UI ───────────────────────────────────────────────────
    setDragGuides: (guides) => set({ dragGuides: guides }),
    setNeighbourDragAdaptations: (map) => set({ neighbourDragAdaptations: map }),
    select: (type, id) => set({ selection: { type, id }, selectedGuestIds: [] }),
    clearSelection: () => set({ selection: NO_SELECTION, selectedGuestIds: [] }),
    setSelectedGuestIds: (ids) => set({ selectedGuestIds: ids, selection: NO_SELECTION }),
    toggleGuestSelected: (id) => {
      const cur = get().selectedGuestIds
      set({
        selectedGuestIds: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
        selection: NO_SELECTION,
      })
    },
    setSearch: (search) => set({ search }),
    toggleFilter: (key) => {
      const cur = get().filters
      set({ filters: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] })
    },
    clearFilters: () => set({ filters: [] }),
    setActiveTool: (activeTool) => set({ activeTool }),
    togglePanel: (which) => set({ panels: { ...get().panels, [which]: !get().panels[which] } }),
    openModal: (name, props = {}) => set({ modal: { name, props } }),
    closeModal: () => set({ modal: null }),

    addToast: ({ type = 'info', message, duration = 3000 }) => {
      const id = makeId('toast')
      set({ toasts: [...get().toasts, { id, type, message, duration }] })
      return id
    },
    dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  }
})

/** True when `id` names something the plan still has. */
function inPlan(plan: Plan, id: string): boolean {
  return (
    (['guests', 'groups', 'subgroups', 'families', 'tables', 'zones', 'wallElements', 'pillars'] as const).some((c) =>
      Boolean(plan[c][id])
    ) || plan.room.spaces.some((space) => space.id === id)
  )
}

/**
 * The plan is whatever the wedding holds — edited here, put back by the
 * header's undo, changed on the Guests page or on a partner's device alike.
 * Followed as it changes, synchronously, so there is never a moment the two
 * disagree. What is selected and no longer there is let go.
 */
function follow(): void {
  const plan = readDoc()
  const s = useStore.getState()
  useStore.setState({
    ...plan,
    loaded: true,
    selection: s.selection.id !== null && !inPlan(plan, s.selection.id) ? NO_SELECTION : s.selection,
    selectedGuestIds: s.selectedGuestIds.filter((id) => plan.guests[id]),
  })
}

useTrousseauStore.subscribe((state, prev) => {
  if (state.status !== 'ready' || isWriting()) return
  const changed =
    prev.status !== 'ready' ||
    state.raw.guests !== prev.raw.guests ||
    state.raw.seating !== prev.raw.seating ||
    state.raw.event !== prev.raw.event
  if (changed) follow()
})
