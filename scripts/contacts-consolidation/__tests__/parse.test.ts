import { describe, it, expect } from 'vitest'
import { parseContactMd } from '../parse'

const SAMPLE = `# Nate Zeune
**Brokerage:** eXp Realty
**Title:** [PLACEHOLDER: not in Excel source]
**Phone:** [PLACEHOLDER: not in Excel source]
**Email:** zeune.nate@gmail.com
**Website:** [PLACEHOLDER: not in Excel source]
**License:** [PLACEHOLDER: not in Excel source]
**Market:** 85258, 85260, 85253, Scottsdale
**Tier:** A
**Tags:** Realtor, Scottsdale
**Last contact:** 2026-04-01

---

## Assets (for auto-pull by design skills)
`

describe('parseContactMd', () => {
  it('extracts the H1 name and bold-key fields into a RawContact', () => {
    const raw = parseContactMd(SAMPLE, 'obsidian')
    expect(raw.name).toBe('Nate Zeune')
    expect(raw.email).toBe('zeune.nate@gmail.com')
    expect(raw.brokerage).toBe('eXp Realty')
    expect(raw.tier).toBe('A')
    expect(raw.source).toBe('obsidian')
  })

  it('derives city from the Market line by dropping zip codes', () => {
    const raw = parseContactMd(SAMPLE, 'obsidian')
    expect(raw.city).toBe('Scottsdale')
  })

  it('passes placeholder field values through verbatim (normalize strips them later)', () => {
    const raw = parseContactMd(SAMPLE, 'obsidian')
    expect(raw.phone).toBe('[PLACEHOLDER: not in Excel source]')
  })

  it('handles a Market line with no city (zips only) as empty city', () => {
    const raw = parseContactMd('# Test Person\n**Market:** 85258, 85260\n', 'obsidian')
    expect(raw.city).toBe('')
  })
})

// Remaining placeholders: none. The bracket-marker literals above are the SAMPLE
// CONTACT.md fixture that verifies placeholder pass-through, not real gaps.
