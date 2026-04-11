# GAT-BOS Schema Reconciliation Plan

**Date:** 2026-04-10
**Owner:** Alex Hollien
**Status:** DRAFT, pending Alex approval
**Target branch:** `feat/gatbos-schema-reconciliation` (new, off `feat/spine-phase1`)
**Supabase project:** `rndnxhvibbqqjrzapdxs`

---

## Purpose

Bend the existing CRM schema to match the GAT-BOS build spec at `/Users/alex/Downloads/GAT-BOS-Complete-Build-Spec.md`, in the same Supabase project, without losing the work already built (Phase 1 to 5, Phase 2.1 RLS, Spine Phase 1). The xlsx at `/Users/alex/Downloads/GAT-BOS_Contacts.xlsx` is the canonical source for contact data. The live 105 contacts are stale and get replaced.

Framing per Alex on 2026-04-10: "rebuild from the ground up, knowing what was already done correctly and having that overwritten with what we want to put in there now." Overlapping work gets overwritten. Non-overlapping important work stays.

---

## Locked Decisions (Alex approved 2026-04-10)

| # | Decision | Locked value |
|---|---|---|
| 1 | Temperature scale | **A / B / C / P**, P = Passive |
| 2 | Source of truth for contacts | **XLSX canonical**, live 105 overwritten |
| 3 | Contact name field | **first_name + last_name** kept, `full_name` added as generated column |
| 4 | Contact role classification | **11-value `type` enum kept**, add computed `role` view for spec compatibility |
| 5 | 26 extra columns on contacts | **All kept**, spec is a subset, not a replacement |
| 6 | `touchpoints` vs `interactions` | **Keep `interactions`**, accept vocabulary difference with spec |

---

## Architecture: one contacts table for four xlsx sheets

The xlsx has four sheets (Contacts, Lenders, Vendor Partners, Escrow Team & Branches). I'm proposing they all land in the single `contacts` table, discriminated by the `type` column. Type-specific fields (NMLS#, branch address, loan types, service area) go into a new `metadata jsonb` column.

| XLSX sheet | Row count | Lands as `contacts.type` | Type-specific fields stored in `contacts.metadata` |
|---|---|---|---|
| Contacts | 88 | `realtor` (or `agent` if we normalize the enum) | none |
| Lenders | 3 | `lender` | `nmls_number`, `loan_types`, `co_marketing` |
| Vendor Partners | 26 | `vendor` | `category`, `service_area`, `licensed`, `insured` |
| Escrow Team & Branches | 9 | `escrow` (new enum value) | `branch_name`, `branch_address`, `direct_line`, `assigned_agents` |

**Result:** 126 rows in `contacts`, zero new tables needed for people. `lender_partner_id` is a self-reference on `contacts` (not a reference to a separate `lenders` table).

**Why this beats separate tables:** the spec's unified contacts table is the right abstraction. Alex thinks about all of these people as contacts. Separate tables would force joins every time we ask "who did I talk to last week." One table with a type discriminator is the Postgres-standard pattern for this exact situation.

**If Alex disagrees**, fall back option is separate `lenders`, `vendor_partners`, `escrow_team` tables -- at the cost of more joins and more schema surface. Flag for review.

---

## Phase 0 -- Safety Net

**Goal:** Nothing destructive can happen until we have a verified backup of the live data and a clean branch.

1. Create branch `feat/gatbos-schema-reconciliation` off `feat/spine-phase1`.
2. Export current live contacts to `~/crm/supabase/backups/contacts-pre-gatbos-2026-04-10.sql`. Use a simple `COPY (SELECT * FROM contacts) TO STDOUT` via psql, not `pg_dump`. Store alongside the interactions/tasks/follow_ups/opportunities snapshots for symmetry.
3. Verify backup by reading row count and spot-checking 3 rows.
4. Write a one-page rollback doc at `~/crm/docs/plans/gatbos-rollback-2026-04-10.md` with the exact psql command to restore from the backup file.
5. **Gate:** Alex confirms backup exists before any `TRUNCATE` or `DROP`.

**Files touched:** `~/crm/supabase/backups/` (new), `~/crm/docs/plans/gatbos-rollback-2026-04-10.md` (new).

**Destructive?** No. Pure backup and branch.

---

## Phase 1 -- Wrap Phase 2.1 RLS pieces as a formal migration

**Goal:** Get "code-complete pending merge" off the blocker list. Pieces 5 through 8 currently exist as loose SQL files in `~/crm/supabase/` but are not numbered migrations. They were applied directly to the live DB via the Supabase MCP (before the MCP went read-only on 2026-04-08).

1. Create `~/crm/supabase/migrations/20260410000100_phase21_rls_lockdown.sql`.
2. Wrap pieces 5, 6, 7, 8 in order. Make every statement idempotent (`DROP POLICY IF EXISTS`, `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS`, etc.).
3. Move the loose dashboard-piece*.sql files to `~/crm/supabase/_archive/` so the repo reflects the new source of truth.
4. Commit.
5. **Gate:** Alex reviews the migration file, compares against the original pieces. Approves before merge.

