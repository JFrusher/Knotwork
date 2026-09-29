import { emptyTrousseau, migrate } from '@jfrusher/trousseau'
import { useTrousseauStore } from '@/lib/store/useTrousseauStore'
import { SEATING_KEYS } from '../store/sliceBridge'
import { useStore } from '../store/useStore.js'

/**
 * For tests: a wedding whose seating plan is `plan`, open and ready, with
 * nothing to undo. The guests go in the wedding's guest list, the rest in its
 * seating, and the plan's name, venue and date are the wedding's own.
 */
export function openPlan(plan) {
  const base = emptyTrousseau()
  const seating = {}
  for (const key of SEATING_KEYS) if (plan[key] !== undefined) seating[key] = plan[key]
  const meta = plan.meta || {}
  const raw = {
    ...base,
    event: { ...base.event, coupleNames: meta.weddingName || '', venueName: meta.venue || '', date: meta.date || '' },
    guests: plan.guests || {},
    seating,
  }
  useTrousseauStore.setState({ status: 'ready', raw, doc: migrate(raw), past: [], future: [] })
  useStore.setState({ selection: { type: null, id: null }, selectedGuestIds: [], modal: null, toasts: [] })
}
