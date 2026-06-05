# System Consolidation Gameplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate Alex's fragmented contact data, marketing system, and config sprawl into one canonical, low-maintenance system, executed one fully-finished scope at a time.

**Architecture:** Six sequential scopes. Scope 1 makes Supabase the single source of truth for contacts (assembled from scattered stores). Scopes 2-6 build the relationship cadence on top of it, then defragment memory, collapse redundant skills, and flatten the router. Each scope is self-contained, produces a working result, and has an explicit DONE gate. You do not start a scope until the previous scope's DONE gate is green.

**Tech Stack:** Next.js 14 (App Router), Supabase (CLI-only per Rule 23), TypeScript, pnpm. Config layer is Markdown under `~/.claude/`.

---

## How To Use This Plan (read once)

1. **One scope at a time.** Finish every checkbox in the current scope AND pass its DONE gate before opening the next scope. Do not interleave.
2. **The Master Index below is your reference to everything.** It is the whole journey on one screen. Each scope links to its detail (Scope 1) or its scope-card (Scopes 2-6).
3. **Expand-on-arrival.** Scope 1 is fully detailed. When you finish a scope and the next one is a card (Scopes 2-6), run `/superpowers:writing-plans` on that single card first. It will expand the card into bite-sized TDD tasks against the repo as it actually exists that day. This is deliberate: it keeps each scope's detail accurate instead of guessed weeks early.
4. **Approval gates still fire.** Local edits and scripts run autonomously. The actual production writes called out in each scope (prod DB push, rule-file changes that alter behavior, skill retirement) stop for your "go" per Standing Rule 5.

---

## Master Index (the whole journey)

| # | Scope | One-line goal | DONE when |
|---|-------|---------------|-----------|
| 1 | **Contact-of-truth** | Assemble the ~88 client agents into Supabase; make every other store a read-only mirror | `contacts` holds the deduped client list, count verified, Obsidian is generated from it, Rule 19 updated |
| 2 | **Relationship cadence** | Daily "who's gone cold / who do I owe a touch," reading only from canonical Supabase | One surface answers "which agents have I not touched in N days" in under 10s, no cross-referencing |
| 3 | **Memory & STATUS defrag** | One canonical memory store; STATUS capped to one line per item; startup-injection conflict resolved | Memory has one source of truth, STATUS passes its own size template, one behavioral mode declared the winner |
| 4 | **One ship-check skill** | Collapse the 5+ overlapping design-QA skills into a single pre-ship check | One skill name runs the full check; redundant QA skills retired or folded; nothing unfired-in-60-days left active |
| 5 | **Router flatten** | Collapse routing files into one decision table; drop the recited HAT block | A new piece routes from one table, no HAT preamble recited, workflow-shaped standing rules relocated per Rule 25 |
| 6 | **Campaign sending decision** | Decide keep-custom-blast vs. bought tool, then harden or migrate the chosen path | Decision written down with rationale; the not-chosen path is explicitly closed |

**Sequencing rule:** 1 → 2 → 3 → 4 → 5 → 6. Scope 1 unblocks 2. Scopes 3-6 are independent of each other and could reorder, but run them after 2 so the revenue-relevant work lands first.

---

# SCOPE 1 -- Contact-of-Truth (FULLY DETAILED)

**Scope goal:** `contacts` in Supabase becomes the one complete, deduped home for your ~300 contacts. Obsidian and any spreadsheet become read-only mirrors generated from it. Rule 19's bidirectional contact write is retired.

**Why this is first:** Every downstream scope (cadence, briefings, marketing targeting) reads contacts. Today they live in four places that disagree. Fix the asset the whole business runs on before building anything on top of it.

---

### ORIENTATION FINDINGS (2026-06-04) -- corrections to this scope from real repo state

Task 1.0 ran. The scope is sound; these specifics override the plan's original assumptions:

- **Canonical set = ~88 client agents, NOT ~300.** Locked with Alex. Cold MLS blast recipients stay OUT of `contacts` (they belong in a separate `blast_recipients` table per the 2026-06-04 open-house direction). Scope 1 does not evict the existing recipient rows -- that is open-house/blast-table work, not this scope. Scope 1 only makes the 88 clients canonical and complete.
- **Source of truth = 88 `CONTACT.md` files** at `/Users/alex/Documents/Alex Hub(Obs)/05_AGENTS/<Name>/CONTACT.md`. The April `agents-index.json` is gone (one-time artifact). CONTACT.md shape is markdown `**Key:** value` lines + an `# Name` H1. `[PLACEHOLDER: ...]` values mean ABSENT -> normalize to null.
- **Reconcile, not greenfield.** Real target is **prod** `contacts`. Local DB (243 rows: 12 seed-tiered + 208 berneil recipients + ~22 misc, 3 accounts) is a seed/test harness, not the client list. The import upserts the 88 clients by email against prod.
- **`tier` is a LETTER** (`A`/`B`/`C`/`P`), stored as text. Rank A best; keep as text on insert. The plan's numeric tier ranking is wrong -- corrected in Tasks 1.1/1.2 below.
- **NOT NULL columns the plan's insert omits:** `account_id`, `first_name`, `last_name`. Names come from the H1 (split on first space). `account_id` = Alex's primary account (confirm the prod UUID at the import gate; the 3 local accounts are seed/berneil/misc).
- **`stage` has a CHECK constraint:** valid values are `new`, `warm`, `active_partner`, `advocate`, `dormant`. The old import's `'active'` is invalid. Default new client rows to `new` (or leave the column default).
- **`email` uniqueness exists** (`contacts_email_unique`) -- `ON CONFLICT (email)` upsert is valid.

**Files:**
- Create: `~/crm/scripts/contacts-consolidation/normalize.ts`
- Create: `~/crm/scripts/contacts-consolidation/dedupe.ts`
- Create: `~/crm/scripts/contacts-consolidation/gather.ts`
- Create: `~/crm/scripts/contacts-consolidation/__tests__/normalize.test.ts`
- Create: `~/crm/scripts/contacts-consolidation/__tests__/dedupe.test.ts`
- Create: `~/crm/supabase/migrations/<timestamp>_import_consolidated_contacts.sql` (generated in Task 6)
- Modify: `~/.claude/rules/standing-rules.md` (Rule 19 contact carve-out, Task 7)

---

### Task 1.0: Orient -- confirm reality before writing code

- [ ] **Step 1: Confirm the test runner and scripts**

Run:
```bash
cd ~/crm && cat package.json | grep -A20 '"scripts"'
ls node_modules/.bin | grep -E 'vitest|jest'
```
Expected: you see a `test` script and either `vitest` or `jest`. Note which. Every test command below uses `pnpm test`; if the runner is jest not vitest, the `describe/it/expect` syntax below still works unchanged.

- [ ] **Step 2: Confirm the contacts schema (the real column names)**

Run:
```bash
cd ~/crm && supabase db dump --local --schema public 2>/dev/null | grep -A40 'CREATE TABLE.*"contacts"'
```
Expected: the real column list. Confirm these exist (the plan assumes them): `email`, `full_name` (or `name`), `phone`, `tier`, `stage`, `farm_area`, `deleted_at`. **Write the actual column names down** -- if `name` is used instead of `full_name`, substitute it everywhere below.

- [ ] **Step 3: Confirm where the scattered sources physically are**

Run:
```bash
ls ~/Desktop ~/Documents 2>/dev/null | grep -iE 'contact|agent|export|mls|\.csv'
ls "~/Documents/Alex Hub(Obs)/wiki/" 2>/dev/null | head -30
```
Expected: you locate (a) any contact CSV/spreadsheet exports, (b) the Obsidian wiki dir holding `CONTACT.md` files. Note their paths. If a Cypher export is wanted as a source, export it from the Cypher bookmark to `~/Desktop/cypher-contacts.csv` now (manual, or via ghost-os browser automation against the bookmarked Cypher tab). Cypher is **optional** here, not required.