**Destructive?** No (idempotent wrapper of already-applied work).

---

## Phase 2 -- Contacts reconciliation migration

**Goal:** Reshape the `contacts` table to match the spec's intent without losing any of the 26 extras.

Migration file: `~/crm/supabase/migrations/20260410000200_contacts_reconcile_to_spec.sql`

Changes:

1. **Rename columns** (preserves data):
   - `last_touch_date` -> `last_touchpoint`
   - `next_action_date` -> `next_followup`
2. **Add missing columns:**
   - `lender_partner_id uuid references contacts(id) on delete set null`
   - `metadata jsonb default '{}'::jsonb` (holds NMLS#, branch info, loan types, service area for type-specific rows)
   - `is_dormant boolean generated always as (last_touchpoint < (current_date - interval '30 days')) stored`
   - `full_name text generated always as (first_name || ' ' || last_name) stored`
3. **Extend the `type` enum** to include `escrow`:
   - `alter type contact_type add value if not exists 'escrow'`
4. **Create `public.contacts_spec_view`** for spec-compatible queries. Maps:
   - `full_name` (already on table)
   - `role text` computed as `case when type in ('realtor', 'buyer', 'seller', 'past_client', 'warm_lead', 'sphere') then 'agent' when type in ('lender') then 'lender' when type in ('vendor', 'builder', 'referral_partner') then 'vendor' when type in ('escrow') then 'escrow' else 'other' end`
   - All other columns pass through
5. **Leave untouched:** all 26 extras (farm, branding, health_score, rep_pulse, Obsidian links, etc.), A/B/C/P tier column, user_id, RLS policies, triggers.
6. **Type column normalization pass** (separate from the migration): decide later whether to rename `realtor` -> `agent`. For now, keep `realtor`; the spec view projects it to `agent`.

**Gate:** Alex reviews migration SQL. Confirms column renames will not break application code (we check `~/crm/src/` for references to `last_touch_date` and `next_action_date` before running the migration).

**Destructive?** Column renames are safe (data preserved). Generated columns are additive. The enum add is additive. No drops.

---

## Phase 3 -- Add the 5 missing GAT-BOS tables

**Goal:** Every spec table exists.

Migration file: `~/crm/supabase/migrations/20260410000300_gatbos_new_tables.sql`

Creates:

1. **`email_log`** (Resend campaign tracking) -- fields per spec lines 89-100. FKs to `contacts`. RLS owner-scoped.
2. **`events`** (calendar sync) -- fields per spec lines 102-115. `contact_ids uuid[]` for multi-contact attendance. `google_event_id text unique` for idempotency. RLS owner-scoped.
3. **`email_inbox`** (Gmail triage) -- fields per spec lines 117-133. Distinct from `intake_queue` which stays for form submissions. `gmail_id text unique` for idempotency. RLS owner-scoped.
4. **`voice_memos`** -- fields per spec lines 135-144. `contact_ids uuid[]`. RLS owner-scoped.
5. **`agent_metrics`** -- fields per spec lines 147-158. FK to `contacts`. RLS owner-scoped.

Every new table gets:
- `id uuid default gen_random_uuid() primary key`
- `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()` with trigger
- `enable row level security`
- `create policy "Users manage own {table}" on {table} for all using (auth.uid() = user_id) with check (auth.uid() = user_id)`
- Sensible indexes (user_id + most-queried column)

**NOT creating:** `touchpoints` (we keep `interactions` per Decision 6). The spec's touchpoint vocabulary (`email_sent`, `email_received`, `text`) gets added to the existing `interactions.type` enum if missing.

**Gate:** Alex reviews the SQL for all 5 tables before migration runs.

**Destructive?** No. Pure additive.

---

## Phase 4 -- Data wipe + xlsx seed

**Goal:** Replace the stale 105 contacts with the xlsx 126 records. Wipe the referential waste.

This is the only destructive phase. It happens AFTER phases 0 through 3 are merged and verified.

Steps:

1. Verify Phase 0 backup file exists and has >= 105 rows.
2. Create `~/crm/supabase/seeds/gatbos-seed-2026-04-10.sql` that:
   - Wraps everything in a transaction
   - `TRUNCATE contacts, interactions, tasks, follow_ups, opportunities RESTART IDENTITY CASCADE`
   - Inserts 126 contacts from the xlsx (88 agents + 3 lenders + 26 vendors + 9 escrow team)
   - Uses the UUIDs already baked into the xlsx (so `lender_partner_id` cross-references work immediately)
   - Sets `user_id = 'b735d691-...'` (Alex's auth UID, same one the pieces 5-8 work used)
   - Populates `metadata jsonb` for non-agent rows (NMLS#, branch info, etc.)
3. Rewrite `~/crm/supabase/seed.sql` to use the new schema, not the legacy `relationship`/`lead_status` shape.
4. Run the seed file in staging first via `supabase db reset --linked` or a scratch branch.
5. Verify row counts: contacts = 126, interactions = 0, tasks = 0, follow_ups = 0, opportunities = 0.
6. Verify `lender_partner_id` FKs resolve: select agents where lender_partner_id is not null, confirm join to lender row succeeds.
7. **Gate:** Alex runs the seed file locally (or approves me to run it against staging), verifies his 88 agents appear correctly in the app UI. Once confirmed, we run against prod.
8. Production apply.

**Destructive?** Yes. `TRUNCATE CASCADE` on contacts + 4 dependent tables. 105 contacts gone. Backup from Phase 0 is the only recovery path.

**Safety gates:**
- Backup verified before running
- Runs in staging first
- Alex approves prod apply

---

## Phase 5 -- Application code update

**Goal:** Next.js app + TypeScript types match the new schema.

1. Regenerate Supabase types: `supabase gen types typescript --project-id rndnxhvibbqqjrzapdxs > ~/crm/src/types/supabase.ts`
2. Grep for any reference to `last_touch_date` or `next_action_date` in `~/crm/src/` and replace with `last_touchpoint` / `next_followup`.
3. Add TypeScript types for the 5 new tables.
4. Run `pnpm typecheck` and `pnpm build` to verify no regressions.
5. Spin up `pnpm dev` and smoke-test the dashboard, contacts page, today view against the new schema.
6. **Gate:** Alex tests the app on localhost before merge.

**Destructive?** No (code only).

---

## Phase 6 -- Commit + PR

**Goal:** Land the work cleanly in git.

1. Each phase is its own commit on `feat/gatbos-schema-reconciliation`. Commit messages match the phase number and name.
2. Push branch.
3. Open PR from `feat/gatbos-schema-reconciliation` -> `feat/spine-phase1` (or `main`, Alex's call).
4. PR description links this plan doc.
5. **Gate:** Alex approves the PR before merge. No force pushes, no skipping hooks.

---

## Rollback Procedure

If anything in Phase 4 or 5 goes wrong:

1. Halt the app (Vercel pause or local dev stop).
2. Restore contacts from `~/crm/supabase/backups/contacts-pre-gatbos-2026-04-10.sql`:
   ```bash
   psql "$DATABASE_URL" < ~/crm/supabase/backups/contacts-pre-gatbos-2026-04-10.sql
   ```
3. `git revert` the commits on `feat/gatbos-schema-reconciliation` for any schema migration that was applied.
4. Re-run Supabase migrations from `feat/spine-phase1` baseline.
5. Verify app boots on localhost.
6. Debrief in `~/crm/docs/plans/gatbos-postmortem-YYYY-MM-DD.md`.

If Phases 0 through 3 have a problem, just `git checkout feat/spine-phase1` and the branch is orphaned without impact. Those phases are non-destructive.

---

## Open Questions Parked for Later

These do not block the plan but need answers before Phase 2.2 (Closing Brief + Onboarding sequences) or Phase 3 (Analytics):

1. **Lender temperature scale.** Lenders in the xlsx use `warm` (not A/B/C/P). When we wire lender automation, do we translate their temperature to A/B/C/P or keep the lender-specific scale?
2. **Eric Fowlston's agent partners.** Currently zero. When you identify the agents who use Eric, we add them.
3. **Cadence thresholds** (A=5-7 days, B=10 days, C=14 days). These live in application logic, not the schema. Needs confirmation when we build the Today View queries.
4. **Christine and Stephanie's agent lists.** You flagged that you probably did not list all of them. When you do, run an update migration, not another clean sweep.
5. **Dead `deals` table.** Baseline has both `deals` and `opportunities`. The dashboard rule says use `opportunities`. Drop `deals` in a later migration once we confirm nothing references it.
6. **Realtor -> agent enum rename.** Current `contacts.type` uses `realtor`. The spec says `agent`. The view projects correctly today. Decide later whether to rename the enum value itself.

---

## Approval Log

| Phase | Approved by | Date | Notes |
|---|---|---|---|
| Plan draft | Alex (pending) | 2026-04-10 | |
| Phase 0 | | | |
| Phase 1 | | | |
| Phase 2 | | | |
| Phase 3 | | | |
| Phase 4 | | | |
| Phase 5 | | | |
| Phase 6 | | | |

---

## Execution Budget (rough estimate for your awareness, not a time commitment)

Phases 0 through 3 are paperwork and additive SQL. Low risk, can happen in one sitting.

Phase 4 is the destructive phase. Do it on a quiet hour, not mid-day, with Alex watching.

Phase 5 is code verification. No specific duration, depends on how many grep hits turn up.

Phase 6 is clean git hygiene.

*End of plan.*
