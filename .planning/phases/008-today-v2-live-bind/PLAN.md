# 008 -- today-v2 live-bind (ratification + close-out)

Branch: `gsd/008-today-v2-live-bind` (already checked out, 2 commits ahead of main)
Status when this plan was written: 2026-04-26, ~50KB of untracked today-v2 work in tree, no prior `.planning/phases/008-*` directory.
Predecessor: 007 Slice 3B (`f18acfd`, tag `slice-3b-complete`, PR #6).

This is a RATIFICATION plan. The build work for the today-v2 surface already happened informally (off-protocol) and is sitting untracked in `src/app/(app)/today-v2/`. This plan retroactively scopes that work, resolves one brand decision, runs the acceptance gates, and closes 008. No new feature scope. Mutations + /today cutover are explicitly out of scope; they belong to a future 009 phase.

---

## Inventory of in-flight work (untracked on gsd/008)

| File | Lines | Role |
|------|-------|------|
| `src/app/(app)/today-v2/page.tsx` | 28 | Route entry. Loads Instrument Serif + JetBrains Mono via `next/font/google`. Renders `<TodayV2Client />`. |
| `src/app/(app)/today-v2/today-v2-client.tsx` | 525 | Client UI: StatusBar, CallsLane, Runway, ListingActivity, GCalendar, Moments. |
| `src/app/(app)/today-v2/queries.ts` | 596 | Five live React Query hooks: `useCallsLane`, `useListings`, `useMoments`, `useRunway`, `useStatusBarStats`. Read-only. Realtime on `email_drafts` only. |
| `src/app/(app)/today-v2/fixtures.ts` | 59 | Type contracts (`Call`, `Calls`, `RunwayItem`, `Listing`, `Moment`, `GcalEvent`, `StatusBarStats`). Static data removed; types stay so component props don't drift. |
| `src/app/(app)/today-v2/styles.module.css` | 940 | Local module styles for the v2 layout. |
| `src/app/(app)/today-v2/components/` | 0 | Empty directory. |
| `.playwright-cli/` | -- | Untracked; out of scope. Add to `.gitignore` in Task 0a if not already covered. |
| **Total source** | **2148** | |

Two committed-but-not-pushed commits already on the branch (from STATUS):
- `262fb19 fix(qa): hide soft-deleted opportunities + stub agent_health queries`
- `ed0f785 feat: Morning Relationship Brief Phase 1 (overnight agent)`

Both pre-date the today-v2 work. They ride along on this PR.

---

## Open decisions (require Alex before lock)

### Decision 1 -- Brand font alignment

`page.tsx:5-16` loads **Instrument Serif** (display) + **JetBrains Mono** (body/mono) as scoped CSS variables on the today-v2 subtree.

`~/.claude/rules/brand.md` > Font Stack Per Format > **Dashboard / Portal UI** mandates **Kit Screen** for screen surfaces:
- Display / hero: Syne 700, 800
- Body: Inter 300, 400, 500
- Accent / data: Space Mono 400

today-v2 currently violates that. Three paths:

- **a) Align to Kit Screen.** Swap `next/font/google` imports to Syne + Inter + Space Mono. Rename CSS variables. Audit `styles.module.css` (940 lines) for any hard-coded `--font-instrument-serif` / `--font-jetbrains-mono` references and rebind. Lowest brand-drift risk; aligns with rest of CRM (`/today`, `/morning`, `/drafts` all use Kit Screen via `app/globals.css`).
- **b) Grandfather as v2 prototype.** Document in `BUILD.md` that today-v2 is an editorial-tier exception with its own type system, intentional differentiation from /today. Add a comment block at top of `page.tsx` citing the brand-rule deviation + Alex's approval. No code change.
- **c) Hybrid.** Keep Instrument Serif for the editorial display moments (StatusBar dates, Runway titles), swap JetBrains Mono -> Space Mono (since the role is identical), keep Inter as body. Compromise; needs scoped audit of which class uses which font.

Default if Alex doesn't pick: **a)**. Lowest entropy, fewest follow-up tickets.

### Decision 2 -- CADENCE source of truth

`queries.ts:31` inlines `const CADENCE: Record<Tier, number> = { A: 5, B: 10, C: 14 }` with a comment that the canonical source `src/lib/scoring/temperature.ts` lives only on the deferred `dddc0b0` commit (Morning Brief Phase 1, parked behind `gsd/006-...`, ETA after Slice 4 per LATER.md).

Two paths:
- **a) Accept the duplication.** Log it to LATER.md with a "remove on Slice 4 merge of dddc0b0" follow-up. Inline copy stays for now.
- **b) Cherry-pick `src/lib/scoring/temperature.ts` from `dddc0b0`** onto this branch as part of 008. Risk: pulls in a fragment of the deferred Morning Brief change without the consumer route, may surface other deps.

