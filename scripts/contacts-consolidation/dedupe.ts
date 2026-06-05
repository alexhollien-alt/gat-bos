// Merge normalized contacts by dedupe key. Pure function, no I/O.
import { NormalizedContact } from './normalize'

// Lower rank = stronger relationship. Letter grades A best -> P, null worst.
const tierRank = (t: string | null): number => {
  if (!t) return Infinity
  const order: Record<string, number> = { A: 0, B: 1, C: 2, P: 3 }
  return order[t] ?? 4
}

const bestTier = (a: string | null, b: string | null): string | null =>
  tierRank(a) <= tierRank(b) ? a : b

const firstNonEmpty = (a: string, b: string): string => (a && a.length ? a : b)

// More-complete name wins: more name parts first, then longer string.
const nameScore = (c: NormalizedContact): number =>
  c.fullName.split(' ').filter(Boolean).length * 1000 + c.fullName.length

export function dedupeContacts(list: NormalizedContact[]): NormalizedContact[] {
  const byKey = new Map<string, NormalizedContact>()
  for (const c of list) {
    const existing = byKey.get(c.dedupeKey)
    if (!existing) {
      byKey.set(c.dedupeKey, { ...c, sources: [...c.sources] })
      continue
    }
    const nameWinner = nameScore(existing) >= nameScore(c) ? existing : c
    existing.firstName = nameWinner.firstName
    existing.lastName = nameWinner.lastName
    existing.fullName = nameWinner.fullName
    existing.email = existing.email ?? c.email
    existing.phone = firstNonEmpty(existing.phone, c.phone)
    existing.brokerage = firstNonEmpty(existing.brokerage, c.brokerage)
    existing.city = firstNonEmpty(existing.city, c.city)
    existing.tier = bestTier(existing.tier, c.tier)
    for (const s of c.sources) if (!existing.sources.includes(s)) existing.sources.push(s)
  }
  return [...byKey.values()]
}
