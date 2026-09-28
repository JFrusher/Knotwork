import { describe, expect, it } from 'vitest'
import { matchesFilters } from './guestFilters.js'

describe('the Unassigned chip', () => {
  it('finds who still needs a seat, and not someone who is not coming', () => {
    const waiting = { assignedTableId: null, rsvpStatus: 'confirmed' }
    const declined = { assignedTableId: null, rsvpStatus: 'declined' }
    expect(matchesFilters(waiting, ['unassigned'])).toBe(true)
    expect(matchesFilters(declined, ['unassigned'])).toBe(false)
  })
})
