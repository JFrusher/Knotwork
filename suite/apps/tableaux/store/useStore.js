import { create } from 'zustand'
import { useTrousseauStore } from '@/lib/store/useTrousseauStore'
import { actionCreators } from './actions.js'
import { applyPatch } from './patch.js'
import { isWriting, readDoc, writeDoc } from './sliceBridge'
import { makeId } from '../utils/ids.js'
import { DEFAULT_PPU, DEFAULT_CHAIR_CM, deriveSizeUnits } from '../utils/seatPositions.js'
import { localeDefaultUnitSystem } from '../utils/units.js'

// Keys that make up the plan: the wedding's guests and seating. Everything else
// in the store — the selection, a modal, where the canvas is looking — is this
// window's own.
export const DOC_KEYS = [
  'meta',
  'guests',
  'groups',
  'subgroups',
  'families',
  'tables',
  'zones',
  'room',
  'wallElements',
  'pillars',
  'snapshots',
  'constraints',
  'settings',
]

function emptyDoc() {
  const now = new Date().toISOString()
  return {
    meta: { weddingName: 'Our Wedding', venue: '', date: '', createdAt: now, updatedAt: now },
    guests: {},
    groups: {},
    subgroups: {},
    families: {},
    tables: {},
    zones: {},
    wallElements: {},
    pillars: {},
    room: {
      widthUnits: Math.round(1200 / DEFAULT_PPU),
      heightUnits: Math.round(900 / DEFAULT_PPU),
      width: 1200,
      height: 900,
      backgroundColour: '#FAF8F5',
    },
    snapshots: [],
    constraints: [],
    settings: {
      defaultSeatMode: 'table',
      showDietaryBadges: true,
      showGroupColours: true,
      gridSnap: true,
      gridSize: 20,
      snapAlign: true,
      unitSystem: localeDefaultUnitSystem(),
      pixelsPerUnit: DEFAULT_PPU,
      showChairs: true,
      chairSizeUnits: DEFAULT_CHAIR_CM,
      customTablePresets: [],
    },
  }
}

const round2 = (n) => Math.round(n * 100) / 100

// ── document normalization (on every read of the wedding) ───────────────────
// Older saved plans predate real-world units / per-side seats. We upgrade them
// on read so the rest of the app can assume the richer shape; the next edit
// writes it. Migration is non-destructive and pixel-identical: `sizeUnits` is
// reverse-derived from the legacy px geometry ÷ the locked ppu.
//
// Deterministic, because the plan is read again whenever the wedding changes:
// a space given a fresh random id on every read could never stay selected.

const ensureSettingsShape = (s = {}) => ({
  ...s,
  defaultSeatMode: s.defaultSeatMode || 'table',
  showDietaryBadges: s.showDietaryBadges ?? true,
  showGroupColours: s.showGroupColours ?? true,
  gridSnap: s.gridSnap ?? true,
  gridSize: s.gridSize || 20,
  snapAlign: s.snapAlign ?? true,
  unitSystem: s.unitSystem || localeDefaultUnitSystem(),
  pixelsPerUnit: s.pixelsPerUnit || DEFAULT_PPU,
  showChairs: s.showChairs ?? true,
  chairSizeUnits: s.chairSizeUnits || DEFAULT_CHAIR_CM,
  customTablePresets: Array.isArray(s.customTablePresets) ? s.customTablePresets : [],
})

// A single floor space: a rectangle (x/y/width/height) or a polygon (vertices
// relative to x/y). Coordinates are canvas px, matching tables and zones.
const ensureSpaceShape = (sp = {}, index = 0) => {
  const base = {
    id: sp.id || `space_${index}`,
    label: sp.label || 'Space',
    shape: sp.shape === 'polygon' ? 'polygon' : 'rect',
    x: sp.x || 0,
    y: sp.y || 0,
    backgroundColour: sp.backgroundColour || '#FAF8F5',
  }
  if (base.shape === 'polygon') {
    base.vertices = Array.isArray(sp.vertices)
      ? sp.vertices.map((v) => ({ x: Math.round(v.x), y: Math.round(v.y) }))
      : []
  } else {
    base.width = sp.width || 400
    base.height = sp.height || 300
  }
  return base
}

