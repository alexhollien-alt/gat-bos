# Phase 015 -- Slice 7C: Portal Routes + Magic-Link Invite

**Generated:** 2026-05-01
**Base:** main @ `ced5422` (Slice 7B merge)
**Branch (target):** `gsd/015-slice-7c-portal-routes`
**Classification:** BUILD + AUTH + ROUTING. First multi-tenant authenticated user surface.
**Counter:** 13/15 → 14/15 slices live.

---

## Open Questions -- LOCKED ANSWERS

| OQ | Choice | Rationale |
|----|--------|-----------|
| OQ#1 Phase numbering | **(a)** 7C takes 015; rename `gsd/015-slice-8-weekly-snapshot` → `gsd/017-slice-8-weekly-snapshot` | slice-8 branch has 1 real commit (`f663e5c`), not dead. Local-only (not pushed); rename is safe. 016 already remotely taken by 7A.5. |
| OQ#2 Auth provider | **Supabase Auth magic links** | Blessed flow; integrates with `tenantFromRequest`; auth.uid() RLS already in place |
| OQ#3 Redemption flow | **(b)** RPC validates only; route hands off to Supabase Auth callback | Narrow SECURITY DEFINER blast radius |
| OQ#4 Token hashing | **(a)** sha256 only | Single-use + expires_at + unique partial index already mitigate replay |
| OQ#5 Smoke token capture | **(a)** Parse `messages_log.body_html` | Prod-prod parity; no test-only code paths |
| OQ#6 Portal styling | **(a)** Kit Screen tokens | Defer custom theme to LATER.md |
| OQ#7 Email verification | **(a)** Trust contact email | Magic link itself proves email control |
| OQ#8 Smoke test agent | **(c)** Julie + Joey | Cross-tenant denial requires 2 agents; Joey doubles as null-tagline regression |
| OQ#9 account_members | **CONFIRM OUT** | Defer multi-user-per-account to later slice |
| OQ#10 Portal route shape | **(b)** Literal `/portal/` segment | Disambiguates from `/agents/[slug]`; cleaner middleware bypass |

---

## Starter drift corrections (folded into pre-flight)

1. **`middleware.ts` path:** lives at `src/middleware.ts`, not repo root. Pre-flight grep paths corrected.
2. **`supabase status -o env --linked` is invalid:** the `--linked` flag does not apply to `status`. Pre-flight psql probes pull DB URL from `~/.config/supabase/<project-ref>.toml` or `vercel env pull` of `SUPABASE_DB_URL` / `POSTGRES_URL`. If unresolved at pre-flight, surface to Alex before Task 1.

---

## Pre-flight Verification Order

Run all eight, halt and report before Task 0 if any fails:

