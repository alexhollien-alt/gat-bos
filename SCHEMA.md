# SCHEMA.md -- GAT-BOS Architecture Reference

*Last updated: 2026-05-02 (Slice 7C shipped)*

## Layer Map

| Tier | Description |
|------|-------------|
| Raw data | Supabase tables, RLS-enforced, source of truth. Never accessed directly from browser except through the browser Supabase client with RLS. |
| App | Next.js App Router API routes and Server Actions. Single boundary for all writes. Calls `adminClient` (service-role) to bypass RLS where required. |
| Client | React components. Read-only through Supabase browser client with RLS. Can call Server Actions for mutations. |

## Entity Classification

| Table | Tier | Status | Notes |
|-------|------|--------|-------|
| agent_invites | Raw | live | Slice 7C. Magic-link invitation tokens for portal onboarding. PK id uuid; account_id (FK accounts ON DELETE RESTRICT) + contact_id (FK contacts ON DELETE RESTRICT, type='agent' validated by route handler upstream) + token_hash text NOT NULL (sha256 of plaintext token; plaintext only ever in email body + 201 response payload, never persisted) + expires_at timestamptz default `now() + interval '7 days'` + redeemed_at timestamptz NULL + deleted_at timestamptz. Partial unique index `agent_invites_token_hash_unique WHERE redeemed_at IS NULL AND deleted_at IS NULL` enforces single-use. Account-scoped RLS via the 7B `(SELECT id FROM accounts WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)` subquery pattern. Consumed via SECURITY DEFINER RPC `redeem_agent_invite(p_token_hash text)` granted EXECUTE TO anon (route at `src/app/portal/redeem/route.ts` invokes anon to match unauthenticated visitor path); RPC validates not-expired AND redeemed_at IS NULL AND deleted_at IS NULL, flips redeemed_at, returns `(email, slug, account_id, contact_id)`, raises P0002 on any unredeemable case. |
| accounts | Raw | live | Slice 7A. Tenant root. PK id uuid; columns name, slug (unique), owner_user_id (FK auth.users), deleted_at. Single Alex seed row (`name='Alex Hollien' / slug='alex-hollien'`). Resolved by `tenantFromRequest()` via `owner_user_id = auth.uid()`. |
| activity_events | Raw | live | Canonical write target from Slice 1. Ledger for all user-observable actions. |
| contacts | Raw | live | Core CRM entity. Slice 7B added `slug text` (NULL until backfilled, UNIQUE per account via partial index `contacts_account_slug_unique` WHERE deleted_at IS NULL AND slug IS NOT NULL), `tagline text` (NULL OK; route hides null), `account_id uuid` (FK accounts ON DELETE RESTRICT, backfilled to single Alex account, RLS account-scoped via `(SELECT id FROM accounts WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)`). `contacts_type_check` extended with `'agent'` (12th sanctioned value, joins existing classifications; replaces old AGENTS const) and `'escrow'` (13th -- fold-in: 10 prod rows already used `type='escrow'` for escrow officers like Marlene Ruggeri; surfaced by constraint-rebuild row-level revalidation). `photo_url` NOT added; reused existing `headshot_url` per Q-drift-2 (Standing Rule 16). Public-agent anon read via security-definer RPCs `get_public_agent_slugs()` + `get_public_agent_by_slug(text)`; whitelisted columns only (8 public, 31 private rejected). `/agents/[slug]` SSGs the 5 seeded agent rows (julie-jarmiolowski / fiona-bigbee / denise-van-den-bossche / joey-gutierrez / amber-hollien). |
| interactions | Raw | view | Replaced with a VIEW over activity_events in Slice 2C. Part A: interactions_legacy (legacy rows). Part B: activity_events WHERE verb LIKE interaction.%. See interactions_legacy row. |
| interactions_legacy | Raw | live | Legacy interactions table preserved in Slice 2C. Referenced by the interactions VIEW Part A. Drop deferred to Slice 3 after promote.ts and 5 other writers migrate to writeEvent(). |
| notes | Raw | live | |
| tasks | Raw | live | Extended in Slice 2C: added type (todo/follow_up/commitment), source, due_reason, action_hint columns. Slice 5B: added project_id (uuid, FK projects ON DELETE SET NULL, partial index WHERE deleted_at IS NULL AND project_id IS NOT NULL). status check constraint allows ('open','done','snoozed','cancelled'). |
| follow_ups | Raw | dropped | Dropped in Slice 2C. Rows merged into tasks with type=follow_up. |
| tickets | Raw | live | Ticket system (renamed from `material_requests` in Slice 3B, 23 rows preserved). |
| ticket_items | Raw | live | Line items on tickets (renamed from `material_request_items` in Slice 3B, 23 rows preserved). FK column `request_id` retained as-is (column rename out of scope). |
| design_assets | Raw | live | |
| events | Raw | live | Calendar events. Bidirectional sync with GCal. |
| projects | Raw | live | Project tracking. |
| project_touchpoints | Raw | live | Slice 5B: added due_at, deleted_at, user_id (NOT NULL after backfill to OWNER_USER_ID), last_reminded_at columns + partial indexes on (due_at) and (last_reminded_at) WHERE deleted_at IS NULL. project_touchpoint_type enum gained value 'listing_setup'. Alex-only RLS via policy alex_touchpoints_all. |
| email_drafts | Raw | live | Gmail draft management. |
| emails | Raw | live | Sent/received email records. |
| captures | Raw | live | Voice and text captures pending classification. |
| campaign_enrollments | Raw | live | next_action_at timestamptz column + partial index `idx_enrollments_next_action ON (next_action_at) WHERE deleted_at IS NULL AND status='active'` (registered earlier via the [2026-04-22] paste-file). Slice 5A Task 1 verified the index + added partial index `idx_campaign_enrollments_contact_active` for auto-enroll dedup. Runner reads `enrolled_at` and treats `campaign_steps.delay_days` as an absolute offset from enrollment when scheduling next_action_at. |
| campaigns | Raw | live | |
| campaign_steps | Raw | live | Slice 5A Task 4 added template_slug text NULL column + partial index idx_campaign_steps_active_with_slug ON (campaign_id, step_number) WHERE deleted_at IS NULL AND template_slug IS NOT NULL. Runner treats NULL template_slug as a no-op skip and emits campaign.step_skipped activity event. |
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
| messages_log | Raw | live | Slice 4 Task 2. Per-send audit row for the messaging abstraction. FK templates ON DELETE RESTRICT. status enum (queued/sent/delivered/bounced/opened/clicked/failed). event_sequence jsonb append-only array, mirrors email_drafts.audit_log shape. Indexes: (template_id, sent_at desc) and partial (status, created_at desc) WHERE deleted_at IS NULL. RLS Alex-only via auth.jwt() ->> 'email'. Soft-delete via deleted_at. Status auto-advances via message_events_status_sync trigger (Slice 5A Task 2). |
| message_events | Raw | live | Slice 5A Task 2. Resend webhook event ingestion. FK messages_log ON DELETE CASCADE. event_type enum message_event_type (sent/delivered/opened/clicked/bounced/complained). payload jsonb. AFTER INSERT trigger update_message_log_status() advances messages_log.status forward (queued -> sent -> delivered -> opened -> clicked); bounced and complained set status=bounced; bounced/failed are terminal sticky. Index (message_log_id, received_at DESC) WHERE deleted_at IS NULL. RLS Alex-only. Soft-delete via deleted_at. |
| ai_usage_log | Raw | live | Slice 6. Per-call audit + cost tracking for every Claude call routed through `src/lib/ai/_client.ts`. Cols: feature, model, input/output/cache_read/cache_creation tokens, cost_usd numeric(10,6), occurred_at, context jsonb, user_id, deleted_at. Partial indexes on (occurred_at DESC) and (feature, occurred_at DESC) WHERE deleted_at IS NULL. RLS Alex-only. SECURITY DEFINER RPC `current_day_ai_spend_usd()` returns numeric SUM scoped to America/Phoenix calendar day. Full column reference below. |
| ai_cache | Raw | live | Slice 6. Per-feature durable result cache (distinct from Anthropic's prompt cache). PK (feature, cache_key). value jsonb, model, expires_at (NULL = TTL-less), accessed_at (best-effort touch on read), deleted_at. Partial index on (feature, expires_at) WHERE deleted_at IS NULL. RLS Alex-only. Full column reference below. |
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
| Slice 4 | Templates + messaging abstraction. `templates` + `messages_log` tables. `src/lib/messaging/` namespace (send.ts/render.ts/types.ts + resend/gmail adapters). Weekly Edge template seeded from canonical eval-output. OAuth state-signing fallback retired; `/api/inbox/scan` migrated to oauth_tokens-backed sync client; `_deprecated_requests` hard-removed. |
| Slice 5A | Campaign runner cron + drip enrollments + Resend webhook -> message_events. `/api/cron/campaign-runner` 15-min tick, `message_events` table + status-sync trigger, `campaign_steps.template_slug`. Drip content seeded (4 New Agent Onboarding templates + Agent Nurture campaign + 2 templates + 2 steps). |
| Slice 5B | Post-creation event hooks + weeklyWhere + touchpoint-reminder cron. `src/lib/hooks/` dispatcher with isolated handlers for project/contact/event creation. `weeklyWhere.ts` end-of-Sunday America/Phoenix bound. `/api/cron/touchpoint-reminder` 5am MST tick. project_touchpoints + tasks schema deltas; 3 template seeds (listing-launch-invite, listing-launch-social, daily-touchpoint-summary). |
| Slice 6 | AI layer consolidation + budget guard. `src/lib/ai/` namespace consolidating every Claude call site (_client.ts, _budget.ts, _cache.ts, _pricing.ts + capability files morning-brief.ts, draft-revise.ts, capture-parse.ts, inbox-score.ts). `ai_usage_log` + `ai_cache` tables + `current_day_ai_spend_usd()` RPC. `AI_DAILY_BUDGET_USD` env var (default 5.00) with soft-cap warning at 80% + hard-cap BudgetExceededError. Site migrations: 7a brief-client shim, 7b captures opt-in AI gated on CAPTURES_AI_PARSE flag (default off), 7c draft-revise shim, 7d inbox/scorer shim. New ActivityVerb values: ai.budget_blocked, ai.budget_warning, ai.budget_default_used. |
| Slice 7A | Multi-tenant auth + RLS rewrite. New `accounts` table (single Alex seed). `src/lib/auth/tenantFromRequest.ts` single resolver for user/account context with explicit failure modes. 15 add-column migrations seed `user_id uuid NOT NULL DEFAULT auth.uid()` + FK auth.users + index across ai_cache / attendees / email_drafts / emails / error_logs / event_templates / events / message_events / messages_log / morning_briefs / projects / relationship_health_config / relationship_health_scores / relationship_health_touchpoint_weights / templates. `oauth_tokens.user_id` text->uuid type fix (suppl-16). 21 RLS rewrites move every prior `(auth.jwt() ->> 'email') = 'alex@alexhollienco.com'` policy to column-based `user_id = auth.uid()` USING + WITH CHECK across the 15 added-column tables plus `ai_usage_log`, `oauth_tokens`, `project_touchpoints` (3 with pre-existing user_id). Code cleanup: writeEvent.ts hard-break (userId required), api-auth.verifySession is tenant-agnostic, OWNER_USER_ID env / ALEX_EMAIL constant removed from src/. Smoke harness at `scripts/slice7a-smoke.mjs`. |
| Slice 7B | Accounts + contacts schema delta + seed agents + public agent read. Task 1 contacts schema delta (slug + tagline + account_id; `'agent'` + `'escrow'` added to contacts_type_check; account-scoped RLS rewrite). Tasks 2a-2f account_id + account-scoped RLS on tasks, captures, opportunities, campaign_enrollments, events, email_drafts (6 tables, atomic per-table commits). Task 3 seed 5 agent contact rows (Path A upsert-by-email so existing realtor rows are promoted in place; preserves source provenance + FK history). Task 4 `/agents/[slug]` migrated from hardcoded `AGENTS` const to security-definer RPC backing. Task 5 public-agent anon read via SECURITY DEFINER RPCs `get_public_agent_slugs()` + `get_public_agent_by_slug(text)` (8 whitelisted columns, 31 private rejected). Task 6 smoke harness at `scripts/slice7b-smoke.mjs` (3 layers: RPC defense, anon direct-table denial, HTTP route). Closes BLOCKERS.md [2026-04-21] contacts schema gap. Live on prod after A2 audit reconciliation: `supabase migration repair --status applied` for 17 Slice 7A residue migrations + `supabase db push --linked` for 9 Slice 7B forward migrations. |
| Slice 7C+ | To be planned. Portal pages, magic-link invite, account_members (multi-user-per-account), per-account billing, agents writing from portal. |

## activity_events Column Reference

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| id | uuid | no | gen_random_uuid() | Primary key |
| user_id | uuid | no | -- | RLS owner (auth.uid()). Single-tenant today; resolves to the Alex auth.users row. |
| actor_id | uuid | no | -- | Who performed the action. Usually OWNER_USER_ID. |
| verb | text | no | -- | Action type. One of the ActivityVerb union values. |
| object_table | text | no | -- | Supabase table of the affected row (e.g. 'captures', 'email_drafts'). |
| object_id | uuid | no | -- | UUID of the affected row. |
| context | jsonb | no | '{}' | Optional extra data (from_status, to_status, contact_id, etc.). |
| occurred_at | timestamptz | no | now() | When the action happened. Set to event time for backfills. |
| created_at | timestamptz | no | now() | Row insertion time. |
| deleted_at | timestamptz | yes | null | Soft-delete timestamp. |

## ai_usage_log Column Reference (Slice 6)

Per-call audit + cost tracking for every Claude API call routed through `src/lib/ai/_client.ts`. RLS Alex-only via `auth.jwt() ->> 'email'`. Indexes: `(occurred_at DESC) WHERE deleted_at IS NULL`, `(feature, occurred_at DESC) WHERE deleted_at IS NULL`.

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| id | uuid | no | gen_random_uuid() | Primary key |
| feature | text | no | -- | Capability name. Enum-style text: `morning-brief`, `capture-parse`, `draft-revise`, `inbox-score`, future capabilities. |
| model | text | no | -- | Anthropic model id used (e.g. `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`). |
| input_tokens | integer | no | 0 | Uncached prompt tokens billed at full input rate. |
| output_tokens | integer | no | 0 | Output tokens billed at full output rate. |
| cache_read_tokens | integer | no | 0 | Tokens served from Anthropic prompt cache (~0.1x input rate). |
| cache_creation_tokens | integer | no | 0 | Tokens written to Anthropic prompt cache (~1.25x input rate, 5-min TTL). |
| cost_usd | numeric(10,6) | no | 0 | Computed at write time from `src/lib/ai/_pricing.ts` rate table. Cache hits log cost=0. |
| occurred_at | timestamptz | no | now() | When the call happened. RPC `current_day_ai_spend_usd()` aggregates across `>= date_trunc('day', now() AT TIME ZONE 'America/Phoenix')`. |
| context | jsonb | no | '{}' | Free-form metadata: `{cache_hit: true}` on ai_cache hits, `{stop_reason: ...}` on success, `{error: ...}` on failure. |
| user_id | uuid | no | -- | RLS owner (always OWNER_USER_ID in single-tenant). |
| deleted_at | timestamptz | yes | null | Soft-delete timestamp. |
| created_at | timestamptz | no | now() | Row insertion time. |

RPC `current_day_ai_spend_usd()` -- SECURITY DEFINER, returns numeric. SUM(cost_usd) WHERE deleted_at IS NULL AND occurred_at >= start of today in America/Phoenix. Granted to `authenticated` + `service_role`.

## ai_cache Column Reference (Slice 6)

Per-feature durable result cache. Distinct from Anthropic's prompt cache. Each capability owns its `cache_key` derivation. RLS Alex-only. Index: `(feature, expires_at) WHERE deleted_at IS NULL` for cleanup queries.

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| feature | text | no | -- | PK part 1. Capability name, must match `ai_usage_log.feature` values. |
| cache_key | text | no | -- | PK part 2. sha256 hex of normalized input from `src/lib/ai/_cache.ts` `cacheKey()`. |
| value | jsonb | no | -- | Cached response payload (shape determined by capability). |
| model | text | yes | null | Model id at cache write time. Informational. |
| expires_at | timestamptz | yes | null | NULL = TTL-less. When set, `cacheGet()` returns null past expiry. |
| accessed_at | timestamptz | no | now() | Best-effort updated on every cache hit. |
| created_at | timestamptz | no | now() | Row insertion time. |
| deleted_at | timestamptz | yes | null | Soft-delete timestamp. |
