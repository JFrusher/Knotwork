import { describe, expect, it } from 'vitest'
import { filterDefs, matchesFilters } from './guestFilters'
import type { Guest } from '../store/types'

// Only the fields the chips read.
const guest = (g: Partial<Guest>) => g as Guest

describe('the Unassigned chip', () => {
  it('finds who still needs a seat, and not someone who is not coming', () => {
    const waiting = guest({ assignedTableId: null, rsvpStatus: 'confirmed' })
    const declined = guest({ assignedTableId: null, rsvpStatus: 'declined' })
    expect(matchesFilters(waiting, ['unassigned'])).toBe(true)
    expect(matchesFilters(declined, ['unassigned'])).toBe(false)
  })
})

// Chips in one category widen the list; chips in different categories narrow
// it. A guest has one diet and one side, so ANDing two chips from the same
// category could only ever show nobody, or only the guests on both sides.
describe('combining chips', () => {
  const veggie = guest({ dietary: 'vegetarian', side: 'a', assignedTableId: null, rsvpStatus: 'confirmed' })
  const vegan = guest({ dietary: 'vegan', side: 'b', assignedTableId: 't1', rsvpStatus: 'confirmed' })
  const neither = guest({ dietary: '', side: 'both', assignedTableId: null, rsvpStatus: 'confirmed' })

  it('shows vegetarians and vegans when both diet chips are on', () => {
    expect(matchesFilters(veggie, ['vegetarian', 'vegan'])).toBe(true)
    expect(matchesFilters(vegan, ['vegetarian', 'vegan'])).toBe(true)
    expect(matchesFilters(neither, ['vegetarian', 'vegan'])).toBe(false)
  })

  it("shows everyone from either side when both partners' chips are on", () => {
    expect(matchesFilters(veggie, ['a', 'b'])).toBe(true)
    expect(matchesFilters(vegan, ['a', 'b'])).toBe(true)
    expect(matchesFilters(neither, ['a', 'b'])).toBe(true)
  })

  it('still narrows across categories', () => {
    expect(matchesFilters(veggie, ['vegan', 'a'])).toBe(false)
    expect(matchesFilters(vegan, ['vegan', 'b'])).toBe(true)
    expect(matchesFilters(vegan, ['vegetarian', 'vegan', 'unassigned'])).toBe(false)
    expect(matchesFilters(veggie, ['vegetarian', 'vegan', 'unassigned'])).toBe(true)
  })
})

describe('the In a family chip', () => {
  it('is offered, and finds who is in a family', () => {
    expect(filterDefs({ partners: ['Alex', 'Sam'] }).map((d) => d.label)).toContain('In a family')
    expect(matchesFilters(guest({ familyId: 'fam', rsvpStatus: 'confirmed' }), ['family'])).toBe(true)
    expect(matchesFilters(guest({ familyId: null, rsvpStatus: 'confirmed' }), ['family'])).toBe(false)
  })
})