const ensureRoomShape = (r = {}, ppu) => {
  const widthUnits = r.widthUnits ?? (r.width != null ? r.width / ppu : 1200 / ppu)
  const heightUnits = r.heightUnits ?? (r.height != null ? r.height / ppu : 900 / ppu)
  const width = round2(widthUnits * ppu)
  const height = round2(heightUnits * ppu)
  const backgroundColour = r.backgroundColour || '#FAF8F5'
  // Multi-room: migrate a legacy single-rect room into a `spaces` array. The
  // legacy width/height fields stay in sync with the primary space so older read
  // paths (and old saved plans) keep working.
  const spaces =
    Array.isArray(r.spaces) && r.spaces.length
      ? r.spaces.map(ensureSpaceShape)
      : [
          {
            id: 'space_room',
            label: 'Room',
            shape: 'rect',
            x: 0,
            y: 0,
            width,
            height,
            backgroundColour,
          },
        ]
  return {
    ...r,
    widthUnits: round2(widthUnits),
    heightUnits: round2(heightUnits),
    width,
    height,
    backgroundColour,
    spaces,
    joins: Array.isArray(r.joins) ? r.joins.filter((j) => j && j.a && j.b) : [],
  }
}

const ensureTableShape = (t, ppu) => {
  const table = {
    rotation: 0,
    seatMode: 'table',
    assignedGuestIds: [],
    colour: null,
    designation: null,
    perSideSeats: null,
    seatArcRange: null,
    ...t,
  }
  if (!table.sizeUnits) table.sizeUnits = deriveSizeUnits(table, ppu)
  if (table.perSideSeats === undefined) table.perSideSeats = null
  return table
}

// Normalize the document slices that gained new fields. Leaves everything else
// (guests handled separately, zones, constraints, etc.) untouched.
function normalizeDoc(clean) {
  const settings = ensureSettingsShape(clean.settings)
  const ppu = settings.pixelsPerUnit
  const room = ensureRoomShape(clean.room, ppu)
  const tables = {}
  Object.entries(clean.tables || {}).forEach(([id, t]) => {
    tables[id] = ensureTableShape({ ...t, id }, ppu)
  })
  const subgroups = {}
  Object.entries(clean.subgroups || {}).forEach(([id, sg]) => {
    subgroups[id] = ensureSubgroupShape(sg, id)
  })
  const families = {}
  Object.entries(clean.families || {}).forEach(([id, f]) => {
    families[id] = ensureFamilyShape(f, id)
  })
  return { ...clean, settings, room, tables, subgroups, families }
}

const initialUi = {
  selection: { type: null, id: null }, // type: 'table' | 'guest' | 'zone'
  selectedGuestIds: [], // multi-select within the guest panel
  search: '',
  filters: [], // active filter keys
  activeTool: 'select', // 'select' | 'zone'
  panels: { left: true, right: true, history: false },
  modal: null, // { name, props }
  toasts: [],
  dragGuides: [], // active alignment/spacing guide lines while dragging a table
  neighbourDragAdaptations: {}, // { [tableId]: seats[] } — live chair overrides on tables near the one being dragged
  // Where this window is looking. Not the wedding's: a partner panning their
  // room must not move yours.
  canvas: { zoom: 1, panX: 0, panY: 0 },
}

const ensureSubgroupShape = (sg, id) => ({
  id,
  name: sg.name || 'Subgroup',
  colour: sg.colour || '#A2B8A2',
  parentGroupId: sg.parentGroupId || null,
  memberIds: Array.isArray(sg.memberIds) ? sg.memberIds : [],
})

const ensureFamilyShape = (f, id) => ({
  id,
  name: f.name || 'Family',
  colour: f.colour || '#A2B8A2',
  parentGroupId: f.parentGroupId || null,
  parentSubgroupId: f.parentSubgroupId || null,
  memberIds: Array.isArray(f.memberIds) ? f.memberIds : [],
})

/** The plan the wedding holds, in the shape the rest of Seating assumes. */
function planOf() {
  const doc = readDoc()
  const clean = {}
  DOC_KEYS.forEach((k) => {
    if (doc[k] !== undefined) clean[k] = doc[k]
  })
  return { ...emptyDoc(), ...normalizeDoc(clean) }
}

/** Shown as "Undo <label>": the commands' own labels, read mid-sentence. */
const asUndo = (label) => (label ? label.charAt(0).toLowerCase() + label.slice(1) : 'a change to the room')

