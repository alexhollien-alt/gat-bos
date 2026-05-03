# AI Agent Guide -- GAT-BOS CRM

## Context

You are an AI agent (Claude, Cursor, GPT, Gemini, or successor) landing on this codebase cold. This document is your fastest path to productive contribution. It is written for the case where you have NOT yet read CLAUDE.md, BUILD.md, BLOCKERS.md, the architecture docs, or any source code -- it tells you what to read and in what order.

If you read nothing else, read this document and then `~/crm/AGENTS.md` (the one-page contract). Together they give you the operational floor.

---

## Where do I start?

In this exact order:

1. **`~/crm/AGENTS.md`** -- the one-page contract. Stack, hard rules, build commands. 30-second read.
2. **`~/crm/PROJECT_CONTEXT.md`** -- what the product does, who Alex is, what the business constraints are. 1-minute read.
3. **`~/crm/CLAUDE.md`** -- per-repo Claude Code rules. Tailwind classes, GSD protocol, build vs plumbing protocol, architecture notes. 2-minute read.
4. **`~/crm/BUILD.md`** -- what's currently building + the full Built history (every slice annotation). Skim "Currently Building" + the most recent two `## Built` entries. 3-minute read.
5. **`~/crm/BLOCKERS.md`** -- open broken integrations. Skim. 1-minute read.
6. **`~/crm/docs/architecture/EXECUTIVE_SUMMARY.md`** -- the one-stop tour of risks, opportunities, and the system shape. 5-minute read.
7. **The architecture doc that matches your task:**
   - Anything UI / route / module structure -> `system-map.md`.
   - Anything end-to-end flow -> `data-flow.md`.
   - Anything auth / RLS / tenant / cron / webhook -> `auth-flow.md` (and treat it as **OFF-LIMITS for edits** without explicit approval).
   - Anything refactor / debt -> `dependency-analysis.md` and `technical-debt-hotspots.md`.

After this 15-minute read you have a working mental model. Don't open source files until you've done it.

---

## What is OFF-LIMITS?

**Slice 7A.5 (Migration History Reconciliation) is the active in-flight slice.** Anything in its perimeter is off-limits to autonomous changes. Document and surface; do not auto-fix.

### The 7A.5 perimeter

| File / area | Why off-limits |
|---|---|
| `~/crm/supabase/migrations/**/*.sql` | 7A.5 owns the migration ledger. No new migrations, no edits to existing migrations, no deletions. |
| `~/crm/src/middleware.ts` | Auth boundary. Touching this changes the public-route allow-list and breaks every flow. |
| `~/crm/src/lib/auth/tenantFromRequest.ts` (and its tests) | Single tenant resolver. Every API route depends on its contract. |
| `~/crm/src/lib/supabase/admin.ts` | Service-role client. Touching this is a tenant-isolation risk. |
| `~/crm/src/lib/supabase/server.ts` | Authenticated server client. Cookie wiring is sensitive. |
| `~/crm/src/lib/supabase/client.ts` | Browser client. Anon-key wiring. |
| `~/crm/src/lib/api-auth.ts` | Bearer + cron + session gates. |
| `~/crm/src/lib/activity/writeEvent.ts` | Canonical event ledger writer. Slice 7A hard-broke the contract; do not soften. |
| `~/crm/src/lib/rate-limit/check.ts` and `extract-ip.ts` | Operational counter table; fail-open semantics matter. |
| `~/crm/src/lib/ai/_budget.ts` | Daily AI cost guard. Fail-open is intentional. |
| `~/crm/src/lib/captures/actions.ts` | Promotion state machine; touches activity ledger and 5 downstream tables. |
| `~/crm/supabase/config.toml` | Supabase CLI config. |
| `~/crm/.env*` | Secrets. Never read or modify. |
| `~/crm/package.json`, `vercel.json`, `next.config.mjs` | Stack-locked. |

