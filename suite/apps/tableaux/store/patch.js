/**
 * Applying a command's patch.
 *
 * Every mutation in `actions.js` is a *command* — `{ type, label, payload }`
 * — whose `payload` is a patch in the shape below. `applyPatch` is the one
 * pure function that applies one: Seating's own store runs its commands
 * through it before writing the result into the wedding, and so does the
 * Guests page, which edits the same guests with the same commands.
 *
 * Commands still carry an `inverse`. Nothing reads it now — undo is the
 * wedding's own history, which keeps each whole state — and it is left in
 * the commands rather than removed from nineteen hundred lines of them.
 */

const ENTITY_COLLECTIONS = ['guests', 'groups', 'tables', 'zones', 'subgroups', 'families', 'wallElements', 'pillars']
const SINGLETONS = ['meta', 'room', 'settings']

/**
 * Apply a patch to the document slices of `state`, returning only the changed
 * top-level keys (Zustand shallow-merges them back in).
 *
 *   - Entity collections (guests/groups/tables/zones): a map of id → entity to
 *     set, or id → null to delete.
 *   - Singletons (meta/room/settings): a shallow-merged partial.
 *   - constraints / snapshots: whole-array replacement.
 *
 * Never mutates the input, and leaves every entity it was not given as the
 * same object — so a table nobody touched is not redrawn.
 */
export function applyPatch(state, patch) {
  if (!patch) return {}
  const update = {}

  for (const key of ENTITY_COLLECTIONS) {
    if (patch[key]) {
      const next = { ...state[key] }
      for (const [id, value] of Object.entries(patch[key])) {
        if (value === null || value === undefined) delete next[id]
        else next[id] = value
      }
      update[key] = next
    }
  }

  for (const key of SINGLETONS) {
    if (patch[key]) update[key] = { ...state[key], ...patch[key] }
  }

  if (patch.constraints) update.constraints = patch.constraints
  if (patch.snapshots) update.snapshots = patch.snapshots

  return update
}
