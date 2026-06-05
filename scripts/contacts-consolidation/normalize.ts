// Field cleaner for the contacts consolidation. Pure functions, no I/O.
// Source rows come from CONTACT.md files and the live contacts table (see gather.ts).
// CONTACT.md uses "[PLACEHOLDER: ...]" to mean a field is absent -- those become null/empty.

export interface RawContact {
  name?: string // from the CONTACT.md "# Name" H1, or DB full_name
  email?: string
  phone?: string
  brokerage?: string
  city?: string
  tier?: string // letter grade: A / B / C / P
  source: string
}

export interface NormalizedContact {
  firstName: string
  lastName: string
  fullName: string
  email: string | null
  phone: string
  brokerage: string
  city: string
  tier: string | null // uppercase letter, or null
  sources: string[]
  dedupeKey: string
}

// A value is a placeholder when it is a "[PLACEHOLDER: ...]" marker (any bracket
// directive the CONTACT.md generator leaves behind: PLACEHOLDER / CONFIRM / MISSING TOKEN / TBD).
export function isPlaceholder(value: string | undefined): boolean {
  if (!value) return false
  return /^\s*\[(placeholder|confirm|missing token|tbd)\b/i.test(value)
}

const clean = (value: string | undefined): string => {
  const v = (value ?? '').trim()
  return isPlaceholder(v) ? '' : v
}

export function normalizeContact(raw: RawContact): NormalizedContact {
  const fullName = clean(raw.name).replace(/\s+/g, ' ')
  const parts = fullName.length ? fullName.split(' ') : []
  const firstName = parts[0] ?? ''
  const lastName = parts.slice(1).join(' ')

  const email = clean(raw.email).toLowerCase() || null
  const phone = clean(raw.phone).replace(/\D/g, '')
  const tierRaw = clean(raw.tier).toUpperCase()
  const tier = tierRaw.length ? tierRaw : null

  const dedupeKey = email ?? `${fullName.replace(/\s+/g, '').toLowerCase()}|${phone}`

  return {
    firstName,
    lastName,
    fullName,
    email,
    phone,
    brokerage: clean(raw.brokerage),
    city: clean(raw.city),
    tier,
    sources: [raw.source],
    dedupeKey,
  }
}

// Remaining placeholders: none. The bracket-marker literals above are the regex
// and doc comment that detect/strip CONTACT.md placeholder values, not real gaps.
