# Security Audit -- GAT-BOS

**Generated:** 2026-05-01
**Branch:** gsd/016-slice-7a5-migration-reconciliation
**Mode:** read-only audit, no schema or RLS edits
**Scope:** secrets posture, client-side leak audit, route-level auth, webhook signing, dependency vulnerabilities, OWASP Top 10 mapping for routes outside the 7A.5 hands-off list

---

## What was audited

- `.env.local` keys vs every `process.env.*` reference in `src/`.
- Every `'use client'` file, scanned for secret-shaped env-var access.
- Auth surface: `src/middleware.ts`, `src/lib/api-auth.ts`, `src/lib/auth/tenantFromRequest.ts` (read-only).
- Webhook signature verification: `src/app/api/webhooks/resend/route.ts`.
- Public-route surface: `/api/intake`, the `/agents/*` and `/intake/*` middleware bypass, the broad `/api/*` middleware bypass.
- npm audit JSON dump (`pnpm audit --json`).
- `pnpm outdated`.
- `tsconfig.json` strictness.
- `.gitignore` coverage.
- Migration / RLS files: NOT touched. Current RLS posture summarized from `audit/2026-04-slice7a-migration-reconciliation/AUDIT-STATUS.md` and `SCHEMA.md` only.

---

## Findings

### S1 -- Undocumented env vars referenced in code, not set in `.env.local` -- HIGH

Five env vars are referenced from runtime code but missing from `.env.local`. Each is a latent prod failure mode: the first request to the dependent route will throw or silently fall back.

| Var | Referenced at | Effect if unset |
|-----|---------------|-----------------|
| `OPENAI_API_KEY` | `src/app/api/transcribe/route.ts:32`, `:71` | Returns 500 on first call; voice capture transcription dead in prod. Note: `transcribe` route uses OpenAI Whisper directly, not the Anthropic stack. |
| `ESCALATION_NOTIFY` | `src/lib/notifications/escalation.ts:17` | Boolean feature flag; falsy by default, so escalation paths silently no-op. Acceptable today, but invisible. |
| `CAPTURES_AI_PARSE` | `src/app/api/captures/route.ts:73` | Falsy default disables AI capture parsing -- correct intent but undocumented as a deploy lever. |
| `ROLLBACK_GMAIL_SYNC`, `ROLLBACK_DRAFT_GEN`, `ROLLBACK_SEND`, `ROLLBACK_CAL_WRITE`, `ROLLBACK_CAL_SYNC` | 8 sites across `api/email/*`, `api/gmail/*`, `api/calendar/*`, `api/auth/gmail/*` | Emergency-rollback flags. Falsy default is correct; the gap is documentation, not behavior. |
| `MARLENE_CC_EMAIL` | (in `.env.local`, OK) | Already set. Listed for completeness. |

**Risk:** Production deploys can ship a regression on a route that depends on `OPENAI_API_KEY` without any boot-time signal. The rollback flags are fine but invisible to a future operator under pressure.

**Fix:** Land `.env.example` at the repo root listing every key referenced by `process.env.*` in `src/`. Drafted in `proposed-patches/01-env-example.diff`.

---

### S2 -- No centralized env validation -- MEDIUM

52 direct `process.env.*` accesses across 29 files, every one using the non-null assertion operator (`!`) or a silent fallback. There is no single env loader, no zod schema, no boot-time check.

Representative offenders:

```
src/middleware.ts:8     process.env.NEXT_PUBLIC_SUPABASE_URL!
src/lib/supabase/admin.ts:6  process.env.NEXT_PUBLIC_SUPABASE_URL!
src/lib/supabase/admin.ts:7  process.env.SUPABASE_SERVICE_ROLE_KEY!
src/app/api/inbox/scan/route.ts:13  process.env.NEXT_PUBLIC_SUPABASE_URL!
src/app/api/webhooks/resend/route.ts:21  process.env.NEXT_PUBLIC_SUPABASE_URL!
src/lib/api-auth.ts:19  const TOKEN = process.env.INTERNAL_API_TOKEN
src/lib/api-auth.ts:52  const secret = process.env.CRON_SECRET
src/lib/crypto/vault.ts:11  const hex = process.env.OAUTH_ENCRYPTION_KEY
```

**Risk:** A missing var produces a runtime `TypeError: Cannot read properties of undefined` at first usage rather than a clean boot failure. In serverless this means each cold start can produce a fresh, nondeterministic failure surface.

