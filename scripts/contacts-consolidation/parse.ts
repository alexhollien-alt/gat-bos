// Pure parser for an Obsidian CONTACT.md file. No I/O -- takes the file text,
// returns a RawContact. Placeholder markers are passed through verbatim;
// normalizeContact() is responsible for stripping them.
import { RawContact } from './normalize'

// Pull the value of a "**Key:** value" line (case-insensitive key match).
function field(md: string, key: string): string {
  const re = new RegExp(`^\\*\\*${key}:\\*\\*\\s*(.+)$`, 'im')
  const m = md.match(re)
  return m ? m[1].trim() : ''
}

// Market line is "zip, zip, ..., City". Drop 5-digit zips, keep the rest as city.
function cityFromMarket(market: string): string {
  if (!market) return ''
  return market
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !/^\d{5}$/.test(t))
    .join(', ')
}

export function parseContactMd(md: string, source: string): RawContact {
  const h1 = md.match(/^#\s+(.+)$/m)
  const name = h1 ? h1[1].trim() : ''
  const market = field(md, 'Market')
  return {
    name,
    email: field(md, 'Email'),
    phone: field(md, 'Phone'),
    brokerage: field(md, 'Brokerage'),
    city: cityFromMarket(market),
    tier: field(md, 'Tier'),
    source,
  }
}