### Patterns that must NOT come back

These were extinct in Slice 7A. Do not reintroduce them, even as quick fixes:

- `OWNER_USER_ID` env var -- removed. `userId` comes from `tenantFromRequest`, row data, or explicit handler arg.
- `ALEX_EMAIL` constant -- removed. UI is no longer email-gated.
- `auth.jwt() ->> 'email' = '...'` in any RLS policy -- replaced with `user_id = auth.uid()`.
- `.from('material_requests')` -- table renamed to `tickets` (Slice 3B). Use `tickets`.
- `.from('deals')` -- merged into `opportunities` in Slice 2C.
- `.from('follow_ups')` -- merged into `tasks` with `type='follow_up'` in Slice 2C.
- `.from('spine_inbox')` / `commitments` / `signals` / `focus_queue` / `cycle_state` -- dropped in Slice 2A.
- `import ... from '@/lib/spine/...'` -- the spine namespace was deleted.

### Banned providers

GAT-BOS does NOT use, and will not introduce:

- **Twilio** or any other SMS provider. No SMS surface, no phone-OTP auth.
- **Zapier**, **Make**, or **n8n**. Orchestration lives in cron + post-creation hooks.
- **Stripe**. No billing surface.
- **Vercel KV**, **Edge Config**, **Blob**. State lives in Supabase.
- **Sentry**, **PostHog**, **Datadog**, **Bugsnag**. Errors go to `error_logs`.
- **Mailerlite** (migrated off). All campaign + transactional email is Resend.

If a request seems to require any of these, surface the conflict; do not introduce.

---

## How do I find X? (intent reverse-index)

Don't grep. Use this table.

### Read paths

| I want to... | Look at... |
|---|---|
| Read a contact's timeline | `src/lib/activity/queries.ts` -> `getContactTimeline()` |
| List captures | `src/lib/captures/queries.ts` |
| Get a project's touchpoints | `src/lib/projects/queries.ts` |
| Read campaign enrollments | `src/lib/campaigns/queries.ts` |
| Read draft email | `src/app/api/email/drafts/route.ts` (GET) |
| Read morning brief | `src/app/api/morning/latest/route.ts` |
| Read inbox items | `src/app/api/inbox/items/route.ts` |
| Get a contact by id | `src/app/api/contacts/[id]/route.ts` (GET) |

### Write paths

| I want to... | Look at... |
|---|---|
| Insert a capture | `src/app/api/captures/route.ts` (POST) |
| Promote a capture | `src/lib/captures/actions.ts` -> `promoteCapture()` |
| Send an email | `src/lib/messaging/send.ts` -> `sendMessage()` (the abstraction). For draft state machine, `src/app/api/email/approve-and-send/route.ts`. |
| Create a Gmail draft | `src/lib/messaging/adapters/gmail.ts` |
| Create a calendar event | `src/app/api/calendar/create/route.ts`, server side `src/lib/calendar/client.ts` |
| Create a contact | `src/app/api/contacts/route.ts` (POST) |
| Create a project | `src/app/api/projects/route.ts` (POST) |
| Process intake submission | `src/lib/intake/process.ts` |
| Enroll a contact in a campaign | `src/lib/campaigns/actions.ts` -> `autoEnrollNewAgent()` |
| Mark Gmail message read | `src/app/api/gmail/mark-read/route.ts` |

### Side effects

| I want to... | Use... |
|---|---|
| Emit an activity_events row | `src/lib/activity/writeEvent.ts` -> `writeEvent()`. Pass `userId` as input -- no env fallback. |
| Log an error | `src/lib/error-log.ts` -> `logError(scope, message, context)` |
| Retry an async call | `src/lib/retry.ts` -> `withRetry(fn, label)` |
| Validate user input | `src/lib/validations.ts` (Zod schemas) |
| Run an AI capability | `src/lib/ai/<capability>.ts`. Always uses `callClaude()` from `_client.ts`. |
| Send via Resend | `src/lib/resend/client.ts` (single SDK instance) or `src/lib/messaging/adapters/resend.ts` |
| Send via Gmail | `src/lib/gmail/sync-client.ts` (oauth_tokens-backed) or `src/lib/messaging/adapters/gmail.ts` |
| Read Google Calendar | `src/lib/calendar/client.ts` |

