# Phase 022 -- Slice 8 Phase 5.5: altos-pull upsert fix (ON CONFLICT vs partial unique index)

**Generated:** 2026-05-03
**Base:** main @ commit `0308fe8` (post-Phase-5 + BLOCKERS entry)
**Branch:** `gsd/022-slice-8-phase-5-5-altos-pull-upsert-fix`
**Parent plan:** `~/crm/.planning/phases/021-slice-8-phase-5-cron-registration-dry-run/PLAN.md`
**Classification:** PLUMBING. Single-route code change, no schema migration, no UI surface.
**Pre-authorization:** Alex explicit "Lock it" -- 2026-05-03. Clears Standing Rule 5 BLOCKING gates for: PR open + merge, prod deploy, resumption of Phase 5 dry-run gates 11-18 against the same prod deploy.

---

## Why

`/api/cron/altos-pull` returns HTTP 200 with body `{"ok":false,"upserted":0,"failed":1, ... "error":"there is no unique or exclusion constraint matching the ON CONFLICT specification"}`. The `weekly_snapshot` migration created a **partial** unique index (`weekly_snapshot_week_market_uniq ... WHERE deleted_at IS NULL`) preserving soft-delete-then-repull semantics per Standing Rule 3. Postgres `ON CONFLICT (week_of, market_slug)` cannot infer a partial index without a matching `WHERE` clause, and `supabase-js` `upsert({ onConflict: "week_of,market_slug" })` does not pass one.

Surfaced during Slice 8 Phase 5 dry-run gate 11 on 2026-05-03 against prod commit `d374936`. Logged to `BLOCKERS.md` `[2026-05-03] weekly_snapshot upsert fails`. Phase 5 dry-run is paused at gate 11 awaiting this fix.

## Fix choice

BLOCKERS.md offers (a) drop the partial predicate via new constraint, (b) explicit SELECT-then-INSERT-or-UPDATE, (c) drop the partial predicate from the index. Recommendation locked to **(b)** -- preserves both upsert idempotency and the soft-delete-and-repull semantic the partial index was protecting. No schema mutation, lowest blast radius, fully reversible.

---

## Task Order (with gates)

| # | Task | Type | Gate |
|---|------|------|------|
| 1 | `git checkout -b gsd/022-slice-8-phase-5-5-altos-pull-upsert-fix` | git | branch created |
| 2 | Refactor `pullOne()` in `src/app/api/cron/altos-pull/route.ts`: replace the `.upsert(... { onConflict })` block with: (i) SELECT id from `weekly_snapshot` where `week_of = $1 AND market_slug = $2 AND deleted_at IS NULL` (`maybeSingle()`); (ii) if row exists, UPDATE `data`, `market_label`, `pulled_at` filtered by id; (iii) else INSERT new row. Both branches return `{ id }` so the `data.id` consumer below the block keeps working unchanged. | code | typecheck PASS |
| 3 | `cd ~/crm && pnpm typecheck && pnpm build` | gate | both PASS |
| 4 | `git add -A && git commit` (per Phase Completion Protocol in `~/.claude/rules/automation.md`) | git | clean |
| 5 | `git push -u origin HEAD && gh pr create --fill` | git | PR opens, Vercel preview build SUCCESS |
| 6 | `CLAUDE_AUTOMATION_PR_MERGE=<#> gh pr merge <#> --squash --delete-branch` | git | merge SUCCESS, branch removed remote |
| 7 | `git checkout main && git pull` | git | local main fast-forwarded |
| 8 | Wait for prod deploy READY (`vercel ls --scope=alex-8417s-projects` polled) | gate | deploy READY on main HEAD |
| 9 | Hand back to Phase 021 PLAN.md, gate 11 onward (`curl altos-pull` against prod with Bearer CRON_SECRET) | gate | 200; `weekly_snapshot` row inserted for current ISO Monday with `data_status` reflecting Altos placeholder |

Phase 5.5 closes when gate 8 SUCCEEDS. Gate 9 is the handoff into Phase 5 resumption, not part of this phase's closure verification.

---

## Halt Conditions

- **Halt 1:** typecheck/build fails -- stop, fix at source.
- **Halt 2:** PR Vercel preview FAILED -- stop, read deploy logs, do not retry.
- **Halt 3:** prod deploy fails post-merge -- `vercel rollback`, document in BLOCKERS.md.
- **Halt 4:** altos-pull (gate 9) still returns `failed > 0` -- this is the handoff gate; surface the new error to Alex without auto-retry. Possible causes: race-condition between SELECT and INSERT on first-ever pull (acceptable, single-instance cron); `data` JSONB shape mismatch; RLS denial on service role (should not happen).

---

## Rollback

If Phase 5.5 ships but breaks something downstream:
1. `git revert <merge-sha>` on main, push.
2. Vercel auto-rolls forward to the revert commit.
3. Original BLOCKERS entry restored, Phase 5 resumption re-paused.

No DB state change, no migration to reverse.

---

## Files Touched

**Modified:**
- `src/app/api/cron/altos-pull/route.ts` -- refactor `pullOne()` only. `handleRun()` and `GET`/`POST` unchanged.
- `BLOCKERS.md` -- move 2026-05-03 weekly_snapshot entry from Open → Resolved on closure.

**Untouched:**
- `supabase/migrations/20260503020437_slice8_weekly_snapshot.sql` -- partial unique index preserved by design.
- All other Phase 1-5 code.
- `vercel.json` -- crons already registered in Phase 5.

---

## Verification at Phase Closure

1. `pnpm typecheck` PASS, `pnpm build` PASS.
2. PR squash-merged on main.
3. Prod deploy on new main HEAD = READY.
4. `BLOCKERS.md` weekly_snapshot entry moved to `## Resolved` with merge commit SHA.
5. Phase 021 PLAN.md gate 11 ready to be re-attempted in the same session.
