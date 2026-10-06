import { sideShort } from '@/lib/model/partners'
import { isComing } from '@/lib/model/slices'
import type { Guest, Meta } from '../store/types'

// TODO(family-ux): no "in a family" (or per-family) filter chip exists —
// would need an entry here AND in PREDICATES below, and a predicate can't
// just check truthiness of a static key since it'd need the families dict
// (guest.familyId alone isn't enough context for a per-family filter).
// See tmp/family-ux-followups.md #8.
/**
 * Filter chips shown beneath the guest search box, and their predicates. The
 * two side chips are named after the partners — "Alex's", "Sam's" — from the
 * wedding's `meta`.
 */
export function filterDefs(meta: Pick<Meta, 'partners'>): Array<{ key: FilterKey; label: string }> {
  return [
    { key: 'unassigned', label: 'Unassigned' },
    { key: 'a', label: sideShort('a', meta) },
    { key: 'b', label: sideShort('b', meta) },
    { key: 'vegetarian', label: 'Vegetarian' },
    { key: 'vegan', label: 'Vegan' },
    { key: 'gluten-free', label: 'GF' },
    { key: 'notes', label: 'Has notes' },
  ]
}

type FilterKey = 'unassigned' | 'a' | 'b' | 'vegetarian' | 'vegan' | 'gluten-free' | 'notes'

const PREDICATES: Record<FilterKey, (guest: Guest) => boolean> = {
  // Who still needs a seat: someone who declined does not.
  unassigned: (g) => isComing(g) && !g.assignedTableId,
  a: (g) => g.side === 'a' || g.side === 'both',
  b: (g) => g.side === 'b' || g.side === 'both',
  vegetarian: (g) => g.dietary === 'vegetarian',
  vegan: (g) => g.dietary === 'vegan',
  'gluten-free': (g) => g.dietary === 'gluten-free',
  notes: (g) => !!(g.notes && g.notes.trim()),
}

/**
 * Chips in one category widen the list, and chips in different categories
 * narrow it: Vegetarian + Vegan is everyone on either diet, and Vegan + Alex's
 * is Alex's vegans. A guest has one diet and one side, so ANDing two chips of
 * the same category could only ever show nobody, or just the guests on both
 * sides.
 */
const CATEGORY: Record<FilterKey, string> = {
  unassigned: 'seat',
  a: 'side',
  b: 'side',
  vegetarian: 'diet',
  vegan: 'diet',
  'gluten-free': 'diet',
  notes: 'notes',
}

export function matchesFilters(guest: Guest, filters: readonly string[] | null | undefined): boolean {
  if (!filters || filters.length === 0) return true
  const byCategory = new Map<string, FilterKey[]>()
  for (const f of filters) {
    if (!(f in PREDICATES)) continue
    const key = f as FilterKey
    byCategory.set(CATEGORY[key], [...(byCategory.get(CATEGORY[key]) ?? []), key])
  }
  return [...byCategory.values()].every((keys) => keys.some((key) => PREDICATES[key](guest)))
}

/**
 * Does the guest match the search box? Their own names count, and so do the
 * names of the group, subgroup and family they are in, so searching "The
 * Engines" finds the Engines.
 */
export function matchesSearch(guest: Guest, containerNames: readonly (string | undefined)[], query: string): boolean {
  if (!query) return true
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [guest.fullName, guest.firstName, guest.lastName, ...containerNames].some((name) =>
    (name || '').toLowerCase().includes(q)
  )
}

export const initials = (name = ''): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || '?'

/** "Sarah M." — first name + last initial, for compact in-table name boxes. */
export const shortName = (guest: Pick<Guest, 'fullName' | 'firstName' | 'lastName'> | null | undefined): string => {
  if (!guest) return '?'
  const parts = (guest.fullName || '').split(/\s+/).filter(Boolean)
  const first = guest.firstName || parts[0] || ''
  const lastSource = guest.lastName || parts.slice(1).join(' ')
  const lastInitial = lastSource ? `${lastSource[0].toUpperCase()}.` : ''
  return [first, lastInitial].filter(Boolean).join(' ') || guest.fullName || '?'
}

// Does `text` fit in `maxLines` lines of `charsPerLine`, wrapping at spaces?
// (A single word longer than a line never fits — we'd rather drop to a shorter
// label than truncate mid-word.)
const fitsLines = (text: string, charsPerLine: number, maxLines: number): boolean => {
  if (charsPerLine <= 0) return false
  if (text.length <= charsPerLine) return true
  if (maxLines < 2) return false
  let used = 1
  let cur = 0
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if (w.length > charsPerLine) return false
    if (cur === 0) cur = w.length
    else if (cur + 1 + w.length <= charsPerLine) cur += 1 + w.length
    else {
      used += 1
      cur = w.length
      if (used > maxLines) return false
    }
  }
  return used <= maxLines
}

/**
 * Pick the richest label that fits a name box: full name → "First L." → first
 * name → initials. Always returns at least initials so a guest is never blank.
 */
export const pickGuestLabel = (
  guest: Pick<Guest, 'fullName' | 'firstName' | 'lastName'> | null | undefined,
  charsPerLine: number,
  maxLines = 1
): string => {
  if (!guest) return '?'
  const fallback = initials(guest.fullName)
  const candidates = [guest.fullName, shortName(guest), guest.firstName, fallback]
  for (const c of candidates) {
    if (c && fitsLines(c, charsPerLine, maxLines)) return c
  }
  return fallback
}
