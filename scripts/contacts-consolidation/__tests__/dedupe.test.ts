import { describe, it, expect } from 'vitest'
import { dedupeContacts } from '../dedupe'
import { normalizeContact } from '../normalize'

describe('dedupeContacts', () => {
  it('collapses same-email rows, keeps the best (A) tier, unions sources, fills empty fields', () => {
    const input = [
      normalizeContact({ name: 'Nate Z', email: 'nate@x.com', phone: '4805551234', tier: 'B', source: 'obsidian' }),
      normalizeContact({ name: 'Nate Zeune', email: 'NATE@x.com', brokerage: 'eXp Realty', tier: 'A', source: 'supabase' }),
    ]
    const out = dedupeContacts(input)
    expect(out).toHaveLength(1)
    expect(out[0].tier).toBe('A') // A outranks B
    expect(out[0].brokerage).toBe('eXp Realty') // filled from the other row
    expect(out[0].phone).toBe('4805551234') // filled from the other row
    expect(out[0].lastName).toBe('Zeune') // longer/more-complete name wins fill
    expect(out[0].sources.sort()).toEqual(['obsidian', 'supabase'])
  })

  it('a real tier letter beats a null tier', () => {
    const input = [
      normalizeContact({ name: 'A B', email: 'ab@x.com', source: 'csv' }),
      normalizeContact({ name: 'A B', email: 'ab@x.com', tier: 'C', source: 'obsidian' }),
    ]
    expect(dedupeContacts(input)[0].tier).toBe('C')
  })

  it('does not merge two different people who share no email', () => {
    const input = [
      normalizeContact({ name: 'Person A', phone: '4801111111', source: 'csv' }),
      normalizeContact({ name: 'Person B', phone: '4802222222', source: 'csv' }),
    ]
    expect(dedupeContacts(input)).toHaveLength(2)
  })
})