**Fix:** Land `src/lib/env.ts` zod-validated env loader; routes still read process.env directly today, but new routes should funnel through it. Drafted in `proposed-patches/02-env-loader.diff`. Refactoring existing 52 sites is OUT OF SCOPE for the 7A.5 window. Migration plan: convert one route per slice from `process.env.X!` to `env.X` going forward.

---

### S3 -- Client-side secret leak audit: CLEAN -- INFO

Grep across every `'use client'` file in `src/` for any `process.env` access whose name contains `SECRET`, `SERVICE_ROLE`, `ADMIN`, or `PRIVATE`: zero hits.

The Supabase anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) is correctly `NEXT_PUBLIC_*` prefixed and is the only env var the client should see. No service-role key, no `ANTHROPIC_API_KEY`, no `RESEND_API_KEY`, no `OAUTH_ENCRYPTION_KEY`, no `CRON_SECRET`, no `INTERNAL_API_TOKEN` in any client component.

`.gitignore` excludes `.env*.local`. `.env.example` is absent (see S1).

---

### S4 -- Resend webhook signature verification: STRONG -- INFO

`src/app/api/webhooks/resend/route.ts:59-111` implements a textbook Svix HMAC-SHA256 verifier:

- Reads `svix-id`, `svix-timestamp`, `svix-signature` headers; rejects on missing.
- 5-minute replay-protection window (`TOLERANCE_MS = 5 * 60 * 1000`).
- HMAC over `${svix-id}.${svix-timestamp}.${rawBody}`.
- Iterates space-separated `v1,<base64>` signature candidates.
- `timingSafeEqual()` for the constant-time compare.
- 401 on any failure path; rate-limit intentionally omitted (signature IS the gate, comment at lines 7-16 explains this).

This is one of the cleanest webhook implementations in the repo. Do not change.

---

### S5 -- Auth model: middleware bypass + per-route enforcement -- HIGH (architectural; not a regression)

`src/middleware.ts:36-44` bypasses ALL of `/api/*`, `/intake/*`, and `/agents/*`. The middleware does not enforce auth on any API route. Every API route MUST enforce its own auth via:

- `requireApiToken()` for internal/skill callers (Bearer `INTERNAL_API_TOKEN`, timing-safe).
- `verifyCronSecret()` for Vercel cron (Bearer `CRON_SECRET`, timing-safe).
- `verifySession()` for user-facing API.
- `verifyBearerOrSession()` for dual-auth.
- Resend webhook: Svix HMAC.
- `/api/intake`: PUBLIC by design, gated by `checkRateLimit()` + honeypot.

**Risk:** If a future route forgets to call one of these, it ships as an unauthenticated public endpoint. The pattern relies on author discipline. There is no decorator, no middleware-level check, no test that asserts "every route handler under /api/* (except the explicit public list) calls one of {requireApiToken, verifyCronSecret, verifySession, verifyBearerOrSession, Svix-verify}".

**Audit per-route status (sampled, not exhaustive):**

| Route | Gate | Verified |
|-------|------|----------|
| `/api/intake` | rate-limit + honeypot (intentional public) | yes |
| `/api/webhooks/resend` | Svix HMAC | yes |
| `/api/cron/campaign-runner` | `verifyCronSecret` | yes |
| `/api/auth/gmail/{authorize,callback}` | OAuth flow + ROLLBACK flag | yes |
| `/api/email/approve-and-send` | needs separate read; references `CRON_SECRET` at L76 indicating dual-auth | likely OK |
| `/api/captures/*`, `/api/contacts/*`, `/api/projects/*`, `/api/events/*`, `/api/morning/latest` | NOT inspected this pass | UNKNOWN |

**Fix (deferred):** Add a CI test that loads every route handler in `src/app/api/**/route.ts` (excluding the public list) and asserts the export contains a recognized auth call. Drafted in `proposed-patches/06-route-auth-test.md` as a sketch (not executable; needs the file/AST work post-7A.5).

---

### S6 -- npm audit: 3 high, 14 moderate, 0 critical -- HIGH

`pnpm audit --json` (full output at `/tmp/audit-2026-05-01/pnpm-audit.json`):

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 3 |
| Moderate | 14 |
| Low | 0 |

**Top 3 high-severity advisories:**

