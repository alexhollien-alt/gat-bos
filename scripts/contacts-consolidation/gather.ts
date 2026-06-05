// Assemble the canonical client-agent list from the Obsidian CONTACT.md store.
// Run: pnpm tsx scripts/contacts-consolidation/gather.ts
//
// Source of truth = ~88 CONTACT.md files (one per agent dir). The live contacts
// table is the IMPORT TARGET, reconciled via ON CONFLICT (email) at Task 1.5 --
// not a source here. This script only assembles + dedupes + reports.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { parseContactMd } from './parse'
import { normalizeContact, NormalizedContact, RawContact } from './normalize'
import { dedupeContacts } from './dedupe'

const AGENTS_DIR =
  process.argv[2] ?? '/Users/alex/Documents/Alex Hub(Obs)/05_AGENTS'
const OUT = join(__dirname, '_merged.json')

function gatherFromObsidian(dir: string): RawContact[] {
  const out: RawContact[] = []
  for (const entry of readdirSync(dir)) {
    const contactPath = join(dir, entry, 'CONTACT.md')
    try {
      if (!statSync(contactPath).isFile()) continue
      out.push(parseContactMd(readFileSync(contactPath, 'utf8'), 'obsidian'))
    } catch {
      // no CONTACT.md in this dir -- skip
    }
  }
  return out
}

const raw = gatherFromObsidian(AGENTS_DIR)
const normalized: NormalizedContact[] = raw.map(normalizeContact)
const merged = dedupeContacts(normalized)

const withEmail = merged.filter((c) => c.email)
const noEmail = merged.filter((c) => !c.email)
const tierCounts = merged.reduce<Record<string, number>>((acc, c) => {
  const k = c.tier ?? '(none)'
  acc[k] = (acc[k] ?? 0) + 1
  return acc
}, {})

console.log(`Source dir:     ${AGENTS_DIR}`)
console.log(`Sources rows:   ${raw.length}`)
console.log(`After dedupe:   ${merged.length}`)
console.log(`Collapsed:      ${raw.length - merged.length}`)
console.log(`With email:     ${withEmail.length}  (upsertable by email)`)
console.log(`No email:       ${noEmail.length}  (need manual key / skip)`)
console.log(`Tier spread:    ${JSON.stringify(tierCounts)}`)
if (noEmail.length) {
  console.log(`No-email names: ${noEmail.map((c) => c.fullName).join(', ')}`)
}

writeFileSync(OUT, JSON.stringify(merged, null, 2))
console.log(`Wrote ${merged.length} contacts -> ${OUT}`)