### Auth / tenant / RLS

| I want to... | Use... |
|---|---|
| Resolve tenant from a request | `tenantFromRequest(req)` from `src/lib/auth/tenantFromRequest.ts`. Pass `{service: 'cron' \| 'webhook' \| 'intake' \| 'background'}` for non-user paths. |
| Check Bearer CRON_SECRET | `verifyCronSecret(request)` from `src/lib/api-auth.ts` |
| Check INTERNAL_API_TOKEN Bearer | `requireApiToken(request)` from same |
| Check Supabase session | `verifySession()` from same |
| Get session-scoped Supabase | `await createClient()` from `src/lib/supabase/server.ts` |
| Get service-role Supabase | `adminClient` from `src/lib/supabase/admin.ts`. **Always** scope manually with `.eq('user_id', ...)` or `.eq('account_id', ...)`. |
| Get browser Supabase | `createClient()` from `src/lib/supabase/client.ts` |

### UI

| I want to... | Look at... |
|---|---|
| Add a button | `@/components/ui/button` (shadcn v4) |
| Add a select / input / textarea / label / card / dialog | `@/components/ui/<primitive>` |
| Add a showcase-tier component | `@/components/screen/*` (the custom design library) |
| Add a Cmd+K command | `src/components/command-palette.tsx` (cmdk + shadcn Command) |
| Add a TanStack Query | `useQuery({queryKey, queryFn, staleTime})`. Provider lives at `src/components/query-provider.tsx`. Per-data-type staleTime defaults are documented in `~/crm/docs/tanstack-query-provider.md`. |
| Subscribe to Realtime | Pattern documented at `~/crm/docs/supabase-realtime-pattern.md`. Use Realtime to invalidate React Query, never to mutate component state directly. |
| Add a chart | Recharts directly (today). shadcn Chart wrapper not adopted yet (P2 debt). |

---

## What conventions matter?

### 1. `writeEvent()` is the only sanctioned writer to `activity_events`

Every user-observable side effect emits a row via `writeEvent({userId, actorId, verb, object, context})`. Do NOT insert directly into `activity_events` from a route handler. The verb must be from the `ActivityVerb` union in `src/lib/activity/types.ts`.

### 2. `tenantFromRequest()` is the only sanctioned tenant resolver

API route handlers that need user context call `tenantFromRequest(req)`. Service routes call `tenantFromRequest(req, {service: 'cron' | 'webhook' | 'intake' | 'background'})`. Never read `OWNER_USER_ID` -- it's gone.

### 3. Three-client choice rule

| Site | Client |
|---|---|
| Server Component or Server Action with session | `await createClient()` from `lib/supabase/server.ts` |
| Client component / hook | `createClient()` from `lib/supabase/client.ts` |
| API route with service-role need (cron, webhook, write) | `adminClient` from `lib/supabase/admin.ts`, with explicit `.eq('user_id', ...)` or `.eq('account_id', ...)` scope |

Choosing wrong is the most common bug class.

### 4. Anthropic prompt cache enabled by default

Every `callClaude()` capability sets `cache_control: {type: 'ephemeral'}` on the system prompt. Anthropic caches the prefix server-side for 5 minutes. Capabilities that benefit from durable cross-process result reuse (morning-brief, capture-parse) also pass `cacheKey` to enable the DB-backed `ai_cache` table.

### 5. Rate-limit fail-open

`checkRateLimit()` returns `{allowed: true}` on RPC error. Inbound writes prefer availability over enforcement. Don't change this without Alex.

