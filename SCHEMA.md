# SCHEMA.md -- GAT-BOS Architecture Reference

*Last updated: 2026-04-23 (Slice 2A)*

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
| interactions | Raw | live | Legacy interaction log. Superseded by activity_events for timeline reads. |
| notes | Raw | live | |
| tasks | Raw | live | |
| follow_ups | Raw | live | |
| material_requests | Raw | live | Ticket system. |
| material_request_items | Raw | live | Line items on tickets. |
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
| deals | Raw | live | |
| opportunities | Raw | live | |
| agent_health | Raw | live | Relationship health scores. Read-only via security-invoker view. |
| error_logs | Raw | live | Internal only. Written via logError(). |
| oauth_tokens | Raw | live | GCal OAuth token storage. |
| inbox_items | Raw | live | |
| spine_inbox | Raw | dropped | Dropped in Slice 2A. Execute supabase/migrations/slice-2a-drop-spine.sql to finalize. |
| commitments | Raw | dropped | Dropped in Slice 2A. Execute supabase/migrations/slice-2a-drop-spine.sql to finalize. |
| signals | Raw | dropped | Dropped in Slice 2A. Execute supabase/migrations/slice-2a-drop-spine.sql to finalize. |
| focus_queue | Raw | dropped | Dropped in Slice 2A. Execute supabase/migrations/slice-2a-drop-spine.sql to finalize. |
| cycle_state | Raw | dropped | Dropped in Slice 2A. Execute supabase/migrations/slice-2a-drop-spine.sql to finalize. |

## Restructure Slice Plan

| Slice | Summary |
|-------|---------|
| Slice 1 | Activity ledger foundation: activity_events table, TypeScript contracts, writeEvent helper, five write-path retrofits, contact timeline migration, spine deprecation. |
| Slice 2 | Drop spine tables. Migrate remaining spine reads to activity_events. |
| Slice 3-8 | To be planned. |

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
