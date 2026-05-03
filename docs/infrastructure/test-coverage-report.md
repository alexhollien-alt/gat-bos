# Test Coverage Report -- GAT-BOS

**Generated:** 2026-05-01
**Branch:** gsd/016-slice-7a5-migration-reconciliation

---

## What was audited

- `pnpm test --coverage` (vitest v4.1.5 + @vitest/coverage-v8).
- `vitest.config.ts` test glob.
- 5 test files in `src/`.
- Coverage by `src/lib/**/*.ts` per `vitest.config.ts`.

---

## Headline numbers

```
Test Files:  5 passed (5)
Tests:       101 passed (101)
Duration:    503ms

Coverage (lib/**):
  Statements:  9.26%  (151 / 1629)
  Branches:    9.9%   (115 / 1161)
  Functions:   13.28% (36 / 271)
  Lines:       9.53%  (140 / 1469)
```

All 101 tests pass. Coverage is critically low on production-code surface area.

---

## Module-by-module coverage

| Module | Lines | Branches | Functions | Notes |
|--------|-------|----------|-----------|-------|
| `lib/rate-limit/check.ts` | **94.73%** | 100% | 66.66% | Best-tested module; intake throttle behavior locked in |
| `lib/rate-limit/extract-ip.ts` | 100% | 75% | 100% | -- |
| `lib/touchpoints/weeklyWhere.ts` | **94.59%** | 73.33% | 100% | Slice 5B addition; well-covered at landing |
| `lib/messaging/draftActions.ts` | **100%** | 92.3% | 100% | Slice 4 messaging abstraction; fully covered |
| `lib/auth/tenantFromRequest.ts` | 65.78% | 61.29% | 66.66% | 7A core; partially covered, partial-coverage is acceptable for a tenant resolver with branching contexts |
| `lib/intake/process.ts` | 41.5% | 62.82% | 75% | Critical write path; gaps at L191-332 (orchestration tail) |
| `lib/messaging` | 35.36% (avg) | 40.67% | 60.86% | `render.ts`, `send.ts`, `adapters/{gmail,resend}.ts` all 0%; messaging entry point partial |
| `lib/hooks/handlers` | 7.61% | 0% | 0% | Slice 5B post-creation hooks; thin coverage |
| `lib/campaigns/actions.ts` | 3.57% | 0% | 0% | Server actions; barely touched |
| `lib/ai/*` (8 files) | **0%** | 0% | 0% | _budget, _cache, _client, _pricing, capture-parse, draft-revise, inbox-score, morning-brief |
| `lib/captures/*` | **0%** | 0% | 0% | actions.ts (526 lines), rules.ts (135 lines) |
| `lib/activity/*` | **0%** | 0% | 0% | writeEvent.ts (37 lines), queries.ts (40 lines) -- audit primitives, untested |
| `lib/calendar/client.ts` | **0%** | 0% | 0% | 141 lines of GCal client |
| `lib/gmail/{filter,oauth,sync-client}.ts` | **0%** | 0% | 0% | 437 total lines |
| `lib/events/event-templates.ts` | **0%** | 0% | 0% | 695 lines |
| `lib/scoring/temperature.ts` | **0%** | 0% | 0% | 124 lines |
| `lib/observation/readout.ts` | **0%** | 0% | 0% | -- |
| `lib/notifications/escalation.ts` | **0%** | 0% | 0% | -- |
| `lib/crypto/vault.ts` | **0%** | 0% | 0% | OAuth token encryption -- security-critical |
| `lib/resend/client.ts` | **0%** | 0% | 0% | -- |
| `lib/supabase/{client,server,admin}.ts` | 12.5% | 100% | 0% | Trivial wrappers; not load-bearing test gap |
| `lib/error-log.ts` | **0%** | 0% | 0% | 16-line file; trivially small but used everywhere |
| `lib/retry.ts` | **0%** | 0% | 0% | 24 lines; not inspected this pass; needs a read to confirm purpose |
| `lib/api-auth.ts` | **0%** | 0% | 0% | Auth helpers; security-critical, untested |
| `lib/types.ts`, `utils.ts`, `validations.ts`, `constants.ts` | 0% (lines) | 100% (branches) | varies | Type-shape modules -- branches are 100% because there's nothing branching |

API routes (`src/app/api/**`) and components (`src/components/**`) are NOT measured by the coverage profile -- `vitest.config.ts` scopes coverage to `src/lib/**/*.ts`. Routes are integration-tested only via `scripts/phase-*-smoke*.mjs` (which were NOT run in this audit per hands-off list).

---

## What's tested

5 files, 101 tests:

