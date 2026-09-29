import { emptyTrousseau, migrate } from '@jfrusher/trousseau'
import { useTrousseauStore } from '@/lib/store/useTrousseauStore'
import { SEATING_KEYS } from '../store/plan'
import type { Plan } from '../store/types'
import { useStore } from '../store/useStore'

/**
 * For tests: a wedding whose seating plan is `plan`, open and ready, with
 * nothing to undo. The guests go in the wedding's guest list, the rest in its
 * seating, and the plan's name, venue and date are the wedding's own.
 */
export function openPlan(plan: Partial<Plan>): void {
  const base = emptyTrousseau()
  const seating: Record<string, unknown> = {}
  for (const key of SEATING_KEYS) if (plan[key] !== undefined) seating[key] = plan[key]
  const meta = plan.meta
  const raw = {
    ...base,
    event: { ...base.event, coupleNames: meta?.weddingName || '', venueName: meta?.venue || '', date: meta?.date || '' },
    guests: plan.guests || {},
    seating,
  }
  useTrousseauStore.setState({ status: 'ready', raw, doc: migrate(raw), past: [], future: [] })
  useStore.setState({ selection: { type: null, id: null }, selectedGuestIds: [], modal: null, toasts: [] })
}
