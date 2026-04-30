# Schema Inventory -- gat-bos public schema

**Source:** `~/crm/audit/live-schema.sql` (5,566 lines, captured 2026-04-28 17:31 via `pg_dump --schema-only`)
**Generated:** 2026-04-29
**Method:** Static parse of the dump file (no live DB calls).

---

## 1. Top-level counts

| Object type | Count |
|---|---|
| Tables (public) | 40 |
| Views (public) | 3 (`contacts_spec_view`, `email_drafts_observation`, `interactions`) |
| Materialized views | **0** (see callout #1 below) |
| RLS-enabled tables | 40 / 40 |
| Policies | 48 |
| Indexes | 124 |
| Foreign keys | 66 |
| Enum types | 19 |
| Functions | 20 |
| Triggers | 26 |

---

## 2. Tables (alphabetical, with standard-column coverage)

Legend: ✅ present, -- missing.

| Table | id | created_at | updated_at | deleted_at | RLS policies |
|---|---|---|---|---|---|
| accounts | ✅ | ✅ | ✅ | ✅ | 3 |
| activities | ✅ | ✅ | ✅ | ✅ | 1 |
| activity_events | ✅ | ✅ | -- | ✅ | 1 |
| agent_metrics | ✅ | ✅ | ✅ | -- | 1 |
| ai_cache | -- | ✅ | -- | ✅ | 1 |
| ai_usage_log | ✅ | ✅ | -- | ✅ | 1 |
| api_usage_log | ✅ | ✅ | -- | ✅ | 1 |
| attendees | ✅ | ✅ | ✅ | ✅ | 1 |
| campaign_enrollments | ✅ | ✅ | ✅ | ✅ | 1 |
| campaign_step_completions | ✅ | ✅ | ✅ | ✅ | 1 |
| campaign_steps | ✅ | ✅ | ✅ | ✅ | 1 |
| campaigns | ✅ | ✅ | ✅ | ✅ | 1 |
| captures | ✅ | ✅ | ✅ | ✅ | 1 |
| contacts | ✅ | ✅ | ✅ | ✅ | 1 |
| design_assets | ✅ | ✅ | ✅ | ✅ | 1 |
| email_drafts | ✅ | ✅ | ✅ | -- | 1 |
| email_log | ✅ | ✅ | ✅ | -- | 1 |
| emails | ✅ | ✅ | -- | -- | 1 |
| error_logs | ✅ | ✅ | -- | -- | 1 |
| event_templates | ✅ | ✅ | ✅ | ✅ | 1 |
| events | ✅ | ✅ | ✅ | ✅ | 1 |
| inbox_items | ✅ | ✅ | -- | -- | 1 |
| listings | ✅ | ✅ | ✅ | ✅ | 1 |
| message_events | ✅ | ✅ | -- | ✅ | 1 |
| messages_log | ✅ | ✅ | -- | ✅ | 1 |
| morning_briefs | ✅ | ✅ | -- | ✅ | 1 |
| oauth_tokens | ✅ | ✅ | -- | -- | 1 |
| opportunities | ✅ | ✅ | ✅ | ✅ | 1 |
| project_touchpoints | ✅ | ✅ | -- | ✅ | 1 |
| projects | ✅ | ✅ | ✅ | ✅ | 1 |
| rate_limits | -- | -- | -- | -- | 2 |
| referral_partners | ✅ | ✅ | ✅ | ✅ | 1 |
| relationship_health_config | ✅ | -- | ✅ | -- | 2 |
| relationship_health_scores | -- | -- | -- | ✅ | 2 |
| relationship_health_touchpoint_weights | -- | -- | -- | -- | 2 |
| resources | ✅ | ✅ | ✅ | ✅ | 1 |
| tasks | ✅ | ✅ | ✅ | ✅ | 1 |
| templates | ✅ | ✅ | ✅ | ✅ | 1 |
| ticket_items | ✅ | ✅ | -- | -- | 2 |
| tickets | ✅ | ✅ | ✅ | ✅ | 2 |

**Standard-column coverage gaps:**
- Missing `id`: 4 tables (`ai_cache`, `rate_limits`, `relationship_health_scores`, `relationship_health_touchpoint_weights`)
- Missing `created_at`: 4 tables (`rate_limits`, `relationship_health_config`, `relationship_health_scores`, `relationship_health_touchpoint_weights`)
- Missing `updated_at`: 15 tables (mostly append-only logs, which is justified; `relationship_health_scores` is the suspicious one)
- Missing `deleted_at` (Standing Rule 3 -- no hard deletes): 12 tables (logs/usage tables OK; **`oauth_tokens`, `email_drafts`, `inbox_items`, `emails`, `email_log`, `relationship_health_config` are surprises**)

---

## 3. Enum types

`deal_stage`, `design_asset_type`, `email_draft_status`, `event_occurrence_status`, `event_source`, `follow_up_status`, `interaction_type`, `material_request_priority`, `material_request_status`, `material_request_type`, `message_event_type`, `message_status`, `opportunity_stage`, `product_type`, `project_status`, `project_touchpoint_type`, `project_type`, `template_kind`, `template_send_mode`

⚠ **Orphan enum:** `deal_stage` -- the `deals` table does not exist (see callout #2).

---

## 4. Functions (20)

- `compute_relationship_health_score(uuid)` -- computes per-contact score, returns row.
- `current_day_ai_spend_usd()` -- AI spend rollup.
- `increment_rate_limit(text, timestamptz)` -- rate-limit counter bump.
- `recompute_all_relationship_health_scores(int)` -- batch recompute, default 500.
- `recompute_relationship_health_on_touchpoint()` -- trigger fn fired by `trg_touchpoint_recompute_health`.
- `refresh_agent_relationship_health()` -- ⚠ **orphan** (see callout #1).
- `rls_auto_enable()` -- event-trigger function that auto-enables RLS on new tables (explains 40/40 coverage).
- `set_attendees_updated_at`, `set_email_drafts_updated_at`, `set_event_templates_updated_at`, `set_events_updated_at`, `set_projects_updated_at`, `set_templates_updated_at`, `set_updated_at`, `update_updated_at` -- 8 separate updated_at touch functions (could collapse to one).
- `spine_touch_updated_at`, `spine_update_cycle_on_interaction` -- spine/cycle helpers.
- `touch_rep_pulse_updated_at` -- rep pulse touch.
- `update_message_log_status` -- propagates `message_events` → `messages_log.status`.
- `upsert_relationship_health_score(uuid)` -- insert/update one row in `relationship_health_scores`.

---

## 5. Triggers (26)

Mostly `BEFORE UPDATE … set updated_at` on each table. Notable:
- `contacts_rep_pulse_touch` -- touches rep pulse on contact update.
- `message_events_status_sync` (AFTER INSERT on `message_events`) -- propagates status into `messages_log`.
- `trg_touchpoint_recompute_health` (AFTER INS/DEL/UPD on `project_touchpoints`) -- calls `recompute_relationship_health_on_touchpoint`.

⚠ **No trigger fires `refresh_agent_relationship_health()`.** Function is dead code referencing a non-existent MV.

---

## 6. Foreign keys (66)

Sampled FK shape: every domain table has `user_id → auth.users(id)` and most have `contact_id → public.contacts(id)`. Tenant isolation is FK + RLS, not table partitioning.

Common deletion behaviors:
- `ON DELETE CASCADE` for owned data (activities, agent_metrics, captures, design_assets, etc.)
- `ON DELETE RESTRICT` for accounts, attendees, oauth-bearing or referenced-from-elsewhere entities.
- `ON DELETE SET NULL` for nullable lookups (parsed_contact_id, lender_partner_id, event_template_id).

No FK violations of standing-rules (no surprise CASCADEs through user_id paths beyond expectation).

---

## 7. Indexes (124)

Spot check: `accounts_owner_user_id_active_idx ... WHERE (deleted_at IS NULL)` -- partial indexes consistent with soft-delete posture. Per-table `(user_id, …)` patterns dominate. No analysis of unused indexes here -- requires live `pg_stat_user_indexes` data.

---

## 8. Views

- `contacts_spec_view` -- spec/projection.
- `email_drafts_observation` (security_invoker) -- observability over `email_drafts`.
- `interactions` -- compatibility view (older code paths reference `interactions` per dashboard-architecture.md table mapping).

---

# Fresh Callouts (read before drafting any migration)

## Callout 1 -- `agent_relationship_health` materialized view is a phantom

- **What's there:** `refresh_agent_relationship_health()` function with body `REFRESH MATERIALIZED VIEW CONCURRENTLY agent_relationship_health;`. Granted to anon/authenticated/service_role.
- **What's missing:** No `CREATE MATERIALIZED VIEW agent_relationship_health` exists in the schema dump.
- **What's also missing:** No trigger references this function. It is not called from anywhere in the live schema.
- **Conflict:** `~/.claude/rules/dashboard-architecture.md` "Locked Decisions" treats `agent_relationship_health` as the canonical relationship-health source for the dashboard, refresh-on-`interactions` insert/update via trigger.
- **Live reality:** The relationship-health system was reimplemented as per-row computation: `relationship_health_scores` table + `compute_relationship_health_score(uuid)` function + `upsert_relationship_health_score(uuid)` + trigger `trg_touchpoint_recompute_health` on `project_touchpoints`. The MV approach was abandoned but the orphan function and the dashboard-architecture rule both still claim it exists.
- **Decisions needed before any migration touches this:**
  - (a) Drop `refresh_agent_relationship_health()` and `relationship_health_scores`-fed flow stays canonical, OR
  - (b) Create the MV and wire the trigger (matches dashboard-architecture.md), OR
  - (c) Update dashboard-architecture.md to declare `relationship_health_scores` table-driven flow as canonical (re-document the locked decision).

## Callout 2 -- `deals` table does not exist; `opportunities` absorbed it

- **Rule says:** `~/.claude/rules/dashboard-architecture.md` "On `deals` vs `opportunities`" -- both are first-class, not synonyms; `deals` drives closings buckets and the relationship-health 90-day-closed input.
- **Live reality:** `deals` is absent. `opportunities` carries the closing-centric columns: `escrow_company`, `escrow_officer`, `title_company`, `lender_name`, `lender_partner_id`, `contract_date`, `escrow_open_date`, `scheduled_close_date`, `actual_close_date`. The `opportunity_stage` enum still has `prospect → under_contract → in_escrow → closed → fell_through` from the pipeline view.
- **Orphan:** `deal_stage` enum still exists (defined in the type set above), unreferenced by any table.
- **Decisions needed:**
  - (a) Split `deals` back out -- migration would split `opportunities` into pipeline + closing tables, populate `deals` from existing `opportunities` rows where `actual_close_date` or `scheduled_close_date` is set, then update the dashboard-architecture rule's column-list to match. Significant downstream code impact (closings widgets, relationship health 90-day input, queries).
  - (b) Update `~/.claude/rules/dashboard-architecture.md` to reflect that `opportunities` is the unified table -- collapses the "two views of the same customer" doctrine. Drop the `deal_stage` enum as part of cleanup.
- **Either way:** Drop the orphan `deal_stage` enum.

## Callout 3 -- `relationship_health_scores` is structurally weak

It is missing `id`, `created_at`, AND `updated_at`. The `compute_relationship_health_score()` return shape includes `score`, `touchpoint_count`, `last_touchpoint_at`, `half_life_days` -- presumably keyed on `contact_id` alone. Worth confirming the PK and adding `id`/`created_at`/`updated_at` if this table is going to be queried from the dashboard layer.

## Callout 4 -- Soft-delete coverage gaps that violate Standing Rule 3 (no hard deletes)

Tables that probably should have `deleted_at` but don't:
- `oauth_tokens` -- token revocation should be soft, not deleted.
- `email_drafts` -- a draft "discard" should be soft.
- `emails`, `email_log` -- email correspondence is historical record; never hard-delete.
- `inbox_items` -- inbox dismissal is the canonical soft-delete use case.
- `relationship_health_config` -- config audit trail.

Append-only logs (`activity_events`, `ai_usage_log`, `api_usage_log`, `message_events`, `messages_log`, `morning_briefs`, `agent_metrics`) are reasonable to leave hard-delete-only since they're write-once observability. Flag for confirmation.

## Callout 5 -- `rate_limits` and `relationship_health_touchpoint_weights` have no `id`/`created_at`

Both presumably keyed on a domain composite (`(key, window_start)` and `(touchpoint_type, …)`). If the application code does `insert ... on conflict update`, that's fine. If not, add them. Worth a `psql \d` inspection before deciding.

## Callout 6 -- 8 separate `updated_at` touch functions

`set_updated_at`, `set_attendees_updated_at`, `set_email_drafts_updated_at`, `set_event_templates_updated_at`, `set_events_updated_at`, `set_projects_updated_at`, `set_templates_updated_at`, `update_updated_at` all do the same thing in slightly different ways. This is migration accretion, not architecture. Collapse to one shared `set_updated_at()` and re-point triggers in a cleanup migration once the higher-priority callouts are settled.

## Callout 7 -- Local-vs-remote drift is unresolved (Step 3 reconstruction)

From the original audit (Step 4 already complete), the prior totals: 24 local migrations not on remote, 5 remote not in local, 4 brand-new remote-only migrations seen mid-session, 6 non-conformant filenames silently skipped by CLI.

The live schema captured here is **post-drift** -- it includes everything the remote actually has, including the 5 remote-only migrations. Reconstructing what's *missing locally* would require diffing this dump against the union of `~/crm/supabase/migrations/*.sql`. **Not done in this pass** because it requires a separate, careful diff. Recommend a follow-up step before any migration is written, otherwise the new migration may re-create something that already exists remotely.

---

# Recommended next-step decision matrix (no code yet)

| Decision | Owner | Blocks |
|---|---|---|
| MV vs table-driven for `agent_relationship_health` (callout 1) | Alex | Any dashboard-widget work that reads relationship health |
| `deals` split-or-collapse (callout 2) | Alex | Closings widget, relationship health 90-day input, dashboard-architecture rule edit |
| Soft-delete column adds (callout 4) | Alex confirms scope | Any code path that currently does `delete from emails / oauth_tokens / inbox_items` |
| Run local-vs-remote diff (callout 7) | Claude (next step) | Drafting any cleanup migration |

Stop here. Awaiting Alex's call on callouts 1, 2, 4 before drafting the migration.