### 6. AI budget guard fail-open

`checkBudget()` treats spent_usd = 0 on RPC error. The Anthropic call proceeds. Same availability stance.

### 7. Idempotency keys for synthetic rows

When fan-out creates rows that may be re-fired by a hook (e.g., proactive listing-launch drafts via synthetic `emails` parents), use a sentinel `gmail_id` like `proactive-listing-launch-{projectId}-{slug}` so re-runs upsert on the unique key.

### 8. Hooks are isolated

`firePostCreationHooks` runs each handler in its own try/catch. One handler failure cannot cascade. Failed handlers write `error_logs` + `activity_events(verb='hook.failed')` so the parent operation succeeds.

### 9. No hard deletes

Every multi-tenant table has `deleted_at timestamptz`. Soft-delete by setting it. The exception is `rate_limits` (operational, time-bounded data, hard-delete carve-out per Standing Rule 3).

### 10. Migrations are idempotent

Every migration uses `DROP IF EXISTS` before `CREATE`. **You don't need to write migrations in this architecture pass.** Slice 7A.5 owns the migration ledger.

### 11. Tailwind class mapping

Per CLAUDE.md, font classes are CSS-variable-bound:

| Class | CSS variable | Font |
|---|---|---|
| `font-display` | `--font-display` | Syne |
| `font-sans` | `--font-sans` | Inter |
| `font-mono` | `--font-mono` | Space Mono |

Do NOT hardcode font families in components. Use the classes.

### 12. shadcn primitives over hand-rolled

Use `@/components/ui/*` (Button, Select, Input, Textarea, Label, Card, Dialog, Tabs, Popover, etc.). 37 sites import Button alone -- the pattern is established.

---

## What patterns are deprecated?

| Pattern | Status |
|---|---|
| Spine tables (`spine_inbox`, `commitments`, `signals`, `focus_queue`, `cycle_state`) | Dropped Slice 2A. Do not write to them, do not query them, do not import from `@/lib/spine`. |
| `material_requests` table reference | Renamed to `tickets` in Slice 3B. Use `tickets`. |
| `deals` table | Merged into `opportunities` in Slice 2C. Pipeline data lives there. |
| `follow_ups` table | Merged into `tasks` with `type='follow_up'` in Slice 2C. |
| `interactions_legacy` direct INSERTs | Migrated to `writeEvent()`. The view `interactions` reads from `activity_events`. |
| `OWNER_USER_ID` env var | Deleted Slice 7A. |
| `ALEX_EMAIL` constant | Deleted Slice 7A. |
| Email-based RLS policies (`auth.jwt() ->> 'email'`) | Rewritten to `user_id = auth.uid()`. |
| Anthropic SDK direct calls outside `lib/ai/` | Replaced with `callClaude()` wrapper. The `lib/claude/*` shims still exist as re-export bridges; new code imports from `@/lib/ai/*`. |
| `lib/gmail/client.ts` | Deleted Slice 4. Use `lib/gmail/sync-client.ts`. |
| `GOOGLE_REFRESH_TOKEN` env var | Removed Slice 4. OAuth tokens live in `oauth_tokens` table; `loadTokens()` + `getOAuth2Client()` is the path. |
| `OAUTH_ENCRYPTION_KEY` for state nonce signing | Slice 4 retired the fallback. State signing uses `OAUTH_STATE_SIGNING_KEY` only. `OAUTH_ENCRYPTION_KEY` still encrypts tokens at rest. |
| Raw `npm install` / `yarn add` | Banned. pnpm only. |

---

## How do I verify before claiming done?

Per CLAUDE.md, the verify gate is:

```bash
cd ~/crm
pnpm typecheck     # tsc --noEmit
pnpm build         # next build
```

Both must pass. Add `pnpm test` (vitest) and `pnpm lint` (next lint) before commits when relevant.

