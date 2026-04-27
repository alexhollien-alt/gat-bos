# SCHEMA.md -- GAT-BOS Architecture Reference

*Last updated: 2026-04-27 (Slice 4 in progress)*

## Layer Map

| Tier | Description |
|------|-------------|
| Raw data | Supabase tables, RLS-enforced, source of truth. Never accessed directly from browser except through the browser Supabase client with RLS. |
| App | Next.js App Router API routes and Server Actions. Single boundary for all writes. Calls `adminClient` (service-role) to bypass RLS where required. |
| Client | React components. Read-only through Supabase browser client with RLS. Can call Server Actions for mutations. |

## Entity Classification

| Table | Tier | Status | Notes |
|-------|------|--------|-------|
| activity_events | Raw | live | Canonical write target from Slice 1. Ledger for all user-observable actions. |
| contacts | Raw | live | Core CRM entity. |
| interactions | Raw | view | Replaced with a VIEW over activity_events in Slice 2C. Part A: interactions_legacy (legacy rows). Part B: activity_events WHERE verb LIKE interaction.%. See interactions_legacy row. |
| interactions_legacy | Raw | live | Legacy interactions table preserved in Slice 2C. Referenced by the interactions VIEW Part A. Drop deferred to Slice 3 after promote.ts and 5 other writers migrate to writeEvent(). |
| notes | Raw | live | |
| tasks | Raw | live | Extended in Slice 2C: added type (todo/follow_up/commitment), source, due_reason, action_hint columns. |
| follow_ups | Raw | dropped | Dropped in Slice 2C. Rows merged into tasks with type=follow_up. |
| tickets | Raw | live | Ticket system (renamed from `material_requests` in Slice 3B, 23 rows preserved). |
| ticket_items | Raw | live | Line items on tickets (renamed from `material_request_items` in Slice 3B, 23 rows preserved). FK column `request_id` retained as-is (column rename out of scope). |
| _deprecated_requests | Raw | deprecated | Orphan stub renamed from `requests` in Slice 3B (0 rows; soft-deprecate per Standing Rule 3). One inbound FK from `activities.request_id` survives by OID. Eventual hard-drop tracked in `LATER.md`. |
| design_assets | Raw | live | |
| events | Raw | live | Calendar events. Bidirectional sync with GCal. |
| projects | Raw | live | Project tracking. |
| project_touchpoints | Raw | live | |
| email_drafts | Raw | live | Gmail draft management. |
| emails | Raw | live | Sent/received email records. |
| captures | Raw | live | Voice and text captures pending classification. |
| campaign_enrollments | Raw | live | |
| campaigns | Raw | live | |
| campaign_steps | Raw | live | |
| campaign_step_completions | Raw | live | |
| contact_tags | Raw | live | |
| tags | Raw | live | |
| deals | Raw | dropped | Dropped in Slice 2C. Rows merged into opportunities. |
| opportunities | Raw | live | Extended in Slice 2C: added 13 deal-specific columns (buyer_name, seller_name, earnest_money, commission_rate, escrow_company, escrow_officer, title_company, lender_name, lender_partner_id, contract_date, escrow_open_date, scheduled_close_date, actual_close_date). |
| agent_health | Raw | live | Relationship health scores. Read-only via security-invoker view. |
| error_logs | Raw | live | Internal only. Written via logError(). |
| oauth_tokens | Raw | live | GCal OAuth token storage. |
| inbox_items | Raw | live | |
| rate_limits | Operational | live | Slice 3A. Per-(key, window_start) counter for the Supabase-backed sliding-window limiter at src/lib/rate-limit/check.ts. PK (key, window_start). Service-role only via the increment_rate_limit() RPC; RLS denies anon/authenticated. Hard-delete carve-out per Standing Rule 3 (time-bounded operational data); helper opportunistically culls rows older than 2x the longest window. |
| templates | Raw | live | Slice 4 Task 1. Single-tenant template library for the messaging abstraction at src/lib/messaging/send.ts. Versioned via unique (slug, version); resolver picks max(version) where deleted_at IS NULL. Enums: send_mode (resend/gmail/both), kind (transactional/campaign/newsletter). updated_at trigger. RLS Alex-only via auth.jwt() ->> 'email'. Soft-delete via deleted_at. |
| spine_inbox | Raw | dropped | Dropped in Slice 2A. |
| commitments | Raw | dropped | Dropped in Slice 2A. |
| signals | Raw | dropped | Dropped in Slice 2A. |
| focus_queue | Raw | dropped | Dropped in Slice 2A. |
| cycle_state | Raw | dropped | Dropped in Slice 2A. |

## Restructure Slice Plan

| Slice | Summary |
|-------|---------|
| Slice 1 | Activity ledger foundation: activity_events table, TypeScript contracts, writeEvent helper, five write-path retrofits, contact timeline migration, spine deprecation. |
| Slice 2 | Drop spine tables. Migrate remaining spine reads to activity_events. |
| Slice 3A | Route thinning + lib shape standardization. Extract draftActions + intake orchestration to pure helpers under src/lib/. Add Supabase-backed sliding-window rate limiter (rate_limits table + increment_rate_limit RPC) wired to /api/intake, /api/captures, /api/captures/[id]/process. Standardize 8 src/lib/<entity>/ dirs to actions.ts/queries.ts/types.ts shape. |
| Slice 3B | Ticket unification + OAuth cleanup + lib carryforwards. DB renames: material_requests -> tickets, material_request_items -> ticket_items, requests -> _deprecated_requests (soft-deprecate). FK + index + RLS policy cosmetic renames included. /materials route 308-redirects to /tickets; intake badge + preview link ported to /tickets header. OAUTH_STATE_SIGNING_KEY introduced as new env var, decoupled from OAUTH_ENCRYPTION_KEY (one-slice fallback). Slice 3A's 4 deferred lib carryforwards land: captures/parse.ts -> rules.ts; captures/promote.ts folded into actions.ts; campaigns/auto-enroll.ts folded into actions.ts; events/invite-templates/ promoted to single-file events/invite-templates.ts. |
| Slice 4-8 | To be planned. |

## activity_events Column Reference

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| id | uuid | no | gen_random_uuid() | Primary key |
| user_id | uuid | no | -- | RLS owner (auth.uid()). Always OWNER_USER_ID in single-tenant. |
| actor_id | uuid | no | -- | Who performed the action. Usually OWNER_USER_ID. |
| verb | text | no | -- | Action type. One of the ActivityVerb union values. |
| object_table | text | no | -- | Supabase table of the affected row (e.g. 'captures', 'email_drafts'). |
| object_id | uuid | no | -- | UUID of the affected row. |
| context | jsonb | no | '{}' | Optional extra data (from_status, to_status, contact_id, etc.). |
| occurred_at | timestamptz | no | now() | When the action happened. Set to event time for backfills. |
| created_at | timestamptz | no | now() | Row insertion time. |
| deleted_at | timestamptz | yes | null | Soft-delete timestamp. |
