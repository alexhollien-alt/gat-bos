# BLOCKERS.md

Broken integrations waiting for a dedicated plumbing session. Build sessions that hit a broken integration **fill-and-flag** (hardcoded fallback + entry here) and keep building.

Each open item: timestamp, what's broken, where it lives (file/line), what's needed to fix. Resolutions move to `## Resolved` with the date and closing commit.

---

## Open

### [2026-04-21] `contacts` table missing `slug`, `photo_url`, `tagline` columns
- **Broken:** No DB-backed source for agent landing page data. `/agents/[slug]` cannot query Supabase for the agent record.
- **Where:** `src/app/agents/[slug]/page.tsx` -- `AGENTS` const hardcoded at top of file (Julie only for Session 2).
- **Fix needed:** Supabase migration adding `contacts.slug text unique`, `contacts.photo_url text`, `contacts.tagline text`; backfill Julie + Fiona + one more A-tier agent; then refactor the page to `await supabase.from('contacts').select(...).eq('slug', slug).single()`. Keep RLS open for anon SELECT on those three columns only.

### [2026-04-21] Julie Jarmiolowski tagline not written
- **Broken:** Hero tagline renders `[PLACEHOLDER: Julie tagline pending]` in production.
- **Where:** `src/app/agents/[slug]/page.tsx` -- `AGENTS["julie-jarmiolowski"].tagline`.
- **Fix needed:** Alex writes the tagline (Kit Screen hero voice: luxury formal, authority-driven per Julie's wiki preferences; 10-15 words; Optima Camelview positioning). Replace the string inline; once Blocker #1 resolves, write it to `contacts.tagline` instead.

### [2026-04-21] Julie headshot not in `/public/agents/`
- **Broken:** Hero image points at `/portfolio/andrea-garcia-brochure.png` (wrong asset, used as a temp fallback per Alex's Session 2 inputs). Page renders Andrea's brochure cover where Julie's face belongs.
- **Where:** `src/app/agents/[slug]/page.tsx` -- `AGENTS["julie-jarmiolowski"].photoUrl`.
- **Fix needed:** Copy `~/Documents/Agents/Julie Jarmiolowski/Kaygrant/Julie_2022_Headshot_(1).png` to `~/crm/public/agents/julie-jarmiolowski.jpg` (convert to JPEG, target 800w, ~85 quality). Update `photoUrl` to `/agents/julie-jarmiolowski.jpg`. Real asset must ship before the Session 4 announcement email.

---

## Resolved

_Empty._

---

Remaining placeholders in this file: `[PLACEHOLDER: Julie tagline pending]` (tracked above under "Julie Jarmiolowski tagline not written"). No `CONFIRM:` / `MISSING TOKEN:` / `TBD:` markers beyond what's scoped in each Open entry.
