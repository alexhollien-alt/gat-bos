# BLOCKERS.md

Broken integrations waiting for a dedicated plumbing session. Build sessions that hit a broken integration **fill-and-flag** (hardcoded fallback + entry here) and keep building.

Each open item: timestamp, what's broken, where it lives (file/line), what's needed to fix. Resolutions move to `## Resolved` with the date and closing commit.

---

## Open

### [2026-04-21] `contacts` table missing `slug`, `photo_url`, `tagline` columns
- **Broken:** No DB-backed source for agent landing page data. `/agents/[slug]` cannot query Supabase for the agent record.
- **Where:** `src/app/agents/[slug]/page.tsx` -- `AGENTS` const hardcoded at top of file (Julie + Fiona + Denise for Sessions 2-4).
- **Fix needed:** Supabase migration adding `contacts.slug text unique`, `contacts.photo_url text`, `contacts.tagline text`; backfill Julie + Fiona + Denise; then refactor the page to `await supabase.from('contacts').select(...).eq('slug', slug).single()`. Keep RLS open for anon SELECT on those three columns only.

### [2026-04-21] Fiona Bigbee + Denise van den Bossche phone/website missing from CONTACT.md
- **Broken:** Contact block on `/agents/fiona-bigbee` and `/agents/denise-van-den-bossche` renders email only. `AgentRecord.phone|phoneHref|website|websiteHref` set to `null`; conditional render hides the rows. `RealEstateAgent` JSON-LD `telephone` + `url` fields ship as `null` on both pages.
- **Where:** `src/app/agents/[slug]/page.tsx` -- `AGENTS["fiona-bigbee"]` and `AGENTS["denise-van-den-bossche"]`. Upstream source: `~/Documents/Alex Hub(Obs)/05_AGENTS/Fiona Bigbee/CONTACT.md` and `~/Documents/Alex Hub(Obs)/05_AGENTS/Denise van den Bossche/CONTACT.md` (email-only at present).
- **Fix needed:** Alex confirms phone + website (or website=none) for each. Update both CONTACT.md files to include phone + website fields, then backfill the `AGENTS` const (or `contacts.phone` / `contacts.website` once Blocker #1 resolves). Carrying through Session 4; pages read as partial contact coverage until fixed.

### [2026-04-21] Voice / mic capture not wired
- **Broken:** Universal Capture Bar v1 ships text-only. No mic button, no audio input, no Web Speech API fallback. Spec called for voice as a v1 option; deferred during planning so the delight moment (live parse preview) could land first.
- **Where:** `src/components/capture-bar.tsx` -- input is a single `<input type="text">`. No MediaRecorder / webkitSpeechRecognition path exists.
- **Fix needed:** Add mic button inside the bar, request mic permission, stream to `webkitSpeechRecognition` (Chrome/Edge/Safari) with a `MediaRecorder` -> server-side transcription fallback for Firefox / no-webkit-speech browsers. Transcript populates the same `captures.raw_text` field so the existing parser still runs unchanged.

### [2026-04-21] Capture -> downstream promotion not wired
- **Broken:** The "process" button on `/captures` just flips `captures.processed = true`. No rows get written to `interactions`, `follow_ups`, or `tickets` based on `parsed_intent`. Captures are an inert log until this lands.
- **Where:** `src/app/api/captures/[id]/process/route.ts` -- currently a one-line update. `src/app/(app)/captures/captures-client.tsx` "Process" button just POSTs and optimistically marks processed.
- **Fix needed:** In the process route, switch on `parsed_intent`: `interaction` inserts an `interactions` row on `parsed_contact_id` (interaction_type derived from `parsed_payload.intent_keyword`); `follow_up` inserts a `follow_ups` row with a sensible default due date (+3 days) tied to the contact; `ticket` spawns a ticket via the `cypher-ticket-builder` skill pattern; `note` inserts an `interactions` row with `interaction_type='note'`. Only flip `processed=true` after the downstream row lands. Keep `parsed_payload.promoted_to` + `promoted_id` as an audit trail.

### [2026-04-21] Claude API intent parser upgrade deferred
- **Broken:** `src/lib/captures/parse.ts` is a rule-based keyword matcher. It misses anything that doesn't contain an exact keyword ("grabbed a drink with Julie" -> `note`, not `interaction`; "need a flyer for Denise's listing" works only because "flyer" is hardcoded). Scales linearly with keyword list, not with Alex's language.
- **Where:** `src/lib/captures/parse.ts` -- pure function, imported by `src/app/api/captures/route.ts` and `src/components/capture-bar.tsx`.
- **Fix needed:** Replace the parser body with a cached Claude call (Haiku 4.5 + structured tool use, `user_id`-scoped prompt cache). Keep the rule-based parser as a fallback path on API failure / timeout. Tool schema returns `{intent, contact_match, payload}` so the API route stays unchanged. Live preview line should keep using the rule parser for instant feedback; Claude pass runs only on submit (avoid per-keystroke LLM calls).

### [2026-04-21] Capture editing after submit not wired
- **Broken:** Captures are immutable by design for v1. If Alex fat-fingers a capture or wants to fix a parsed intent, the only option is to stop, mark processed, and re-capture. No inline edit UI.
- **Where:** `src/app/(app)/captures/captures-client.tsx` -- renders `raw_text` as static `<p>`; no edit affordance. No PATCH route on `/api/captures/[id]`.
- **Fix needed:** Add an inline edit mode on each row (pencil affordance -> textarea + save/cancel). PATCH `/api/captures/[id]` re-runs the parser on save and updates `raw_text` + `parsed_intent` + `parsed_contact_id` + `parsed_payload`. Append the prior values to `parsed_payload.edits[]` with a timestamp so the audit trail is preserved.

---

## Resolved

### [2026-04-21] Julie headshot not in `/public/agents/` -- RESOLVED 2026-04-21
- Converted `~/Documents/Agents/Julie Jarmiolowski/Kaygrant/Julie_2022_Headshot_(1).png` (157KB PNG) to `/public/agents/julie-jarmiolowski.jpg` via `sips -s format jpeg -s formatOptions 85 -Z 800` (800×798 JPEG, 179KB).
- Updated `AGENTS["julie-jarmiolowski"].photoUrl` from the Andrea brochure fallback to `/agents/julie-jarmiolowski.jpg` in `src/app/agents/[slug]/page.tsx`.
- `pnpm typecheck` PASS, `pnpm build` PASS; `/agents/julie-jarmiolowski` still prerenders as SSG alongside Fiona + Denise.
- Closing commit: `a0ac043` (prod deploy `dpl_DthBaahUUniqmTYrQYEhS2aFNWnM`, aliased to `gat-bos.vercel.app`).

### [2026-04-21] Julie Jarmiolowski tagline not written -- RESOLVED 2026-04-21
- Alex approved Kit Screen hero-voice drafts J1/F1/D1; Julie tagline locked as: "Optima Camelview resident and realtor, guiding neighbors through one of the Valley's most architectural addresses."
- Patched inline in `src/app/agents/[slug]/page.tsx` (`AGENTS["julie-jarmiolowski"].tagline`). Blocker #2 comment removed.
- Once Blocker #1 resolves, this string moves to `contacts.tagline`.
- Closing commit: `a0ac043` (prod deploy `dpl_DthBaahUUniqmTYrQYEhS2aFNWnM`, aliased to `gat-bos.vercel.app`).

### [2026-04-21] Fiona Bigbee + Denise van den Bossche taglines not written -- RESOLVED 2026-04-21
- Alex approved Kit Screen hero-voice drafts J1/F1/D1; Fiona tagline locked as: "85258 is my backyard. Your next move starts with the agent who knows every block." Denise tagline locked as: "Paradise Valley and Scottsdale, handled quietly. Discretion is the service."
- Patched inline in `src/app/agents/[slug]/page.tsx` (`AGENTS["fiona-bigbee"].tagline` + `AGENTS["denise-van-den-bossche"].tagline`). Blocker #5 comments removed.
- Once Blocker #1 resolves, these strings move to `contacts.tagline`.
- Closing commit: `a0ac043` (prod deploy `dpl_DthBaahUUniqmTYrQYEhS2aFNWnM`, aliased to `gat-bos.vercel.app`).

---

Remaining placeholders in this file: none. No `CONFIRM:` / `MISSING TOKEN:` / `TBD:` markers beyond what's scoped in each Open entry.
