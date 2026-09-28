import { create } from 'zustand'
import { withHistory } from './undoMiddleware.js'
import { actionCreators } from './actions.js'
import { makeId } from '../utils/ids.js'
import { DEFAULT_PPU, DEFAULT_CHAIR_CM, deriveSizeUnits } from '../utils/seatPositions.js'
import { localeDefaultUnitSystem } from '../utils/units.js'

// Keys that make up the persisted document (saved to / loaded from the server).
// Everything else in the store is ephemeral UI state.
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
  'canvas',
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
    canvas: { zoom: 1, panX: 0, panY: 0 },
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

// ── document normalization (lazy, on every load) ────────────────────────────
// Older saved plans predate real-world units / per-side seats. We upgrade them
// on read so the rest of the app can assume the richer shape; the next
// auto-save persists it. Migration is non-destructive and pixel-identical:
// `sizeUnits` is reverse-derived from the legacy px geometry ÷ the locked ppu.

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
const ensureSpaceShape = (sp = {}) => {
  const base = {
    id: sp.id || makeId('space'),
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
            id: makeId('space'),
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
  save: { status: 'idle', lastSavedAt: null, lastSavedRev: 0 }, // status: idle|saving|saved|error
  loaded: false,
  planId: null, // server-side plan id when running in SaaS (Supabase) mode
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

export const useStore = create(
  withHistory(
    (set, get) => {
      // Bind every action creator to a thin dispatcher: components call
      // `addTable({...})` and the command flows through history automatically.
      const bound = {}
      for (const [name, creator] of Object.entries(actionCreators)) {
        bound[name] = (...args) => get().dispatch(creator(...args))
      }

      return {
        ...emptyDoc(),
        ...initialUi,
        ...bound,

        // ── lifecycle ──────────────────────────────────────────────────────
        hydrate: (doc) => {
          const clean = {}
          DOC_KEYS.forEach((k) => {
            if (doc && doc[k] !== undefined) clean[k] = doc[k]
          })
          set({
            ...emptyDoc(),
            ...normalizeDoc(clean),
            _history: { past: [], future: [] },
            loaded: true,
          })
          set({
            save: { status: 'idle', lastSavedAt: null, lastSavedRev: get()._rev },
          })
        },

        serialize: () => {
          const s = get()
          const doc = {}
          DOC_KEYS.forEach((k) => {
            doc[k] = s[k]
          })
          return doc
        },

        isDirty: () => get()._rev !== get().save.lastSavedRev,

        // ── direct (non-undoable) document edits — bump _rev for auto-save ──
        // Both are deliberately outside history: setCanvas is pan/zoom, and
        // updateRoom is the live channel for space move/resize drags, which
        // call it once per pointermove and dispatch a single EDIT_SPACE
        // command on pointer-up (RoomSpaces.jsx). Routing either through
        // dispatch would push one undo entry per animation frame.
        // updateSettings/addConstraint/removeConstraint are now
        // undoable action creators in actions.js.
        updateRoom: (patch) => get()._touch({ room: { ...get().room, ...patch } }),
        setCanvas: (patch) => get()._touch({ canvas: { ...get().canvas, ...patch } }),

        // Live (non-undoable) entity patch — used during drag/resize for smooth
        // feedback. The final, undoable step is dispatched on pointer-up.
        patchEntityLive: (collection, id, patch) => {
          const coll = get()[collection]
          const entity = coll[id]
          if (!entity) return
          get()._touch({ [collection]: { ...coll, [id]: { ...entity, ...patch } } })
        },


        // ── snapshots (kept in the document, persisted via normal save) ────
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
          const next = [snap, ...(s.snapshots || [])].slice(0, 10)
          get()._touch({ snapshots: next })
          return snap
        },
        restoreSnapshot: (id) => {
          const s = get()
          const snap = (s.snapshots || []).find((x) => x.id === id)
          if (!snap) return
          set({
            ...emptyDoc(),
            ...normalizeDoc(snap.state),
            snapshots: s.snapshots, // keep the snapshot list itself
            _history: { past: [], future: [] },
            _rev: (s._rev || 0) + 1,
            selection: { type: null, id: null },
          })
        },
        deleteSnapshot: (id) =>
          get()._touch({ snapshots: (get().snapshots || []).filter((x) => x.id !== id) }),

        // TODO(ux-audit): addConstraint (actions.js) has no duplicate-pair or
        // contradiction check — the same pair can be added twice (double-counts
        // warnings), and "A & B apart" + "A & B together" can coexist
        // silently. See tmp/ux-audit.md #G21.

        // ── ephemeral UI ───────────────────────────────────────────────────
        setDragGuides: (guides) => set({ dragGuides: guides }),
        setNeighbourDragAdaptations: (map) => set({ neighbourDragAdaptations: map }),
        select: (type, id) => set({ selection: { type, id }, selectedGuestIds: [] }),
        clearSelection: () => set({ selection: { type: null, id: null }, selectedGuestIds: [] }),
        setSelectedGuestIds: (ids) =>
          set({ selectedGuestIds: ids, selection: { type: null, id: null } }),
        toggleGuestSelected: (id) => {
          const cur = get().selectedGuestIds
          set({
            selectedGuestIds: cur.includes(id)
              ? cur.filter((x) => x !== id)
              : [...cur, id],
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
        togglePanel: (which) =>
          set({ panels: { ...get().panels, [which]: !get().panels[which] } }),
        openModal: (name, props = {}) => set({ modal: { name, props } }),
        closeModal: () => set({ modal: null }),

        addToast: ({ type = 'info', message, duration = 3000 } = {}) => {
          const id = makeId('toast')
          set({ toasts: [...get().toasts, { id, type, message, duration }] })
          return id
        },
        dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

        setSaveStatus: (status) => set({ save: { ...get().save, status } }),
        markSaved: () =>
          set({
            save: {
              status: 'saved',
              lastSavedAt: new Date().toISOString(),
              lastSavedRev: get()._rev,
            },
          }),
      }
    },
    { limit: 50 }
  )
)

// Convenience hooks (stable selector functions → no needless re-renders).
export const selectCanUndo = (s) => s._history.past.length > 0
export const selectCanRedo = (s) => s._history.future.length > 0
export const useCanUndo = () => useStore(selectCanUndo)
export const useCanRedo = () => useStore(selectCanRedo)
