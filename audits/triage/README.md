# Audit Auto-Triage

Self-healing layer over `pnpm gat-audit`. Reads the latest JSON report, dispatches one Claude sub-agent per RED in an isolated git worktree, verifies the fix by re-running the matching check, opens a PR on success or writes a `TRIAGE-<id>.md` on failure.

## Usage

```bash
# Dry run against the latest report (no worktrees, no claude spawns, no PRs)
pnpm gat-audit:triage -- --dry-run

# Live run (default: --draft PRs, concurrency=4)
pnpm gat-audit:triage

# Live run, non-draft PRs (after the workflow proves reliable)
pnpm gat-audit:triage -- --no-draft

# Override report path
pnpm gat-audit:triage -- --report=audits/reports/audit-2026-05-08.json

# Lower concurrency for noisy local environment
pnpm gat-audit:triage -- --concurrency=2
```

## What it does

1. Finds latest `audits/reports/audit-*.json`.
2. Filters to checks where `severity === "red"` and `pass === false`.
3. Builds a `FailureCard` per RED: id, layer, smell, payload, extracted file paths, recent commits touching those paths, runner source path, exact rerun command.
4. Refuses if total REDs > 10 (audit is on fire; fix manually).
5. Captures `origin/main` SHA; creates `git worktree` per RED at `../triage-<short-sha>-<safe-id>` on branch `auto-triage/<safe-id>-<short-sha>`.
6. For each worktree, spawns `claude -p` headless with:
   - The system prompt at `audits/triage/prompts/subagent.md`.
   - The `FailureCard` JSON.
   - Allowed tools: Read, Edit, Write, Grep, Glob, Bash(git diff/log/status, grep, rg, find, pnpm exec tsx, pnpm gat-audit, node).
   - Disallowed tools: Bash(git push, git commit, gh, vercel, supabase, rm).
   - `--permission-mode acceptEdits`.
   - 10-minute wall-clock cap.
7. Sub-agent must reproduce, plan, fix, re-run the per-check verifier, and exit with a code: `0` (green), `2` (incomplete), `3` (stale), `4` (structural), other (crash).
8. On exit code 0, orchestrator re-runs the verifier itself, commits, pushes, opens PR (draft by default).
9. On any other code, orchestrator writes `TRIAGE-<id>.md` and pushes the branch without opening a PR.
10. Streak tracker at `audits/triage/state/streaks.json`: after 3 consecutive failures, the RED is skipped until manually cleared.

## Files

```
audits/triage/
├── README.md
├── run-triage.ts                 # orchestrator
├── prompts/
│   └── subagent.md               # system prompt for sub-agents
├── lib/
│   ├── parse-reds.ts             # JSON report → FailureCard[]
│   ├── single-check.ts           # run ONE check by id (CLI + module)
│   ├── worktree.ts               # git worktree add/remove/push
│   ├── spawn-subagent.ts         # `claude -p` invoker
│   ├── open-pr.ts                # `gh pr create` + commit helper
│   ├── triage-md.ts              # write TRIAGE-<id>.md on failure
│   └── streaks.ts                # 3-strike skip tracker
├── state/
│   └── streaks.json              # persistent streak state (gitignored)
└── runs/
    └── <iso-timestamp>.json      # per-run outcome log
```

## Safety + standing rules

- **Rule 3 (no hard deletes):** branches are deleted only by `gh pr merge --delete-branch` after merge.
- **Rule 5 (consequence-based approval):** the sub-agent CANNOT push or call gh. The orchestrator owns those production writes; opening PRs in `--draft` mode is the default until the workflow proves reliable.
- **Rule 16 (verify external audits):** the orchestrator re-runs the check itself after the sub-agent claims green. Trust but verify.
- **Rule 23 (Supabase CLI exclusive):** sub-agents are denied any `mcp__supabase__*` tool and `supabase` bash invocations.
- **CLI iteration autonomy:** triage runs autonomously with explicit halt conditions (REDs > 10, streak >= 3, base SHA drift mid-run, sub-agent crash).

## Single-check CLI

`single-check.ts` is also a standalone CLI:

```bash
pnpm exec tsx audits/triage/lib/single-check.ts brand.dashes-in-recent-output
# Prints CheckRecord JSON. Exit 0 iff pass+green.
```

Used by the orchestrator AND by sub-agents to verify their fix.