- [ ] **Step 4: Create the workspace**

Run:
```bash
mkdir -p ~/crm/scripts/contacts-consolidation/__tests__
```
Expected: directory created.

---

### Task 1.1: normalizeContact -- TDD the field cleaner

**Files:**
- Create: `~/crm/scripts/contacts-consolidation/normalize.ts`
- Test: `~/crm/scripts/contacts-consolidation/__tests__/normalize.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/normalize.test.ts
import { describe, it, expect } from 'vitest'
import { normalizeContact } from '../normalize'

describe('normalizeContact', () => {
  it('lowercases and trims email, strips phone to digits, trims name', () => {
    const out = normalizeContact({
      name: '  Julie Jarmiolowski  ',
      email: '  Julie@Example.COM ',
      phone: '(480) 555-1234',
      brokerage: 'Optima',
      city: 'Scottsdale',
      tier: '1',
      source: 'supabase',
    })
    expect(out.email).toBe('julie@example.com')
    expect(out.phone).toBe('4805551234')
    expect(out.fullName).toBe('Julie Jarmiolowski')
    expect(out.tier).toBe(1)
    expect(out.sources).toEqual(['supabase'])
  })

  it('treats empty email as null and keeps a name+phone key fallback', () => {
    const out = normalizeContact({ name: 'No Email', email: '', phone: '4801112222', source: 'obsidian' })
    expect(out.email).toBeNull()
    expect(out.dedupeKey).toBe('noemail|4801112222')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/crm && pnpm test normalize`
Expected: FAIL with "Cannot find module '../normalize'".

- [ ] **Step 3: Write minimal implementation**

```typescript
// normalize.ts
export interface RawContact {
  name?: string
  email?: string
  phone?: string
  brokerage?: string
  city?: string
  tier?: string | number
  source: string
}

export interface NormalizedContact {
  fullName: string
  email: string | null
  phone: string
  brokerage: string
  city: string
  tier: number | null
  sources: string[]
  dedupeKey: string
}

export function normalizeContact(raw: RawContact): NormalizedContact {
  const fullName = (raw.name ?? '').trim()
  const email = (raw.email ?? '').trim().toLowerCase() || null
  const phone = (raw.phone ?? '').replace(/\D/g, '')
  const tier = raw.tier === undefined || raw.tier === '' ? null : Number(raw.tier)
  const dedupeKey = email ?? `${fullName.replace(/\s+/g, '').toLowerCase()}|${phone}`
  return {
    fullName,
    email,
    phone,
    brokerage: (raw.brokerage ?? '').trim(),
    city: (raw.city ?? '').trim(),
    tier: Number.isNaN(tier as number) ? null : tier,
    sources: [raw.source],
    dedupeKey,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/crm && pnpm test normalize`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/crm && git add scripts/contacts-consolidation/normalize.ts scripts/contacts-consolidation/__tests__/normalize.test.ts
git commit -m "feat(contacts): normalizeContact field cleaner with tests"
```

---

### Task 1.2: dedupeContacts -- TDD the merge

**Files:**
- Create: `~/crm/scripts/contacts-consolidation/dedupe.ts`
- Test: `~/crm/scripts/contacts-consolidation/__tests__/dedupe.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/dedupe.test.ts
import { describe, it, expect } from 'vitest'
import { dedupeContacts } from '../dedupe'
import { normalizeContact } from '../normalize'