1. **CVE-2025-64756 (GHSA-5j98-mcp5-4vw2) -- glob CLI command injection.** Path: `eslint-config-next > @next/eslint-plugin-next > glob@10.3.10`. Patched in `glob@10.5.0+`. **Impact in this repo:** dev-only transitive dep; no runtime exposure. Still triggers CI gates on most scanners.
2. **next 14.2.x advisory chain (CVE-2024-50383, CVE-2025-24761).** Patched in 15.0.8+ / 15.5.15+. We are on `next@14.2.35`, two majors behind latest (16.2.4).
3. **Multiple moderate Next.js advisories (4)** -- folded into the same Next.js upgrade path.

**Fix:** Schedule a Next.js upgrade window post-7A.5. Bumping next 14.2.35 -> 16.x is non-trivial (App Router changes between 14 and 16, server-component caching semantics, middleware runtime changes). NOT an overnight task. The 14.2 advisories are real but mostly low-impact in our threat model:

- `next` SSRF/redirect advisories matter when an open redirect is exposed; we do not have one in the auth/login surface (only `/login`, `/dashboard`, `/intake/{slug}` -- all internally-controlled).
- The image-optimization advisory matters when user-controlled image URLs flow through `next/image`; the audit-time grep shows `next/image` use is bounded to logo and headshot URLs.

**Action:** Critical-priority Next.js upgrade plan needed in BLOCKERS.md. Listed in `PRIORITY_ACTION_PLAN.md` under Critical.

---

### S7 -- Stale dependency posture -- MEDIUM

From `pnpm outdated`:

| Package | Current | Latest | Notes |
|---------|---------|--------|-------|
| next | 14.2.35 | 16.2.4 | 2 majors behind; security implications above |
| react / react-dom | 18.3.1 | 19.2.5 | 1 major behind; required for next 16 |
| eslint | 8.57.1 | 10.2.1 | 2 majors behind |
| eslint-config-next | 14.2.35 | 16.2.4 | Tracks next |
| typescript | 5.9.3 | 6.0.3 | 1 major behind |
| tailwindcss | 3.4.19 | 4.2.4 | Tailwind v3 deliberate per CLAUDE.md "Tailwind v3"; do NOT bump |
| @types/node | 20.19.39 | 25.6.0 | dev-only, low risk |
| @anthropic-ai/sdk | 0.85.0 | 0.92.0 | minor; safe-bump candidate |
| @supabase/supabase-js | 2.101.1 | 2.105.1 | minor; safe-bump candidate |
| resend | 6.10.0 | 6.12.2 | minor; safe-bump candidate |
| zod | 4.3.6 | 4.4.1 | minor; safe-bump candidate |
| @tanstack/react-query | 5.96.2 | 5.100.6 | minor; safe-bump candidate |

**Fix:** Defer all to a single dependency-bump session post-7A.5. Tailwind stays on v3 by repo convention.

---

### S8 -- TypeScript strict posture -- LOW

`tsconfig.json` has `"strict": true` (good). Missing options that would harden further:

- `noUncheckedIndexedAccess` -- catches `array[i]` returning `T | undefined`.
- `exactOptionalPropertyTypes` -- catches `{ x?: T }` vs `{ x: T | undefined }` divergence.
- `noImplicitOverride`, `useUnknownInCatchVariables` (latter is now default in 5.x).

`as any` count in `src/`: **0**. `@ts-ignore` count: **0**. `@ts-expect-error` count: **0**. (The earlier recon-agent count of 18 looked at a wider surface or included `node_modules`; the actual `src/` tree is clean.)

**Fix:** Add `noUncheckedIndexedAccess: true` post-7A.5. Will surface a meaningful number of new type errors that need triage. Not safe for an overnight autonomous fix; flagged for Alex.

---

### S9 -- OAuth token storage and crypto vault -- LOW (read-only summary)

`src/lib/crypto/vault.ts` reads `OAUTH_ENCRYPTION_KEY` (env-set). Used by Gmail OAuth token storage in `src/app/api/auth/gmail/*`. Not audited deeply this pass per hands-off list. Existing `audit/2026-04-slice7a-migration-reconciliation/AUDIT-STATUS.md` notes the 7A migration applied a `user_id uuid FK` type-fix to `oauth_tokens`.

**Risk:** None observed. The hands-off list precludes reading the OAuth callback route deeply; that should ride a future audit pass.

---

### S10 -- RLS coverage (read-only inventory) -- INFO