| # | Check | Expected | Action on miss |
|---|-------|----------|----------------|
| a | `git rev-parse main` | `ced5422...` | If main ahead, audit drift before branching |
| a | `git status -s` | clean (or known untracked: AGENTS.md, PROJECT_CONTEXT.md, docs/{architecture,executive,infrastructure}/) | Stop, report |
| b | `psql -c "SELECT count(*) FROM contacts WHERE type='agent' AND deleted_at IS NULL"` | 5 | Stop, report |
| b | `psql -c "SELECT column_name FROM information_schema.columns WHERE table_name='contacts' AND column_name IN ('slug','headshot_url','tagline','account_id')"` | 4 rows | Stop, report |
| c | `grep -n "get_public_agent_by_slug" src/app/agents/[slug]/page.tsx` | ≥1 match (already verified: line 34) | -- |
| d | `grep -n "/agents/" src/middleware.ts` | bypass entry present | Stop, report |
| d | `grep -n "/portal/" src/middleware.ts` | 0 matches | Stop, report |
| e | `ls src/app/portal/` | absent (already verified) | -- |
| f | `psql -c "SELECT to_regclass('public.agent_invites')"` | NULL | Stop, report |
| g | `psql -c "SELECT count(*) FROM auth.users WHERE email IN (SELECT email FROM contacts WHERE type='agent' AND deleted_at IS NULL)"` | 0 | If non-zero, audit and decide whether to merge or reset |
| h | `git branch -a \| grep -i portal` | 0 matches | Stop, report |
| h | `git branch -a \| grep -i 015` | only `gsd/015-slice-8-weekly-snapshot` (per OQ#1) | -- |

---

## Task Order (with gates)

| # | Task | Type | Gate |
|---|------|------|------|
| 0 | Rename `gsd/015-slice-8-weekly-snapshot` → `gsd/017-slice-8-weekly-snapshot`, branch from main | local git | autonomous |
| 1 | Migration: `agent_invites` table + RLS | migration + prod push | **BLOCKING (Rule 5 -- prod write)** |
| 2 | Migration: `redeem_agent_invite` RPC | migration + prod push | **BLOCKING (Rule 5 -- prod write)** |
| 3 | `src/app/portal/layout.tsx` + `[slug]/layout.tsx` + `requirePortalSession` helper | TS code | autonomous |
| 4a-d | Portal pages: dashboard, request, events, messages | TS code (atomic per page) | autonomous |
| 5a | `src/app/api/portal/invite/route.ts` | TS code | autonomous |
| 5b | Migration: portal-invite template seed | migration + prod push | **BLOCKING (Rule 5 -- prod write)** |
| 5c | `src/app/portal/[slug]/login/page.tsx` | TS code | autonomous |
| 5d | `src/app/portal/redeem/route.ts` | TS code | autonomous |
| 6 | `src/middleware.ts` -- portal bypass + auth gate | TS code | autonomous |
| 7 | `scripts/slice7c-portal-smoke.mjs` -- smoke harness | TS/JS | autonomous |
| 8 | Quality gates: typecheck/lint/build/test | bash | autonomous |
| 9 | `~/Desktop/PASTE-INTO-ENV-7c-portal.txt` + `vercel env add` (3 envs) | env writes | **BLOCKING (Rule 5 -- env writes leave local machine)** |
| 10 | Update `BUILD.md`, `BLOCKERS.md`, `SCHEMA.md`, `LATER.md` | docs | autonomous |
| 11 | `git push -u origin gsd/015-slice-7c-portal-routes`, print compare URL | git remote | governed by automation.md Phase Completion Protocol on Alex "ship it" |

---

## Migration Files (3)

| File | Type | Idempotency |
|------|------|-------------|
| `<ts>_slice7c_agent_invites.sql` | table + RLS + indices | CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS pre-CREATE |
| `<ts>_slice7c_redeem_invite_rpc.sql` | RPC SECURITY DEFINER | CREATE OR REPLACE FUNCTION |
| `<ts>_slice7c_portal_invite_template.sql` | data seed | INSERT ... ON CONFLICT (slug) DO NOTHING |

Each paired with a `_rollbacks/<ts>_slice7c_<scope>_rollback.sql` companion (creation only; manually invoked).

---

## New Code Surface

| File | Purpose |
|------|---------|
| `src/lib/auth/requirePortalSession.ts` | Validates Supabase Auth session + slug-binding (auth.users.email == contact.email AND contact.account_id == slug-resolved account_id) |
| `src/app/portal/layout.tsx` | Public portal-scoped layout (no Alex sidebar); Kit Screen tokens; GAT cobrand footer |
| `src/app/portal/[slug]/layout.tsx` | Resolves agent + portal session; redirect to login on no session, 403 on slug/session mismatch |
| `src/app/portal/[slug]/dashboard/page.tsx` | Agent dashboard (touchpoints, messages, upcoming events) |
| `src/app/portal/[slug]/request/page.tsx` | Marketing request form → POST creates `tickets` row |
| `src/app/portal/[slug]/events/page.tsx` | Events list (attendees JOIN events) |
| `src/app/portal/[slug]/messages/page.tsx` | Read-only inbox of `messages_log` entries to agent |
| `src/app/portal/[slug]/login/page.tsx` | "Sending magic link to <email>"; calls invite POST then confirms |
| `src/app/api/portal/invite/route.ts` | POST: account-scoped invite send; generates token + sends email via `sendMessage()` |
| `src/app/portal/redeem/route.ts` | GET handler: calls RPC, hands off to Supabase Auth callback |
| `src/middleware.ts` | Adds `/portal/[slug]/login` + `/portal/redeem` to public bypass; auth-gates everything else under `/portal/[slug]/*` |
| `scripts/slice7c-portal-smoke.mjs` | E2E smoke harness (model after `slice7b-smoke.mjs`) |

---

## Acceptance Gate (deferred to post-execute)

1. `agent_invites` + RLS + `redeem_agent_invite` live on prod.
2. `/portal/` directory shipped with shared layout + 4 pages per slug.
3. Magic-link flow ships end-to-end: send → redeem → Supabase Auth session → portal dashboard.
4. `src/middleware.ts` gates `/portal/*` with auth + slug-account binding.
5. Smoke exits 0; cross-portal denial confirmed (Julie blocked from Joey's portal).
6. 3 env vars set in `.env.local`, Vercel preview, Vercel production.
7. typecheck/lint/build/test all exit 0.
8. Branch pushed; compare URL printed.

---

## Risks (per starter, no additions)

8 risks unchanged from starter. All have stated mitigations. OQ#1 mitigation is now resolved at plan time (rename path).

---

## Hard Rules (enforced)

- Atomic per-task commits; Task 4 sub-commits one per page (4a/4b/4c/4d).
- 3 BLOCKING migrations: Tasks 1, 2, 5b. Each waits for explicit Alex `go` before `supabase db push --linked` (Rule 5).
- Rule 23: NO `~/Desktop/PASTE-INTO-SUPABASE-*.sql`. All SQL via `supabase migration new`.
- Rule 20: env vars via `~/Desktop/PASTE-INTO-ENV-7c-portal.txt`; `open` after write.
- Rule 18: any rendered HTML auto-opens.
- No PR via gh. No `slice-7c-complete` tag.
- No NOTIFY pgrst manual call.
- No em dashes in any output.
- Soft-delete only on smoke cleanup.
- Per `automation.md`: Phase Completion Protocol fires on "ship it" / "next phase" / "ship this phase". Auto-push enabled.

---

## Out of Scope (LATER.md additions)

- account_members table (multi-user-per-account portal access) -- per OQ#9
- Portal mobile-responsive pass
- Portal mutation surface (agent edits own profile; calendar RSVP; email reply)
- Portal-scoped custom theme deviating from Kit Screen -- per OQ#6
- HMAC token hardening -- per OQ#4
- Portal SSO (Google/Microsoft)
- Per-agent custom subdomain