describe('dedupeContacts', () => {
  it('collapses same-email rows, keeps the best tier, unions sources, fills empty fields', () => {
    const input = [
      normalizeContact({ name: 'Julie J', email: 'julie@x.com', phone: '4805551234', tier: '2', source: 'obsidian' }),
      normalizeContact({ name: 'Julie Jarmiolowski', email: 'JULIE@x.com', brokerage: 'Optima', tier: '1', source: 'supabase' }),
    ]
    const out = dedupeContacts(input)
    expect(out).toHaveLength(1)
    expect(out[0].tier).toBe(1)              // best (lowest number) tier wins
    expect(out[0].brokerage).toBe('Optima')  // fills empty from the other row
    expect(out[0].phone).toBe('4805551234')  // fills empty from the other row
    expect(out[0].sources.sort()).toEqual(['obsidian', 'supabase'])
  })

  it('does not merge two different people who share no email', () => {
    const input = [
      normalizeContact({ name: 'Person A', phone: '4801111111', source: 'csv' }),
      normalizeContact({ name: 'Person B', phone: '4802222222', source: 'csv' }),
    ]
    expect(dedupeContacts(input)).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/crm && pnpm test dedupe`
Expected: FAIL with "Cannot find module '../dedupe'".

- [ ] **Step 3: Write minimal implementation**

```typescript
// dedupe.ts
import { NormalizedContact } from './normalize'

const bestTier = (a: number | null, b: number | null): number | null => {
  if (a === null) return b
  if (b === null) return a
  return Math.min(a, b) // tier 1 outranks tier 2
}

const firstNonEmpty = (a: string, b: string): string => (a && a.length ? a : b)

export function dedupeContacts(list: NormalizedContact[]): NormalizedContact[] {
  const byKey = new Map<string, NormalizedContact>()
  for (const c of list) {
    const existing = byKey.get(c.dedupeKey)
    if (!existing) {
      byKey.set(c.dedupeKey, { ...c, sources: [...c.sources] })
      continue
    }
    existing.fullName = firstNonEmpty(existing.fullName, c.fullName)
    existing.email = existing.email ?? c.email
    existing.phone = firstNonEmpty(existing.phone, c.phone)
    existing.brokerage = firstNonEmpty(existing.brokerage, c.brokerage)
    existing.city = firstNonEmpty(existing.city, c.city)
    existing.tier = bestTier(existing.tier, c.tier)
    for (const s of c.sources) if (!existing.sources.includes(s)) existing.sources.push(s)
  }
  return [...byKey.values()]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/crm && pnpm test dedupe`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/crm && git add scripts/contacts-consolidation/dedupe.ts scripts/contacts-consolidation/__tests__/dedupe.test.ts
git commit -m "feat(contacts): dedupeContacts merge with tier + source union"
```

---

### Task 1.3: gather -- pull every source into one normalized array

**Files:**
- Create: `~/crm/scripts/contacts-consolidation/gather.ts`

This task has no pure-function test (it does I/O). Verify by row counts.

- [ ] **Step 1: Write the gather script**

```typescript
// gather.ts
// Run with: pnpm tsx scripts/contacts-consolidation/gather.ts
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { normalizeContact, NormalizedContact, RawContact } from './normalize'
import { dedupeContacts } from './dedupe'

// --- Source A: Supabase current contacts (local) ---
function fromSupabase(): RawContact[] {
  const json = execSync(
    `supabase db dump --local --data-only --table public.contacts 2>/dev/null || echo '[]'`,
    { cwd: process.cwd(), encoding: 'utf8' }
  )
  // If db dump emits SQL not JSON, replace this with a psql \copy to CSV in Task 1.0 Step 2's confirmed shape.
  // Placeholder-free fallback: read a pre-exported CSV if present.
  return parseCsvIfExists('./scripts/contacts-consolidation/_supabase.csv', 'supabase')
}

// --- Source B: spreadsheet/CSV exports ---
// --- Source C: Cypher export (optional) ---
function parseCsvIfExists(path: string, source: string): RawContact[] {
  try {
    const text = readFileSync(path, 'utf8').trim()
    const [header, ...rows] = text.split('\n')
    const cols = header.split(',').map((c) => c.trim().toLowerCase())
    return rows.map((line) => {
      const cells = line.split(',')
      const get = (k: string) => cells[cols.indexOf(k)]?.trim() ?? ''
      return { name: get('name') || get('full_name'), email: get('email'), phone: get('phone'),
        brokerage: get('brokerage'), city: get('city'), tier: get('tier'), source }
    })
  } catch {
    return []
  }
}

// --- Source D: Obsidian CONTACT.md (one folder, frontmatter or simple fields) ---
// Keep simple: drop each contact's name/email/phone into a CSV at the path below first,
// or extend this parser once the CONTACT.md shape is confirmed in Task 1.0 Step 3.

const raw: RawContact[] = [
  ...fromSupabase(),
  ...parseCsvIfExists('/Users/alex/Desktop/cypher-contacts.csv', 'cypher'),
  // add each confirmed CSV path from Task 1.0 Step 3 here, one parseCsvIfExists per file
]

const normalized: NormalizedContact[] = raw.map(normalizeContact)
const merged = dedupeContacts(normalized)

console.log(`Sources rows: ${raw.length}`)
console.log(`After dedupe: ${merged.length}`)
console.log(`Collapsed: ${raw.length - merged.length}`)
writeFileSync('./scripts/contacts-consolidation/_merged.json', JSON.stringify(merged, null, 2))
```

- [ ] **Step 2: Stage each confirmed source as a CSV**

For every source path you found in Task 1.0 Step 3, either point a `parseCsvIfExists(...)` line at it, or export it to a CSV with columns `name,email,phone,brokerage,city,tier`. Supabase: `psql "$LOCAL_DB_URL" -c "\copy (select full_name as name, email, phone, brokerage, city, tier from contacts where deleted_at is null) to './scripts/contacts-consolidation/_supabase.csv' csv header"` (substitute the real column names from Task 1.0 Step 2).

- [ ] **Step 3: Run gather and read the report**

Run: `cd ~/crm && pnpm tsx scripts/contacts-consolidation/gather.ts`
Expected: prints "Sources rows / After dedupe / Collapsed" and writes `_merged.json`. Sanity-check: After dedupe should be near your real ~300, not wildly higher (un-merged dupes) or near zero (a source failed to load).

- [ ] **Step 4: Commit the scripts (not the data files)**

```bash
cd ~/crm && printf '_*.csv\n_*.json\n' >> scripts/contacts-consolidation/.gitignore
git add scripts/contacts-consolidation/gather.ts scripts/contacts-consolidation/.gitignore
git commit -m "feat(contacts): gather + merge all sources into one normalized list"
```

---

### Task 1.4: Human review gate (the dry run)

- [ ] **Step 1: Eyeball the merge**

Run: `cd ~/crm && head -60 scripts/contacts-consolidation/_merged.json`
Confirm: tiers look right, no obvious duplicate names that should have merged, your 25 active agents are all present. If dupes survived, the dedupe key missed them (e.g., different emails for the same person) -- add a manual merge pass or fix the key, re-run gather.

- [ ] **Step 2: STOP. Get Alex's "go" before any database write.**

This is the Standing Rule 5 gate. Loading into the canonical table is the first irreversible step. Show Alex the three-number report and the count. Wait for "go".

---

### Task 1.5: Import into Supabase (canonical)

**Files:**
- Create: `~/crm/supabase/migrations/<timestamp>_import_consolidated_contacts.sql`

- [ ] **Step 1: Generate an idempotent upsert migration from `_merged.json`**

Run: `cd ~/crm && supabase migration new import_consolidated_contacts`
Then write the migration body as an `INSERT ... ON CONFLICT (email) DO UPDATE` (idempotent, `DROP`-free, soft-delete-safe). Generate the `VALUES` rows from `_merged.json` with a small script:
```bash
cd ~/crm && pnpm tsx -e "
const m=require('./scripts/contacts-consolidation/_merged.json');
const esc=s=>(s??'').replace(/'/g,\"''\");
const rows=m.filter(c=>c.email).map(c=>\`('\${esc(c.fullName)}','\${esc(c.email)}','\${esc(c.phone)}','\${esc(c.brokerage)}','\${esc(c.city)}',\${c.tier??'NULL'})\`).join(',\n');
console.log(rows);
" > scripts/contacts-consolidation/_rows.sql
```
Paste those rows into the migration:
```sql
insert into public.contacts (full_name, email, phone, brokerage, city, tier)
values
  -- _rows.sql content here
on conflict (email) do update set
  full_name = coalesce(nullif(excluded.full_name, ''), public.contacts.full_name),
  phone     = coalesce(nullif(excluded.phone, ''), public.contacts.phone),
  brokerage = coalesce(nullif(excluded.brokerage, ''), public.contacts.brokerage),
  city      = coalesce(nullif(excluded.city, ''), public.contacts.city),
  tier      = coalesce(excluded.tier, public.contacts.tier);
```
(Confirm `contacts` has a unique constraint on `email`; if not, add `create unique index if not exists contacts_email_key on public.contacts (lower(email)) where deleted_at is null;` as the migration's first statement.)

- [ ] **Step 2: Apply locally and verify count**

Run:
```bash
cd ~/crm && supabase db push --local
psql "$LOCAL_DB_URL" -c "select count(*) from contacts where deleted_at is null;"
```
Expected: count matches your dedupe number (± the email-less rows you chose to exclude).

- [ ] **Step 3: typecheck + build, then push to prod (approval gate)**

Run: `cd ~/crm && pnpm typecheck && pnpm build`
Expected: both pass. Then, **after Alex's go**, `supabase db push` (prod). This is a Rule 5 production write.

- [ ] **Step 4: Commit**

```bash
cd ~/crm && git add supabase/migrations/*_import_consolidated_contacts.sql
git commit -m "feat(contacts): import consolidated deduped contacts (canonical)"
```

---

### Task 1.6: Demote the mirrors + retire Rule 19's contact dual-write

**Files:**
- Modify: `~/.claude/rules/standing-rules.md` (Rule 19)

- [x] **Step 1: Make Obsidian CONTACT.md generated, not authored**

Decide: Obsidian contact pages are now a one-directional export FROM Supabase, regenerated on demand, never hand-edited as a source. (The generator script itself is Scope 2/ops work; for now the rule change is what prevents new drift.)

- [x] **Step 2: Edit Rule 19 to carve out contacts**

In `~/.claude/rules/standing-rules.md`, Rule 19, add: "Contacts are exempt from bidirectional mirroring. Supabase `contacts` is canonical; Obsidian contact pages are generated read-only exports and are never authored as a source. This prevents the multi-store drift that caused the 17-day rule conflict." Leave the rest of Rule 19 (agent profiles, strategy docs, meeting notes) unchanged.

- [x] **Step 3: Verify no other rule still calls contacts bidirectional**

Run: `grep -rn 'CONTACT.md' ~/.claude/rules/ ~/CLAUDE.md`
Expected: any hit either points at the new read-only-export rule or is unrelated (agent profiles). Fix stragglers.

- [x] **Step 4: Commit the rule change**

```bash
cd ~/.claude && git add rules/standing-rules.md 2>/dev/null && git commit -m "rule(19): contacts canonical in Supabase, Obsidian is read-only export" || echo "no .claude git repo -- change saved, no commit"
```

---

### SCOPE 1 DONE GATE

All true before opening Scope 2:
- [x] `pnpm test` passes for normalize + dedupe. (9/9, 2 files)
- [x] `select count(*) from contacts where deleted_at is null` returns your real deduped number, locally and in prod. (88/88 client-agent emails present both envs; prod total 149, local total 326)
- [x] Your 25 active agents are all present in `contacts` (spot-check by email). (full 88-email presence check, 0 missing, local + prod)
- [x] Rule 19 exempts contacts; `grep` shows no remaining bidirectional-contact instruction. (only hit is the new read-only-export rule)
- [x] `pnpm typecheck && pnpm build` both pass.

When all checked: **Scope 1 is finished. Run `/superpowers:writing-plans` on the Scope 2 card below before executing it.**

---

# SCOPE 2 -- Relationship Cadence (CARD -- expand on arrival)

**Goal:** One surface answers "which agents have gone cold and who do I owe a touch," reading only from canonical `contacts`. No order/escrow counts (cut per your call -- Cypher owns orders).

**Why:** This is the revenue-relevant daily driver that survived the panel. Depth on 25 agents beats volume. You can't run depth without seeing who's slipping.

**Likely files:**
- `~/crm` dashboard Today tab (the 3-tab Today/Agents/Activity dashboard shipped in PR #67) -- add or surface a "going cold" bucket.
- A `last_touch_at` source: either a column on `contacts` or derived from `interactions`/`activity_events` (the canonical write target per CRM CLAUDE.md). Confirm which on arrival.
- Possibly `morning-briefing` skill output if you'd rather see it in the brief than the dashboard.

**Task outline (expand to bite-sized on arrival):**
1. Confirm last-touch source: is there `interactions` / `activity_events` with a timestamp per contact? Derive `days_since_touch` from it. TDD the days-since + cold-threshold function (pure, testable: tier 1 cold at 14d, tier 2 at 30d, tier 3 at 60d -- confirm thresholds with Alex).
2. Build a query/RPC: contacts where `days_since_touch > tier_threshold`, ordered by tier then staleness, `deleted_at is null`.
3. Surface it: one card on the Today tab (the dashboard-architecture rule's bucket #3 "agents going cold" already exists in spec -- wire it to this query). Add the "View as table" toggle + `aria-label` the rule requires.
4. typecheck + build, screenshot-verify, ship.

**DONE when:** From one screen, in under 10 seconds, no cross-referencing, you can read which agents are cold and who you owe a touch.

---

# SCOPE 3 -- Memory & STATUS Defrag (CARD -- expand on arrival)

**Goal:** One canonical memory store; STATUS capped to one line per item; the conflicting startup injections resolved to one declared behavioral mode.

**Why:** Same fact lives in 3-4 stores today; the 17-day conflict proved drift is structural, not a fluke. STATUS.md is a landfill of multi-hundred-word entries.

**Likely files:**
- `~/.claude/memory/` (recent/project/long-term), `~/.claude/projects/-Users-alex-crm/memory/MEMORY.md`, `~/.claude/rules/STATUS.md`, the Obsidian vault.
- The startup-injection sources (superpowers "brainstorm first", context-mode "terse like caveman", your own rules) -- decide which wins and document it in `~/CLAUDE.md`.

**Task outline (expand on arrival):**
1. Declare one canonical memory store; make the others pointers/exports. Write the rule.
2. Enforce STATUS template: one line per active item, narrative goes to `project-memory.md`. Archive the current overflow in one pass (the file already documents this trigger -- execute it).
3. Resolve startup-injection conflict: pick the winning behavioral default, state precedence in `~/CLAUDE.md` Instruction Hierarchy, so "terse vs brainstorm-first vs your rules" stops competing.
4. Run `/config-doctor` to confirm no broken references after the moves.

**DONE when:** Memory has one source of truth, STATUS passes its own one-line template, `~/CLAUDE.md` names the winning behavioral mode, config-doctor is clean.

---

# SCOPE 4 -- One Ship-Check Skill (CARD -- expand on arrival)

**Goal:** Collapse the 5+ overlapping design-QA skills (design-critique, design-intelligence, design-proofing, impeccable, render-verify, visual-qa, brand-audit, drift-audit, copy-check, output-enforcement) into a single pre-ship `ship-check`.

**Why:** Nobody can remember which QA skill to invoke; the ownership map exists only because they overlap. One invocation before a piece goes out.

**Likely files:**
- `~/.claude/skills/` (the QA skills above), `~/.claude/rules/skill-routing.md`, `task-routing.md`.
- Use `skill-retirement` skill -- it already exists to sweep references cleanly.

**Task outline (expand on arrival):**
1. Define `ship-check`: one skill that internally runs the mechanical checks (tokens, RESPA row, em dashes, banned words, render) and emits one punchlist. Keep the genuinely-distinct deep passes (impeccable's anti-patterns) as an internal mode, not a separate user-facing skill.
2. Measure invocation: which QA skills have not fired in 60 days (telemetry/context-mode tracks this)? Those retire outright.
3. Run `skill-retirement` for each retired skill to sweep routing references.
4. Update routing tables to point all QA triggers at `ship-check`.

**DONE when:** One skill name runs the full pre-ship check, redundant QA skills are retired with zero dangling routing references, nothing unfired-in-60-days is still active.

---

# SCOPE 5 -- Router Flatten (CARD -- expand on arrival)

**Goal:** Collapse the routing layer (00-router, classification, routing-table, skill-routing, task-routing) into one decision table; drop the recited HAT-declaration block; relocate workflow-shaped standing rules per Rule 25.

**Why:** 35+ governance files and a five-line recited preamble to make a postcard. Rule 25 ("abstractions are noise, looking is signal") indicts the router itself.

**Likely files:**
- `~/.claude/rules/00-router.md`, `classification.md`, `routing-table.md`, `skill-routing.md`, `task-routing.md`, `standing-rules.md`.

**Task outline (expand on arrival):**
1. Merge the five routing files into one `routing.md` with a single client→packs / output→skill table. Keep the client-type distinction (me vs agent vs listing) -- that's load-bearing.
2. Make the HAT declaration internal (still classify, stop reciting the block to Alex unless he asks).
3. Audit the 25 standing rules: each is taste/constraint (keep) or workflow (move into the owning skill per Rule 25). Relocate the workflow ones.
4. Run `/config-doctor` to confirm routing still resolves.

**DONE when:** A new piece routes from one table, no HAT preamble is recited, workflow-shaped rules live in their owning skills, config-doctor is clean.

---

# SCOPE 6 -- Campaign Sending Decision (CARD -- expand on arrival)

**Goal:** Make the explicit keep-custom-blast vs. bought-tool decision, then harden or migrate the chosen path. (You chose "keep building the CRM" -- this scope tests whether that extends to the hand-rolled deliverability stack specifically.)

**Why:** The custom blast system (Resend warmup, DMARC tuning, webhook suppression, city-tagged MLS pools) is deliverability engineering with you as sole admin. One bad blast can poison the domain you use for real agent comms.

**Task outline (expand on arrival):**
1. Write the decision: keep custom (you own deliverability) vs. move sending to a bought tool (vendor owns deliverability, you own creative + list). Price your own time honestly.
2. If keep: harden -- bounce/complaint alerting, a hard send cap, a pre-send checklist gate (you already shipped `preflight.ts` in PR #64 -- confirm it's enforced on every path).
3. If migrate: pick the tool, move the list, keep only creative in-house, retire the blast infra to read-only.
4. Close the not-chosen path explicitly so it stops drawing maintenance.

**DONE when:** The decision is written with rationale, the chosen path is hardened or migrated, and the other path is explicitly closed.

---

## Self-Review (run once before executing)

- **Spec coverage:** Panel's CRITICAL (contact-of-truth) = Scope 1 ✓. HIGH (cadence) = Scope 2 ✓. Escrow metric = intentionally cut per Alex (Cypher owns it). MEDIUM (collapse QA / flatten router / cap STATUS / resolve injections) = Scopes 3,4,5 ✓. Campaign sending = Scope 6 ✓. Build-vs-buy CRM = answered "keep custom" ✓.
- **No-placeholder check:** Scope 1 carries full code + real commands. Scopes 2-6 are explicitly cards with an expand-on-arrival ritual, not hidden TODOs -- the contract is "expand each before executing," stated up front.
- **Type consistency:** `NormalizedContact` / `dedupeKey` / `normalizeContact` / `dedupeContacts` names are consistent across normalize.ts, dedupe.ts, gather.ts, and both test files.

**Remaining placeholders:** Scope 1 Task 1.0 confirms the real `contacts` column names; if your table uses `name` not `full_name`, substitute it in Tasks 1.3 and 1.5. That's a confirm step, not an open gap.
