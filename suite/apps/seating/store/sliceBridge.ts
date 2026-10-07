import { useKnotworkStore, type WriteOptions } from '@/lib/store/useKnotworkStore'
import { planFrom, slicesOf } from './plan'
import type { Plan } from './types'

/**
 * Where Seating's plan lives: the wedding in the shared store.
 *
 * Seating started as Tableaux, the one tool with a back end of its own: an Express server, a
 * Supabase account, plan revisions and optimistic concurrency. All of that is
 * the shell's job now — it stores the wedding locally, syncs it to the
 * account, and resolves conflicts across devices — so what is left here is
 * the part that was always Seating's: the plan itself. See `plan.ts` for how
 * it is read and written.
 */

/** The plan the wedding holds now. */
export function readDoc(): Plan {
  const { raw, doc } = useKnotworkStore.getState()
  return planFrom(raw, doc.event)
}

/** True only while Seating's own write is being made. */
let writing = false

/**
 * Whether the change the wedding is announcing is Seating's own write, being
 * made now. The store already shows it, so it is not read back.
 *
 * Asked of the moment rather than of the objects: an undo can bring back the
 * very objects Seating last wrote while it is showing something newer.
 */
export function isWriting(): boolean {
  return writing
}

/** Into the wedding, as one step on its history. */
export function writeDoc(plan: Plan, options: WriteOptions): void {
  const { guests, seating } = slicesOf(plan)
  writing = true
  try {
    useKnotworkStore.getState().setSlices(
      [
        ['guests', guests],
        ['seating', seating],
      ],
      options,
    )
  } finally {
    writing = false
  }
}