export const useStore = create((set, get) => {
  /**
   * Into the wedding: this window's plan with `update` applied, as one step on
   * the wedding's history. The store shows it at once, and the wedding's copy
   * coming back is not read again (see `isWriting`).
   */
  const commit = (update, label) => {
    set(update)
    const s = get()
    const doc = {}
    DOC_KEYS.forEach((k) => {
      doc[k] = s[k]
    })
    writeDoc(doc, { label })
  }

  // Bind every action creator to a thin dispatcher: components call
  // `addTable({...})` and the command flows into the wedding.
  const bound = {}
  for (const [name, creator] of Object.entries(actionCreators)) {
    bound[name] = (...args) => get().dispatch(creator(...args))
  }

  return {
    ...planOf(),
    ...initialUi,
    loaded: useTrousseauStore.getState().status === 'ready',
    ...bound,

    dispatch: (action) => {
      const state = get()
      const command = typeof action === 'function' ? action(state) : action
      if (!command || !command.payload) return null
      commit(applyPatch(state, command.payload), asUndo(command.label))
      return command // callers can read command.meta (e.g. newTableId)
    },

    serialize: () => {
      const s = get()
      const doc = {}
      DOC_KEYS.forEach((k) => {
        doc[k] = s[k]
      })
      return doc
    },

    // ── live previews, this window's own until the gesture ends ──────────
    // A drag calls these every frame, and dispatches one command on
    // pointer-up (RoomSpaces.jsx, TableNode.jsx). Nothing here reaches the
    // wedding, so the step undo takes back starts where the drag did.
    updateRoom: (patch) => set({ room: { ...get().room, ...patch } }),
    patchEntityLive: (collection, id, patch) => {
      const coll = get()[collection]
      const entity = coll[id]
      if (!entity) return
      set({ [collection]: { ...coll, [id]: { ...entity, ...patch } } })
    },
    setCanvas: (patch) => set({ canvas: { ...get().canvas, ...patch } }),

    // ── snapshots (kept in the plan, so they travel with the wedding) ─────
    saveSnapshot: (name) => {
      const s = get()
      // eslint-disable-next-line no-unused-vars
      const { snapshots, ...rest } = s.serialize()
      const snap = {
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
      const clean = {}
      DOC_KEYS.forEach((k) => {
        if (snap.state[k] !== undefined) clean[k] = snap.state[k]
      })
      // One step on the wedding's history, so putting a snapshot back can be
      // undone like anything else.
      commit(
        { ...emptyDoc(), ...normalizeDoc(clean), snapshots: s.snapshots, selection: { type: null, id: null } },
        'putting back a snapshot'
      )
    },
    deleteSnapshot: (id) =>
      commit({ snapshots: (get().snapshots || []).filter((x) => x.id !== id) }, 'deleting a snapshot'),

    // TODO(ux-audit): addConstraint (actions.js) has no duplicate-pair or
    // contradiction check — the same pair can be added twice (double-counts
    // warnings), and "A & B apart" + "A & B together" can coexist
    // silently. See tmp/ux-audit.md #G21.

    // ── ephemeral UI ───────────────────────────────────────────────────
    setDragGuides: (guides) => set({ dragGuides: guides }),
    setNeighbourDragAdaptations: (map) => set({ neighbourDragAdaptations: map }),
    select: (type, id) => set({ selection: { type, id }, selectedGuestIds: [] }),
    clearSelection: () => set({ selection: { type: null, id: null }, selectedGuestIds: [] }),
    setSelectedGuestIds: (ids) => set({ selectedGuestIds: ids, selection: { type: null, id: null } }),
    toggleGuestSelected: (id) => {
      const cur = get().selectedGuestIds
      set({
        selectedGuestIds: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
        selection: { type: null, id: null },
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

    addToast: ({ type = 'info', message, duration = 3000 } = {}) => {
      const id = makeId('toast')
      set({ toasts: [...get().toasts, { id, type, message, duration }] })
      return id
    },
    dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  }
})

/** True when `id` names something the plan still has. */
function inPlan(plan, id) {
  return (
    ['guests', 'groups', 'subgroups', 'families', 'tables', 'zones', 'wallElements', 'pillars'].some((c) =>
      Boolean(plan[c]?.[id])
    ) || (plan.room.spaces || []).some((space) => space.id === id)
  )
}

/**
 * The plan is whatever the wedding holds — edited here, put back by the
 * header's undo, changed on the Guests page or on a partner's device alike.
 * Followed as it changes, synchronously, so there is never a moment the two
 * disagree. What is selected and no longer there is let go.
 */
function follow() {
  const plan = planOf()
  const s = useStore.getState()
  useStore.setState({
    ...plan,
    loaded: true,
    selection: s.selection.id !== null && !inPlan(plan, s.selection.id) ? { type: null, id: null } : s.selection,
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
