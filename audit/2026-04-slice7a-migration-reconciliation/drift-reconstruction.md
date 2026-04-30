# Drift Reconstruction -- 2026-04-29

**Source:** `~/crm/audit/live-schema.sql` (captured 2026-04-28 17:31, post-drift) cross-referenced against every file in `~/crm/supabase/migrations/` (timestamped + non-conformant).
**Method:** Static name-grep of every `CREATE TABLE/TYPE/FUNCTION/VIEW/TRIGGER` in the live dump against every local migration file.
**Working set:** 40 tables, 19 enums, 20 functions, 3 views, 21 triggers on remote.

---

## 1. Three drift dimensions

### 1A. Local-not-on-remote (24 timestamps, will get pushed on next `db push`)

These local files exist but are NOT in `supabase_migrations.schema_migrations` per the 2026-04-28 `migration list` snapshot.

```
20260427170000  slice5a_enrollments_schedule
20260427170100  slice5a_message_events
20260427200000  slice5a_onboarding_content
20260427210000  slice5a_nurture_content
20260427220000  slice5b_schema_deltas
20260427230000  slice5b_listing_templates
20260427240000  slice5b_daily_summary_template
20260427250000  slice6_ai_usage_log
20260427260000  slice6_ai_cache
20260427300000  slice7a_accounts
20260427300100  slice7a_ai_cache_user_id
20260427300200  slice7a_*_rls               (multiple files share this timestamp)
20260427300300  slice7a_email_drafts_user_id
20260427300400  slice7a_emails_user_id
20260427300500  slice7a_error_logs_user_id
20260427300600  slice7a_event_templates_user_id
20260427300700  slice7a_events_user_id
20260427300800  slice7a_message_events_user_id
20260427300900  slice7a_messages_log_user_id
20260427301000  slice7a_morning_briefs_user_id
20260427301100  slice7a_projects_user_id
20260427301200  slice7a_relationship_health_config_user_id
20260427301300  slice7a_relationship_health_scores_user_id
20260427301400  slice7a_relationship_health_touchpoint_weights_user_id
```

Plus newer-than-snapshot files not yet in any migration list:
```
20260427301500  slice7a_templates_user_id
20260429194551  add_missing_timestamps      <-- ADDS the deleted_at columns Callout 4 prescribes
```

**Reading note for Callout 4:** the in-flight `20260429194551_add_missing_timestamps.sql` already adds `deleted_at` to: `agent_metrics`, `captures`, `email_drafts`, `emails`, `email_log`, `error_logs`, `inbox_items`, `oauth_tokens`, `relationship_health_config`, `relationship_health_touchpoint_weights`, `ticket_items`. **Callout 4's recommended additions are already authored locally; they just haven't been pushed.** No new migration needed for them. The only Callout-4 surprise still open is `relationship_health_scores` (and the live dump shows that table already has `deleted_at` -- it picked it up from remote-only DDL, see 1B below).

### 1B. Remote-only timestamps (5 from the 2026-04-28 snapshot + 4 brand-new from session-mid)

Per `migration-status.txt`:
```
20260427175941  remote-only
20260427180122  remote-only
20260427202955  remote-only
20260427203006  remote-only
20260428232101  remote-only
```

Brand-new (seen mid-session 2026-04-28, listed in plan):
```
20260429001458  remote-only
20260429001532  remote-only
20260429001601  remote-only
20260429001634  remote-only
```

Total: **9 remote-only migration timestamps**, no local SQL on disk for any of them.

### 1C. Non-conformant local files (silently skipped by CLI, applied to remote out-of-band)

These files exist locally but the CLI skips them on `db push` because they don't match `<timestamp>_name.sql`. They WERE applied to remote at some point (manually via SQL editor or `psql`):

| File | Created |
|---|---|
| `phase-1.3.1-gmail-mvp.sql` | enums: `email_draft_status`; tables: `emails`, `email_drafts`, `oauth_tokens`, `error_logs`; trigger: `trg_email_drafts_updated_at` |
| `phase-1.3.2-observation.sql` | view: `email_drafts_observation` |
| `phase-1.4-projects.sql` | enums: `project_type`, `project_status`, `project_touchpoint_type`; tables: `projects`, `project_touchpoints`; trigger: `trg_projects_updated_at` |
| `phase-1.5-calendar.sql` | enums: `event_source`; tables: `events`; trigger: `trg_events_updated_at` |
| `phase-9-realtime-email-drafts.sql` | (no CREATE statements -- likely ALTER PUBLICATION supabase_realtime ADD TABLE) |
| `slice-2a-drop-spine.sql` | (no CREATE statements -- DROP TABLE / DROP TYPE for spine cleanup) |

