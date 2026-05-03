# Proposed Patches

Drafted by the 2026-05-01 overnight infrastructure audit. None are auto-applied to the working tree -- each one is staged here for Alex review and post-7A.5 application.

| File | What it lands | Source finding | Land via |
|------|---------------|----------------|----------|
| `01-env-example.diff` | New `.env.example` at repo root | S1, A1 | `cp` to `~/crm/.env.example` |
| `02-env-loader.diff` | New `src/lib/env.ts` zod-validated env loader | S2, P1, A9 | New file; existing 52 sites unchanged |
| `03-route-validation-patterns.md` | Per-route zod adoption sketch (review-only doc, NOT a diff) | P3, A8 | Read; apply per-route |
| `04-cron-idempotency-checklist.md` | Per-cron idempotency contract checklist | R1, A5 | Read; apply per-cron |
| `05-error-boundaries.diff` | New `src/app/error.tsx` + `src/app/global-error.tsx` | R4, A2 | New files; no existing edits |
| `06-route-auth-test.md` | CI test sketch asserting every route has an auth gate (review-only) | S5, A3 | Implement under `src/app/api/__tests__/` |
| `07-error-log-helper.md` | `withErrorLog()` HOF for server actions (review-only) | O2, A13 | Implement under `src/lib/` |
| `08-nvmrc-engines.diff` | New `.nvmrc` + `engines.node` in `package.json` | A10 | New file + 2-line package.json edit |
| `09-ci-workflow.diff` | New `.github/workflows/ci.yml` | A14 | New file |

---

## How to apply each patch

These are NOT git-format diffs -- they're "here is the file content / sketch" because git diff format would lock the file to a specific commit hash and the 7A.5 branch is mid-flight. Each `.diff` is really a "land this file as-is" file. Each `.md` is review-only.

To land any of them, copy the contents to the target path. For sketch `.md` files, use the prose as a starting point.

---

## Why no auto-apply

Per the plan at `~/.claude/plans/cheeky-doodling-hartmanis.md`:

> Default: ALL of these go into `proposed-patches/` and ZERO land in tree autonomously.

Slice 7A.5 reconciliation is mid-flight. Adding even net-additive files to `~/crm/` during that window risks confusing the rebase / squash that lands 7A.5. Alex should review and apply each patch on a separate branch after 7A.5 ships.
