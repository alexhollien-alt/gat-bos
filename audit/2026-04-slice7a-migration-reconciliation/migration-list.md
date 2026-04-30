# Migration Inventory

**Source:** `~/crm/supabase/migrations/` -- 58 SQL files (52 timestamped, 6 non-conformant).

## Non-conformant filenames (Supabase CLI SKIPS these)

These six files do NOT match `<timestamp>_name.sql` and are silently skipped by `supabase db push` / `supabase migration list`:

| File | Summary |
|------|---------|
| `phase-1.3.1-gmail-mvp.sql` | Gmail MVP scaffold (status unknown -- never applied via CLI) |
| `phase-1.3.2-observation.sql` | Observation scaffold (status unknown) |
| `phase-1.4-projects.sql` | Projects scaffold (status unknown) |
| `phase-1.5-calendar.sql` | Calendar scaffold (status unknown) |
| `phase-9-realtime-email-drafts.sql` | Add `email_drafts` to `supabase_realtime` publication |
| `slice-2a-drop-spine.sql` | Drop spine tables + trigger (the live drop probably ran via SQL editor) |

**Action required:** Decide -- rename to timestamped form so they tracked, or move to `supabase/_archive/` if already applied out-of-band.

## Timestamped migrations (chronological)

| Timestamp | Name | Summary |
|-----------|------|---------|
| 20260407012800 | baseline | PostgreSQL initial dump |
| 20260407020000 | spine_tables | DEPRECATED -- spine tables (superseded by `activity_events`, dropped in Slice 2) |
| 20260407021000 | dashboard_pieces_04_07_placeholder | Placeholder for dashboard pieces applied via SQL editor 2026-04-07 |
| 20260407021500 | spine_interactions_trigger | DEPRECATED -- spine→interactions trigger (Slice 2 drops) |
| 20260408000700 | contacts_type_default | Default `contacts.type = 'realtor'` |
| 20260408001000 | dashboard_pieces_04_08_placeholder | Placeholder for dashboard pieces applied via SQL editor 2026-04-08 |
| 20260408001500 | cleanup_spine_smoke_test_data | DEPRECATED -- spine smoke-test data cleanup |
| 20260410000100 | phase21_rls_lockdown | Phase 2.1 RLS lockdown across base tables |
| 20260410000200 | contacts_reconcile_to_spec | Reconcile `contacts` shape to GAT-BOS spec |
| 20260410000300 | gatbos_new_tables | New GAT-BOS tables (deals, opportunities, etc.) |
| 20260411120000 | api_usage_log | API usage log for Adviser Strategy cost tracking |
| 20260413000100 | inbox_items | Inbox items (Gmail threads scored as needing reply) |
| 20260421150000 | add_captures_table | Universal Capture Bar v1 |
| 20260422000000 | campaign_enrollment_schedule | Add `schedule` column to campaign enrollments |
| 20260422100000 | activity_events | Slice 1 -- universal activity ledger |
| 20260422110000 | activity_events_contact_id_index | Slice 1 fix -- partial expression index on `context->>'contact_id'` |
| 20260423120000 | slice2b_captures_merge | Slice 2B -- captures merge |
| 20260424100000 | slice2c_tasks_extend | Slice 2C -- tasks extension |
| 20260424110000 | slice2c_interactions_view | Slice 2C -- interactions compatibility view |
| 20260425100000 | slice3_tasks_linked_interaction_id | Slice 3 -- `tasks.linked_interaction_id` |
| 20260425110000 | slice3_legacy_backfill | Slice 3 -- legacy backfill |
| 20260425120000 | slice3_view_rewrite_drop_legacy | Slice 3 -- view rewrite + drop legacy |
| 20260425130000 | morning_briefs | Morning briefs cache table |
| 20260425140000 | rate_limits | Slice 3A -- operational rate limits |
| 20260425150000 | rate_limits_rpc | Slice 3A -- atomic increment RPC |
| 20260426120000 | backfill_last_touchpoint_to_activity_events | Backfill last_touchpoint into activity_events |
| 20260427155808 | slice4_templates | Slice 4 -- templates table |
| 20260427155918 | slice4_messages_log | Slice 4 -- messages_log table |
| 20260427160946 | slice4_weekly_edge_template_seed | Seed Weekly Edge template |
| 20260427161549 | slice4_drop_deprecated_requests | Drop `_deprecated_requests` table |
| 20260427170000 | slice5a_enrollments_schedule | Slice 5A -- campaign_enrollments schedule indexes (LOCAL ONLY -- not on remote) |
| 20260427170100 | slice5a_message_events | Slice 5A -- message_events + status-sync trigger (LOCAL ONLY) |
| 20260427175350 | slice5a_campaign_steps_template_slug | Slice 5A -- campaign_steps.template_slug |
| 20260427200000 | slice5a_onboarding_content | Slice 5A -- New Agent Onboarding campaign content (LOCAL ONLY) |
| 20260427210000 | slice5a_nurture_content | Slice 5A -- Agent Nurture campaign content (LOCAL ONLY) |
| 20260427220000 | slice5b_schema_deltas | Slice 5B -- consolidated schema deltas (LOCAL ONLY) |
| 20260427230000 | slice5b_listing_templates | Slice 5B -- listing-launch template seeds (LOCAL ONLY) |
| 20260427240000 | slice5b_daily_summary_template | Slice 5B -- daily touchpoint summary template (LOCAL ONLY) |
| 20260427250000 | slice6_ai_usage_log | Slice 6 -- ai_usage_log (LOCAL ONLY) |
| 20260427260000 | slice6_ai_cache | Slice 6 -- ai_cache (LOCAL ONLY) |
| 20260427300000 | slice7a_accounts | Slice 7A -- accounts table foundation (LOCAL ONLY) |
| 20260427300100..301400 | slice7a_*_user_id | Slice 7A -- 14 add-column migrations adding `user_id` to per-table (LOCAL ONLY) |

## Drift summary (from `supabase migration list`)

**Local migrations not yet applied to remote (12+):**
`20260427170000`, `170100`, `200000`, `210000`, `220000`, `230000`, `240000`, `250000`, `260000`, `300000`, `300100`, `300200`, `300300`, `300400`, `300500`, `300600`, `300700`, `300800`, `300900`, `301000`, `301100`, `301200`, `301300`, `301400`.

**Remote migrations not in local files (5):**
`20260427175941`, `20260427180122`, `20260427202955`, `20260427203006`, `20260428232101`.

These five represent changes pushed via Supabase SQL editor or another out-of-band path. They need to be pulled back (`supabase db pull` or `supabase db diff`) and committed to `migrations/` before the local set can sync cleanly.