These files are reachable via grep but invisible to `supabase migration list`. They explain ~half of what would otherwise look like remote-only state.

---

## 2. Truly orphan remote objects (no local SQL anywhere)

Cross-referencing the live dump against `[0-9]*.sql` AND `phase-*.sql` AND `slice-*.sql`, these objects exist on remote but have no `CREATE` in any local file. They were authored in the 9 remote-only timestamps from 1B.

### 2A. Tickets/Cypher infrastructure
- **TABLE:** `tickets`
- **TABLE:** `ticket_items`
- (Inventory mentions enums `material_request_priority`, `material_request_status`, `material_request_type` -- they're listed in inventory §3 as existing types; verify they're created remote-only as well.)

### 2B. Calendar extension layer
- **TABLE:** `attendees`
- **TABLE:** `event_templates`
- **TYPE:** `event_occurrence_status`
- **FUNCTION:** `set_attendees_updated_at`
- **FUNCTION:** `set_event_templates_updated_at`
- **TRIGGER:** `trg_attendees_updated_at`
- **TRIGGER:** `trg_event_templates_updated_at`

### 2C. Relationship health system (the table-driven flow)
- **TABLE:** `relationship_health_config` (already has `deleted_at` on remote -- so a remote-only migration added it)
- **TABLE:** `relationship_health_scores` (has `deleted_at` and `computed_at`)
- **TABLE:** `relationship_health_touchpoint_weights`
- **FUNCTION:** `compute_relationship_health_score(uuid)`
- **FUNCTION:** `recompute_all_relationship_health_scores(int)`
- **FUNCTION:** `recompute_relationship_health_on_touchpoint()`
- **FUNCTION:** `upsert_relationship_health_score(uuid)`
- **TRIGGER:** `trg_touchpoint_recompute_health` on `project_touchpoints`

This is exactly the system that **replaces** the phantom `agent_relationship_health` materialized view (Callout 1). The locked decision in `dashboard-architecture.md` describes a system that does not exist; the system that does exist was authored remote-only and never pulled into a local migration file.

---

## 3. Implications for the next migration

**Do NOT:**
- `CREATE TABLE attendees / event_templates / tickets / ticket_items / relationship_health_*` -- these exist on remote.
- `CREATE TYPE event_occurrence_status / material_request_*` -- exist on remote.
- `CREATE FUNCTION compute_relationship_health_score / recompute_* / upsert_relationship_health_score / set_attendees_updated_at / set_event_templates_updated_at` -- exist on remote.
- `CREATE TRIGGER trg_touchpoint_recompute_health / trg_attendees_updated_at / trg_event_templates_updated_at` -- exist on remote.
- Re-add `deleted_at` to any of the 11 tables already covered by `20260429194551_add_missing_timestamps.sql`.

**SAFE to do (per Callouts 1, 2, 4 chosen options):**
- `DROP FUNCTION public.refresh_agent_relationship_health()` (Callout 1 cleanup -- orphan, dead code, no triggers reference it).
- `DROP TYPE public.deal_stage` (Callout 2 cleanup -- orphan enum, no table uses it).
- Edit `~/.claude/rules/dashboard-architecture.md` to declare `relationship_health_scores` table-driven flow canonical (Callout 1) and `opportunities` the unified pipeline+closing table (Callout 2). Doc-only.
- (Callout 4): `add_missing_timestamps.sql` already does the bulk. Only consider adding `deleted_at` to `email_drafts` if the live dump shows it missing (verify before writing); the inventory says it's missing, but the in-flight migration should cover it. Read the dump's `email_drafts` block and confirm.

**MUST do BEFORE pushing any cleanup migration:**
1. Resolve the 9 remote-only timestamps. Either (a) `supabase migration repair --status applied <ts>` for each (writes to schema_migrations -- violates current read-only constraint), or (b) `supabase db pull` once Docker is available to capture them as local files, or (c) hand-author the remote-only DDL into local files by extracting the relevant blocks from `live-schema.sql`.
2. Convert the 6 non-conformant phase/slice files to timestamp-prefixed names (or accept they will never be tracked and document why).
3. Push pending local migrations (the 26 from 1A) so local and remote converge before the cleanup migration lands on top.

Without step 1, a fresh local DB rebuild from migrations alone will be missing 2A/2B/2C entirely.

---

## 4. One-line summary

The remote schema has 9 orphan migration timestamps that local doesn't see, 6 non-conformant local files the CLI silently skips (which created ~half of the apparent drift), and one in-flight local migration (`20260429194551_add_missing_timestamps.sql`) that already authored the bulk of Callout 4's prescribed `deleted_at` adds. Cleanup migration is small (drop one function, drop one enum) plus rule-doc edits.