Default: **a)**. Path b drags in unintended scope.

### Decision 3 -- Empty `components/` directory

`src/app/(app)/today-v2/components/` exists but is empty. Two paths:
- **a) Remove.** `rmdir`, no commit needed (untracked).
- **b) Keep with `.gitkeep`.** Signals intent for future component extraction.

Default: **a)**. Reintroduce when there's actual content.

---

## Tasks

### Task 0 -- Branch hygiene (no commit)

Verify `git status` is exactly the 6 untracked items + 2 ahead-of-main commits noted above. If new files have appeared since this plan was written, surface them and STOP. Add `.playwright-cli/` to `.gitignore` if not already covered (single-line edit, folds into Task 0a).

### Task 0a -- Hygiene commit (gitignore + decision-3 cleanup)

1. If `.playwright-cli/` not in `.gitignore`, add it.
2. Apply Decision 3 (default: `rmdir src/app/(app)/today-v2/components/`).
3. Commit: `chore(008-task-0a): gitignore playwright-cli, drop empty today-v2/components`

### Task 1 -- Apply Decision 1 (brand font alignment)

Branches by Decision 1 outcome:

- **Path a (align):** rewrite `page.tsx` font imports; grep `styles.module.css` for `--font-instrument-serif` and `--font-jetbrains-mono`, rebind to `--font-display` / `--font-mono` / `--font-sans` (the Kit Screen variables already declared in `app/globals.css`); verify nothing else references the v2-scoped variable names. Commit: `refactor(008-task-1): align today-v2 fonts to Kit Screen (Syne + Inter + Space Mono)`.
- **Path b (grandfather):** add comment block to `page.tsx` documenting the brand-rule exception + Alex's approval date; update `BUILD.md` "Built" section. Commit: `docs(008-task-1): grandfather today-v2 fonts as editorial-tier exception`.
- **Path c (hybrid):** scoped audit + targeted swap of mono only. Commit: `refactor(008-task-1): swap today-v2 mono to Space Mono, keep Instrument Serif display`.

### Task 2 -- Apply Decision 2 (CADENCE)

- **Path a (default):** add LATER.md entry: "remove `CADENCE` const inline from `src/app/(app)/today-v2/queries.ts:31`; import from `src/lib/scoring/temperature.ts` once Morning Brief commit `dddc0b0` lands post-Slice 4." No commit (LATER.md update folds into Task 4 docs commit).
- **Path b (cherry-pick):** out of scope for 008. If Alex picks b, STOP and re-plan.

### Task 3 -- Track today-v2 source

`git add src/app/(app)/today-v2/{page.tsx,today-v2-client.tsx,queries.ts,fixtures.ts,styles.module.css}`. Single commit: `feat(008-task-3): add /today-v2 surface with live Supabase read-bind`.

### Task 4 -- Docs

Update `BUILD.md` (move today-v2 surface into "Built" with date + commit hash), `LATER.md` (Decision 2 entry from Task 2 if path a + a "Phase 009 = mutations + /today cutover" line), `BLOCKERS.md` (no new blockers expected; verify nothing new). Commit: `docs(008-task-4): record today-v2 live-bind ship + log Phase 009 backlog`.

### Task 5 -- Quality gates

```bash
cd ~/crm
pnpm typecheck      # exit 0 required
pnpm lint           # exit 0 required, warning count not increased vs main
pnpm build          # exit 0 required
```

All three must pass. If `pnpm lint` introduces new warnings vs main baseline (last verified: zero warnings per STATUS 2026-04-20), surface and STOP.

### Task 6 -- Smoke

Local: `pnpm dev`, navigate to `/today-v2`, eyeball that all five lanes render with live data (CallsLane shows real contacts, Runway shows real items, ListingActivity / Moments / GCalendar / StatusBar all populated or empty-state cleanly). No console errors. Quick interaction sanity (toggling runway done state still works locally even if not persisted -- mutations are 009 scope).

If anything is blank or errors: capture, log to BLOCKERS.md, STOP.

### Task 7 -- Push + PR

```bash
git push -u origin gsd/008-today-v2-live-bind
echo "https://github.com/alexhollien-alt/gat-bos/compare/main...gsd/008-today-v2-live-bind"
```

STOP. Do NOT use `gh` CLI. Do NOT auto-poll PR status. Do NOT create the `008-complete` tag (Alex tags the merge commit on main after manual merge).

### Task 8 -- Post-merge close (after Alex merges + tags)

Update `~/.claude/rules/STATUS.md`: move 008 entry from "Active work" -> add closure note with PR # + merge commit + tag. No branch sweep this time (only branches in flight are gsd/006 which must stay, and gsd/008 itself which Alex deletes after merge per his usual flow).

---

## Atomic commit order