Per `SCHEMA.md` and the staged 7A reconciliation:

- 21 RLS rewrite migrations under `slice7a_*_rls.sql` flipped policies from `(auth.jwt() ->> 'email') = 'alex@...'` to `user_id = auth.uid()` (column-based).
- 4 prod-mirror RLS migrations under `slice7a_*_from_prod_mirror.sql`.
- `accounts` table seeded with single Alex row; tenant context resolved via `tenantFromRequest`.
- `rate_limits` table is service-role only (RLS denies anon/authenticated).
- `error_logs` (used by `error-log.ts`) -- write path through service-role admin client; read path NOT audited.

**Risk:** RLS is in flight (Slice 7A.5). Audit-only finding; do not propose changes here.

---

### S11 -- CSRF / CORS posture -- MEDIUM

- Next.js App Router does not auto-generate CSRF tokens. Form posts to `/api/*` from same-origin pages rely on session-cookie + same-origin policy.
- No explicit CORS middleware; `/api/*` does not set `Access-Control-Allow-Origin`. Default behavior: same-origin only. Cross-origin requests would fail at the browser layer for cookied endpoints.
- `/api/intake` is intentionally cross-origin-friendly (it is shared as a link to partners), but the public surface exists already and is rate-limited + honeypot-gated.
- `/api/webhooks/resend` is signature-gated, so origin doesn't matter.
- `/api/cron/*` is bearer-secret-gated, so origin doesn't matter.

**Risk:** Internal API routes that mutate user state via session cookies are CSRF-vulnerable in principle if an attacker can get a victim to submit a same-site form. The Resend cookie hardening of `SameSite=Lax` (default in Supabase SSR) mitigates the cross-site CSRF vector for state-changing requests, but a `SameSite=None` regression in cookie config would break that mitigation silently.

**Fix:** Add a CI assertion that the Supabase SSR cookie config uses `SameSite=Lax` or `Strict`. Sketched in `proposed-patches/06-route-auth-test.md`.

---

### S12 -- OWASP Top 10 mapping (routes outside 7A.5 hands-off list)

| OWASP | Status in this codebase | Evidence |
|-------|-------------------------|----------|
| A01 Broken Access Control | RLS in flight; per-route enforcement is convention, not gate (S5) | tenantFromRequest + 21 RLS rewrites |
| A02 Cryptographic Failures | OAuth tokens encrypted via vault; webhook HMAC strong; timing-safe compares everywhere | api-auth.ts, vault.ts, webhooks/resend |
| A03 Injection | zod on 5 boundaries; intake fully validated; service-role admin client used for writes (no string concat into SQL) | validations.ts, intake/process.ts |
| A04 Insecure Design | rate limiter fail-open is intentional and documented; AI budget guard is well-designed | rate-limit/check.ts, ai/_budget.ts |
| A05 Security Misconfiguration | undocumented env vars (S1); no centralized env loader (S2) | S1, S2 |
| A06 Vulnerable Components | 3 high, 14 moderate; Next.js 2 majors behind | S6 |
| A07 Auth Failures | Supabase Auth; OAuth + bearer tokens timing-safe; no observed weakness | api-auth.ts |
| A08 Data Integrity | activity_events as canonical audit trail (Slice 1+); writeEvent.ts hard-break enforces userId | activity/writeEvent.ts |
| A09 Logging Failures | error_logs table OK; no central observability stack (see observability-gaps.md) | error-log.ts |
| A10 SSRF | image-optimization advisory in next 14 (S6) | next 14.2.35 |

---

## Severity rollup

| Severity | Findings |
|----------|----------|
| Critical | none |
| High | S1 (undocumented envs), S5 (auth-model relies on author discipline), S6 (3 high CVEs in deps) |
| Medium | S2 (no env validator), S7 (stale deps), S11 (CSRF posture relies on cookie default) |
| Low | S8 (tsconfig hardenings), S9 (OAuth vault not deep-audited) |
| Info | S3 (client-secret clean), S4 (Resend webhook strong), S10 (RLS in flight), S12 (OWASP) |

---

## Out of scope (deferred to post-7A.5)

- Deep RLS policy audit per table.
- OAuth token-vault crypto review.
- Full per-route auth-call assertion.
- Next.js major upgrade.
- Refactor 52 `process.env.*!` sites to use `env.ts`.

---

## Remaining placeholders

- None.
