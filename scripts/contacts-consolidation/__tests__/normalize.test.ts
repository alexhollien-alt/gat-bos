import { describe, it, expect } from 'vitest'
import { normalizeContact, isPlaceholder } from '../normalize'

describe('isPlaceholder', () => {
  it('treats [PLACEHOLDER: ...] markers as absent', () => {
    expect(isPlaceholder('[PLACEHOLDER: not in Excel source]')).toBe(true)
    expect(isPlaceholder('  [PLACEHOLDER: capture later]  ')).toBe(true)
    expect(isPlaceholder('eXp Realty')).toBe(false)
    expect(isPlaceholder('')).toBe(false)
  })
})

describe('normalizeContact', () => {
  it('splits the H1 name, lowercases email, strips phone to digits, keeps tier letter', () => {
    const out = normalizeContact({
      name: '  Nate Zeune  ',
      email: '  Zeune.Nate@GMAIL.com ',
      phone: '(480) 555-1234',
      brokerage: 'eXp Realty',
      city: 'Scottsdale',
      tier: 'a',
      source: 'obsidian',
    })
    expect(out.firstName).toBe('Nate')
    expect(out.lastName).toBe('Zeune')
    expect(out.fullName).toBe('Nate Zeune')
    expect(out.email).toBe('zeune.nate@gmail.com')
    expect(out.phone).toBe('4805551234')
    expect(out.brokerage).toBe('eXp Realty')
    expect(out.tier).toBe('A')
    expect(out.sources).toEqual(['obsidian'])
    expect(out.dedupeKey).toBe('zeune.nate@gmail.com')
  })

  it('converts PLACEHOLDER field values to null/empty', () => {
    const out = normalizeContact({
      name: 'Allery Stuart',
      email: 'allery@infinitebeaconhomes.com',
      phone: '[PLACEHOLDER: not in Excel source]',
      brokerage: 'Infinite Beacon Homes',
      tier: '[PLACEHOLDER: none]',
      source: 'obsidian',
    })
    expect(out.phone).toBe('')
    expect(out.tier).toBeNull()
    expect(out.brokerage).toBe('Infinite Beacon Homes')
  })

  it('handles a single-token name (no last name)', () => {
    const out = normalizeContact({ name: 'Cher', email: 'cher@x.com', source: 'obsidian' })
    expect(out.firstName).toBe('Cher')
    expect(out.lastName).toBe('')
  })

  it('handles a three-part name (first word first, the rest is last)', () => {
    const out = normalizeContact({ name: 'Mary Jo Carpenter', email: 'mj@x.com', source: 'obsidian' })
    expect(out.firstName).toBe('Mary')
    expect(out.lastName).toBe('Jo Carpenter')
  })

  it('treats empty/placeholder email as null and falls back to a name+phone dedupe key', () => {
    const out = normalizeContact({ name: 'No Email', email: '', phone: '480-111-2222', source: 'obsidian' })
    expect(out.email).toBeNull()
    expect(out.dedupeKey).toBe('noemail|4801112222')
  })
})

// Remaining placeholders: none. The [PLACEHOLDER: ...] literals above are test
// fixtures that exercise isPlaceholder()/normalizeContact() placeholder-stripping.