If you touch middleware or routing: also run `pnpm dev` and confirm routes load. Per CLAUDE.md.

If you touch a `(app)/...` page: open the page in a browser via dev server (not just typecheck). Server Components vs Client Components have edge cases that typecheck does not catch.

---

## Common mistakes to avoid

1. **Reaching for `adminClient` without scoping by `user_id`.** RLS won't catch you. Tenant isolation is a manual contract on this client.
2. **Writing directly into `activity_events`.** Use `writeEvent()`.
3. **Reading a session in a Server Action via `cookies()`** outside `lib/supabase/server.ts`. Wrap that helper.
4. **Mixing the `materials/` and `tickets/` vocab.** DB and route are `tickets`. Component directory still says `materials`. Don't propagate the drift.
5. **Importing `@/lib/spine/...`.** It doesn't exist.
6. **Drafting a new migration without Alex.** 7A.5 owns the ledger right now.
7. **Adding a new env var without documenting it.** README and `.env.local.example` should mention every required var.
8. **Removing fail-open semantics.** Rate limit and budget guard fail open by design. Switching to fail-closed during a Supabase blip would 503 the inbound write surface.
9. **Hard-coding `OWNER_USER_ID` or `ALEX_EMAIL`.** These are extinct. Use `tenantFromRequest`.
10. **Treating BLOCKERS.md as gospel.** Verify each entry against current code; some are stale post-7A.5 (see `technical-debt-hotspots.md` P0-1).

---

## Build vs Plumbing protocol

Per CLAUDE.md, every session classifies the work:

- **Build** = new product surface, feature work, UI, copy. Reads `BUILD.md`. Doesn't touch broken integrations -- fill-and-flag instead, log to `BLOCKERS.md`.
- **Plumbing** = migrations, schema fixes, auth, middleware, integrations, resolving blockers. Reads `BLOCKERS.md`. Picks one item or one cluster.

Don't mix. A build session that hits a broken integration logs the blocker and hardcodes a fallback; a plumbing session that's tempted to ship UI logs the temptation to `LATER.md` and stays scoped.

---

## GSD vs /lock

Inside `~/crm/`, **GSD replaces /lock as the execution protocol** (per CLAUDE.md). Use `/gsd-plan-phase` to emit a phase plan; wait for Alex's literal "lock it" or "go" before running `/gsd-execute-phase`. `.planning/config.json` enforces interactive mode and `auto_advance: false` -- every phase transition needs explicit approval.

Outside `~/crm/`, `/lock` still owns every path.

---

## When in doubt

Open these in order:

1. `system-map.md` -- you'll see the lay of the land.
2. `data-flow.md` -- pick the flow closest to your task.
3. `auth-flow.md` -- treat as immutable; consult, don't edit.
4. `technical-debt-hotspots.md` -- check whether your task overlaps a known debt item.
5. `BUILD.md` -- find the most recent slice ship that touched your area.

Then write code. Then run `pnpm typecheck && pnpm build`.

---

## What this guide does NOT cover

- Brand tokens / fonts / colors / voice -- that's `~/.claude/rules/brand.md` (loaded automatically in Claude sessions).
- Design rules / image audit / data models -- `~/.claude/context/design-foundation.md` and `~/.claude/context/digital-aesthetic.md`.
- Dashboard architecture stack-lock -- `~/.claude/rules/dashboard-architecture.md`.
- Standing rules (em dashes, hard deletes, etc.) -- `~/.claude/rules/standing-rules.md`.

These are loaded by the Claude Code harness when applicable. Don't duplicate their content into `~/crm/` docs.

---

## Cross-references

- One-page contract: `~/crm/AGENTS.md`
- Business framing: `~/crm/PROJECT_CONTEXT.md`
- Per-repo rules: `~/crm/CLAUDE.md`
- Architecture index: `~/crm/docs/architecture/EXECUTIVE_SUMMARY.md`
