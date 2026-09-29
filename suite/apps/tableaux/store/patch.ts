import type { Collection, Patch, Plan } from './types'

/**
 * Applying a command's patch.
 *
 * Every edit in `actions.ts` is a *command* — `{ type, label, payload }` —
 * whose `payload` is a patch in the shape below. `applyPatch` is the one pure
 * function that applies one: Seating's own store runs its commands through it
 * before writing the result into the wedding, and so do the Guests page and
 * setup, which make the same changes with the same commands.
 */

const COLLECTIONS: readonly Collection[] = [
  'guests',
  'groups',
  'tables',
  'zones',
  'subgroups',
  'families',
  'wallElements',
  'pillars',
]

/** `current` with `changes` set, and every id given `null` removed. */
function merged<T>(current: Record<string, T>, changes: Record<string, T | null>): Record<string, T> {
  const next = { ...current }
  for (const [id, value] of Object.entries(changes)) {
    if (value === null || value === undefined) delete next[id]
    else next[id] = value
  }
  return next
}

/**
 * Apply a patch to a plan, returning only the changed top-level keys.
 *
 *   - Entity collections (guests/groups/tables/zones…): a map of id → entity
 *     to set, or id → null to delete.
 *   - Singletons (meta/room/settings): a shallow-merged partial.
 *   - constraints / snapshots: whole-array replacement.
 *
 * Never mutates the input, and leaves every entity it was not given as the
 * same object — so a table nobody touched is not redrawn.
 */
export function applyPatch(plan: Plan, patch: Patch | null | undefined): Partial<Plan> {
  if (!patch) return {}
  const update: Partial<Plan> = {}

  for (const key of COLLECTIONS) {
    const changes = patch[key]
    if (changes) {
      ;(update as Record<Collection, unknown>)[key] = merged(plan[key] as Record<string, unknown>, changes as Record<string, unknown>)
    }
  }

  if (patch.meta) update.meta = { ...plan.meta, ...patch.meta }
  if (patch.room) update.room = { ...plan.room, ...patch.room }
  if (patch.settings) update.settings = { ...plan.settings, ...patch.settings }
  if (patch.constraints) update.constraints = patch.constraints
  if (patch.snapshots) update.snapshots = patch.snapshots

  return update
}