```
0a. chore(008-task-0a): gitignore playwright-cli, drop empty today-v2/components
1.  refactor(008-task-1): align today-v2 fonts to Kit Screen   (Decision 1 path a)
    OR docs(008-task-1): grandfather today-v2 fonts as editorial-tier exception   (path b)
    OR refactor(008-task-1): swap today-v2 mono to Space Mono   (path c)
3.  feat(008-task-3): add /today-v2 surface with live Supabase read-bind
4.  docs(008-task-4): record today-v2 live-bind ship + log Phase 009 backlog
```

4 commits. Tasks 0, 2, 5, 6, 7, 8 produce no commits (verification, LATER append in commit 4, gates, smoke, push, post-merge).

---

## Risk register

| # | Risk | Mitigation |
|---|------|------------|
| 1 | Decision 1 path a triggers visual regression in today-v2 layout (different x-heights, line lengths) | Task 6 smoke must include eyeball pass on all 5 lanes. If regression, fall back to path b (grandfather) without re-planning. |
| 2 | `pnpm lint` introduces new warnings from 596-line queries.ts (react-hooks/exhaustive-deps the usual suspect, see 2026-04-20 cleanup pattern) | Task 5 STOP gate. If hits, apply `useMemo(() => createClient(), [])` + add `supabase` to dep arrays per established pattern (STATUS 2026-04-20 cleanup 9-10). One small commit between 3 + 4. |
| 3 | Realtime topic collision with existing `/today` `email_drafts` subscription | queries.ts already uses unique topic per mount (per file comment "Phase 9 dev fix pattern"). Verify in Task 5. |
| 4 | Cherry-pick path on Decision 2 silently drags in dddc0b0 dependencies | Default is path a (no cherry-pick). If Alex picks b, STOP and re-plan -- do not execute. |
| 5 | The 2 ride-along commits (`262fb19`, `ed0f785`) include scope unrelated to today-v2 (opportunities QA fix + Morning Brief feat) | They predate today-v2 and are already on the branch. PR description must call them out so the merge reviewer (Alex) knows. Task 7 covers this. |
| 6 | Mutations end up needed in 008 scope after smoke (e.g., runway toggles must persist) | Out of scope by design. If smoke surfaces it, log to LATER.md and ship 008 read-only; mutations become 009. |

---

## Acceptance gate

All must be true before calling 008 done:

1. `src/app/(app)/today-v2/components/` does not exist (Decision 3 path a).
2. `.gitignore` covers `.playwright-cli/`.
3. Decision 1 outcome applied per its path (verifiable: page.tsx imports + styles.module.css font-variable refs match the chosen path).
4. `src/app/(app)/today-v2/{page.tsx,today-v2-client.tsx,queries.ts,fixtures.ts,styles.module.css}` all tracked in git.
5. `BUILD.md` "Built" section names today-v2 with the date + commit hash.
6. `LATER.md` carries the CADENCE-consolidation follow-up + the Phase 009 (mutations + cutover) backlog line.
7. `pnpm typecheck` -- exit 0.
8. `pnpm lint` -- exit 0, warning count == main baseline.
9. `pnpm build` -- exit 0.
10. Local `/today-v2` renders all 5 lanes without console errors.
11. Branch pushed to origin; compare URL printed; tool execution stopped.

---

## Rollback plan

- Pre-Task-0a state: 2 commits ahead of main + 6 untracked items. Capture HEAD: `git rev-parse HEAD` before starting (currently `262fb19`).
- If Task 5 gates fail unrecoverably or Task 6 smoke surfaces a blocker: `git reset --hard 262fb19` returns the branch to its pre-008-plan state. Untracked today-v2 files survive `reset --hard` and remain on disk for re-attempt.
- If Task 1 visual regression on path a: `git revert <task-1-commit>` rather than reset; Task 3 commit is independent.
- Branch is local + pushed (after Task 7) but not yet PR-merged, so rollback is safe through Task 7. After merge, normal Slice rollback applies (revert PR commit on main).

---

## Out of scope (explicitly deferred to 009 or later)

- All mutations: runway toggle persistence, listing item check-off persistence, moments snooze, calls lane "mark called" actions.
- Realtime expansion beyond `email_drafts` (projects, touchpoints, activity_events).
- /today -> /today-v2 cutover decision (replace, A/B, sunset old).
- CADENCE de-duplication (waits on dddc0b0 merge post-Slice 4 per Decision 2 path a).
- New mutation API routes under `/api/today-v2/*`.
- Mobile responsive pass on the 3-column layout.

---

## Notes for Alex

- This is a 4-commit, ~30-minute close-out. The bulk of the work shipped already; 008 is mostly hygiene + decision capture.
- The two open decisions (font alignment + CADENCE) need your call before I lock + execute. Defaults are noted (path a for both); say "go with defaults" or specify alternatives.
- After PR merge + your tag on main, I'll close 008 in STATUS.md and we're cleared to plan 009 (mutations + cutover).