```
src/lib/auth/__tests__/tenantFromRequest.test.ts                 (Slice 7A acceptance tests)
src/lib/rate-limit/__tests__/check.test.ts                       (rate limiter)
src/lib/touchpoints/__tests__/weeklyWhere.test.ts                (Slice 5B helper)
src/lib/intake/__tests__/process.test.ts                         (intake orchestration)
src/lib/messaging/__tests__/draftActions.test.ts                 (Slice 4 messaging)
```

Every test file is a Slice landing artifact; none are pre-existing infrastructure tests.

---

## Critical untested paths

Ranked by blast radius if they break:

1. **`lib/captures/actions.ts` (0%, 526 lines)** -- promotion pipeline (captures -> tasks/follow_ups/tickets). HANDS-OFF; cannot land tests during 7A.5.
2. **`lib/activity/writeEvent.ts` (0%)** -- canonical audit-trail writer. HANDS-OFF.
3. **`lib/ai/_budget.ts` (0%)** -- daily AI spend cap. Failure mode: budget guard silently fails -> overspend or false-block.
4. **`lib/ai/{capture-parse,draft-revise,inbox-score,morning-brief}.ts` (0% each)** -- four AI pipelines. Failure mode: silent regression on prompt/format changes.
5. **`lib/crypto/vault.ts` (0%)** -- OAuth token encryption. Security-critical.
6. **`lib/api-auth.ts` (0%)** -- Bearer/session auth helpers. Security-critical. Coverage blocker: needs mock Supabase session, mock crypto.timingSafeEqual.
7. **`lib/error-log.ts` (0%)** -- fire-and-forget error writer. Low-risk; trivial code.
8. **`lib/retry.ts` (0%)** -- unknown contract; needs a read.
9. **`lib/calendar/client.ts` (0%, 141 lines)** -- GCal API client.
10. **`lib/gmail/{oauth,sync-client}.ts` (0%, 384 lines combined)** -- Gmail OAuth + sync.

API routes (no coverage): every `/api/*` handler. The most critical untested route bodies (per blast radius) are:

- `/api/webhooks/resend` -- Svix verification + side effects.
- `/api/cron/campaign-runner` -- multi-write tick body.
- `/api/cron/morning-brief` -- daily email send.
- `/api/intake` -- public POST.
- `/api/transcribe` -- voice capture.

---

## Recommended test additions (post-7A.5, ranked)

| Rank | Target | Why | Effort |
|------|--------|-----|--------|
| 1 | `lib/api-auth.ts` | Security-critical, easy to mock | 30 min |
| 2 | `lib/error-log.ts` | Tiny; tests doc the fire-and-forget contract | 15 min |
| 3 | `lib/ai/_budget.ts` | Soft/hard cap behavior; mock RPC | 1 hr |
| 4 | `lib/crypto/vault.ts` | Security-critical | 1 hr |
| 5 | `/api/webhooks/resend` integration test | Svix HMAC + replay window | 2 hr |
| 6 | `/api/cron/campaign-runner` integration test | Failure-mode permutations | 3 hr |
| 7 | `lib/messaging/{send.ts,render.ts}` | Slice 4 lifeblood | 2 hr |
| 8 | `lib/gmail/oauth.ts` | OAuth token refresh path | 2 hr |

Items 1-4 are unit tests; 5-8 are integration with a Supabase test branch.

---

## Coverage thresholds (proposal -- do NOT enforce in CI yet)

A first-pass threshold to ratchet against, post-7A.5:

```yaml
# vitest.config.ts coverage.thresholds (proposed)
statements:  20%   # current 9.26
branches:    20%   # current 9.9
functions:   25%   # current 13.28
lines:       20%   # current 9.53
```

Walking these to 50% over the next 4-5 slices is realistic. Walking past 70% requires substantial refactoring of AI/messaging modules to be unit-testable (currently they are tightly coupled to the network).

NOT autonomously applied; this is a proposal only.

---

## Severity rollup

| Severity | Findings |
|----------|----------|
| Critical | none |
| High | 0% coverage on `lib/api-auth.ts`, `lib/crypto/vault.ts`, `lib/ai/_budget.ts` |
| Medium | 0% coverage on cron + webhook route bodies |
| Low | 0% on shape-only modules (validations.ts, types.ts) |
| Info | 5 well-tested modules at landing (Slice 4 / 5B / 7A pattern is correct) |

---

## Out of scope

- Adding any tests during this audit window.
- Running `scripts/phase-*-smoke*.mjs` (could hit live infra).
- Mutation testing (Stryker etc.).
- Coverage thresholds enforcement.

---

## Remaining placeholders

- None.
