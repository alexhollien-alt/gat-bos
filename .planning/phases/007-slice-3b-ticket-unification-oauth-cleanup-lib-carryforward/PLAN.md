# Slice 3B Plan: Ticket Unification + OAuth Cleanup + Lib Carryforwards

**Phase:** 007
**Branch:** `gsd/007-slice-3b-ticket-unification-oauth-cleanup-lib-carryforward`
**Status:** Awaiting "lock it"
**Generated:** 2026-04-26
**Source starter:** `/Users/alex/Desktop/slice-starters/slice-3b-starter.md`

---

## Context

Slice 3A shipped 2026-04-26 (PR #5, merge `ac716a7`, tag `slice-3a-complete`). Slice 3A standardized 8 `src/lib/<entity>/` directories to the `actions.ts` / `queries.ts` / `types.ts` shape but explicitly deferred four file-org carryforwards to avoid touching function bodies on the structural pass. Those four are logged as Open BLOCKERS dated 2026-04-24 and are the primary scope of Task 6 here.

Alongside the carryforwards, Slice 3B unifies the dual ticket surface (`/materials` list view + `/tickets` kanban view, both reading the same `material_requests` table) into a single `/tickets` route backed by a renamed `tickets` table, and cleans up two pieces of OAuth env-var debt. After 3B, the database, the URL surface, and the lib shape all agree that "ticket" is the canonical word.

---

## Pre-flight findings (Session Protocol step 3 results)

| Pre-cond | Status | Notes |
|---|---|---|
| 3.a -- Tags | PASS | `slice-1-complete`, `slice-2a-complete`, `slice-2b-complete`, `slice-2c-3-complete`, `slice-3a-complete` all present |
| 3.b -- Tag at origin/main | PASS | `slice-3a-complete` points at `ac716a7` |
| 3.c -- Working tree | NOISE | Acceptable noise per starter (`.claude/worktrees/`, `.playwright-mcp/`); plus three items that go into Task 0a (`.planning/phases/004-*/`, `scripts/check-error-log.mjs`, `scripts/probe-rate-limit-rpc.mjs`) |
| 3.d -- Ticket-table state | **BRANCH 3** | All three of `tickets` (NO -- not present), `material_requests` (live, 23 rows), `material_request_items` (live, 23 rows), AND `requests` (live, **0 rows**, FK to `listings`, orphan) are visible. See "DB state" section below for the 3-table disposition. |
| 3.e -- Routes exist | PASS | `/materials/page.tsx` (4615 B, list view); `/tickets/page.tsx` (14536 B, kanban) + `/tickets/[id]/page.tsx` (16580 B) + `/tickets/[id]/actions.ts` (2555 B) |
| 3.f -- Carryforward sources | PASS (with a count correction) | `parse.ts`, `promote.ts`, `auto-enroll.ts` all present. `invite-templates/` has **8 files** (not 10 as starter states): `class-day.ts`, `content-day.ts`, `happy-hour.ts`, `home-tour.ts`, `index.ts`, `shell.ts`, `signature.ts`, `types.ts`. Starter likely double-counted `.` and `..` in the directory listing. |
| Env vars | **TWO SURPRISES** | `GOOGLE_REFRESH_TOKEN` present, **one live caller** (`src/app/api/inbox/scan/route.ts:47` via `src/lib/gmail/client.ts:7`). `OAUTH_STATE_SIGNING_KEY` does NOT exist in `.env.local` or anywhere in `src/`. The OAuth state HMAC currently uses `OAUTH_ENCRYPTION_KEY` (key reuse across encryption + signing). |

### DB state (3-table disposition)

`material_requests` (LIVE, 23 rows) -- canonical ticket store. Active RLS policies, FK from `material_request_items.request_id`, FK to `contacts.id` and `auth.users.id`. Plan: `RENAME TO tickets`.

`material_request_items` (LIVE, 23 rows) -- line items. Plan: `RENAME TO ticket_items`. Column `request_id` stays as-is (column rename out of scope per starter).

`requests` (LIVE, **0 rows**) -- orphan stub. Schema differs from `material_requests` (has `property_address`, `internal_notes`, `listing_id` FK to `listings`; lacks `priority`, `source`, `submitter_*`, `request_type`). Zero callers in `src/`. One RLS policy (`Users manage own requests`). Plan: `RENAME TO _deprecated_requests` per Standing Rule 3 (no hard deletes); log eventual hard-drop to `LATER.md`.

### Code surface affected by table rename

**21 occurrences of `.from("material_requests")` across 11 files in `src/`:**
- `src/app/(app)/tickets/page.tsx` (2)
- `src/app/(app)/tickets/[id]/actions.ts` (4 incl. 2 `writeEvent.object.table` strings)
- `src/app/(app)/tickets/[id]/page.tsx` (1)
- `src/app/(app)/materials/page.tsx` (2)
- `src/app/(app)/contacts/[id]/page.tsx` (1)
- `src/app/(app)/analytics/page.tsx` (1)
- `src/components/materials/material-request-row.tsx` (1)
- `src/components/materials/material-request-form.tsx` (1)
- `src/components/dashboard/print-tickets-panel.tsx` (1)
- `src/lib/captures/promote.ts` (2)
- `src/lib/intake/process.ts` (1)

Plus `material_request_items` references in 2 spots (the `select(...material_request_items(*)...)` joins in `tickets/page.tsx` and `materials/page.tsx`).

Plus 6 `/materials` route literals to update (`captures-client.tsx`, `sidebar.tsx`, `command-palette.tsx`, `promote.ts:184` and `:509`, `materials/page.tsx` itself becomes a redirect).

Plus the `MaterialRequestStatus` type alias in `tickets/[id]/actions.ts` -- TYPE NAMES STAY (out of scope). Just the `.from()` strings change.

### OAuth state-signing finding

`src/lib/gmail/oauth.ts:40` and `:52` HMAC-SHA256 sign and verify state nonces using `process.env.OAUTH_ENCRYPTION_KEY`. That same key is also used by `src/lib/crypto/vault.ts:11` for AES-256-GCM encryption of stored access/refresh tokens. **Single key, two cryptographic primitives.** Best practice is to separate.

The starter's per-provider split (`OAUTH_STATE_SIGNING_KEY_GMAIL` + `_GCAL`) does not apply to current state: `oauth.ts:13-17` defines `GMAIL_SCOPES` as a union of `gmail.readonly`, `gmail.modify`, AND `calendar.events`. ONE OAuth flow, ONE callback, ONE token row in `oauth_tokens`. No per-provider state to sign.

### GOOGLE_REFRESH_TOKEN finding

ONE live caller: `fetchUnreadThreads` in `src/lib/gmail/client.ts`, called by `src/app/api/inbox/scan/route.ts:47`. There IS a parallel new flow at `src/lib/gmail/sync-client.ts` reading from `oauth_tokens`, with a comment confirming `client.ts` is "legacy still in use." Removing `GOOGLE_REFRESH_TOKEN` requires migrating `/api/inbox/scan` to `sync-client.ts` first, which the starter explicitly scopes out: "Do NOT remove the var if anything still references it. Slice 4 templates abstraction may obviate it; verify reference is dead before removal."

---

## Open questions for Alex (before "lock it")

1. **Task 1 -- requests table disposition.** Three options, my pick in bold:
   - **(a) Rename `requests` -> `_deprecated_requests` in the same migration as the material_requests rename.** Single SQL paste, clean namespace, log hard-drop to LATER. ← my recommendation
   - (b) Leave `requests` alone; the namespace conflict is theoretical. One less moving piece.
   - (c) Drop it (violates Standing Rule 3, do not do this).

2. **Task 1 -- index / trigger / RLS policy cosmetic renames.** After `material_requests` -> `tickets`, indexes still named `idx_material_requests_*`, trigger still `material_requests_updated_at`, RLS policies still `"Users manage own material requests"` etc. They keep working (tied to OID, not name) but the names lie. Two options:
   - **(a) Rename them in the same SQL paste (cosmetic, no behavior change).** ← my recommendation
   - (b) Skip the cosmetic renames; minimal SQL surface area.

3. **Task 3 -- /materials redirect vs remove.** Starter default is 308 redirect. Three options, my pick in bold:
   - **(a) 308 redirect to `/tickets`.** Safe for any external bookmarks/email links Alex may have sent. ← my recommendation
   - (b) Remove the route entirely. Cleaner, but breaks any cached link.
   - (c) Keep both routes alive (no -- starter's Acceptance Gate #3 forbids).

4. **Task 4 -- GOOGLE_REFRESH_TOKEN.** Has 1 live caller, so the starter's "remove" branch does not apply. Two options:
   - **(a) Defer removal. Document the live caller in BLOCKERS.md, log Slice 4 follow-up to migrate `/api/inbox/scan` to `sync-client.ts`, leave the env var in place.** ← my recommendation
   - (b) Migrate `/api/inbox/scan` now (in this slice). Adds scope: 1 route refactor + smoke test of the inbox sync flow.

5. **Task 5 -- OAUTH_STATE_SIGNING_KEY.** It does not exist; `OAUTH_ENCRYPTION_KEY` is double-duty. Three options:
   - **(a) Introduce `OAUTH_STATE_SIGNING_KEY` as a NEW env var (separate from `OAUTH_ENCRYPTION_KEY`). Refactor `src/lib/gmail/oauth.ts:40,52` to read it. Fall back to `OAUTH_ENCRYPTION_KEY` for one slice cycle so in-flight state nonces (10-min TTL) still verify. Document removal of fallback in LATER.md. No per-provider split (single combined Google flow). Update LATER.md to note that per-provider keys are a future Slice X concern when Outlook / Apple Calendar / non-Google providers arrive.** ← my recommendation
   - (b) Skip Task 5 entirely. Single-key approach works; the encryption-vs-signing key reuse is a security best-practice issue, not an active vulnerability. Document conscious choice.
   - (c) Force the per-provider split anyway (`_GMAIL` + `_GCAL`). Requires splitting the OAuth flow into two authorize+callback pairs; out of scope per starter "the auth flow itself stays identical."

6. **Task 6d -- invite-templates target shape.** 8 files totaling ~22 KB across 4 renderers + shell + signature + types + index barrel. Three options:
   - **(a) Single file `src/lib/events/invite-templates.ts`.** Per starter's allowance: "If invite templates are large enough to warrant their own module, leave them as a single src/lib/events/invite-templates.ts file (no subdirectory)." ← my recommendation
   - (b) Split into `src/lib/events/templates.ts` (renderers) + merge types into `src/lib/events/types.ts`.
   - (c) Fully fold into `actions.ts` / `queries.ts` / `types.ts`. Awkward fit (renderers are pure functions, not actions or queries).

---

## Task list

### Task 0 -- Branch creation (no commit)

```bash
cd ~/crm
git checkout -b gsd/007-slice-3b-ticket-unification-oauth-cleanup-lib-carryforward
```

### Task 0a -- Hygiene commit (Alex's instruction; before Task 1)

Stages 4 hygiene items in one atomic commit on the feature branch:
1. Add to `.gitignore` (only these two lines, do NOT add `.planning/`):
   ```
   .claude/worktrees/
   .playwright-mcp/
   ```
2. `git add .planning/phases/004-slice-2c-tasks-opportunities-interactions/` (commit the Slice 2C planning artifact)
3. `git add scripts/check-error-log.mjs` (general debugging utility)
4. `git add scripts/probe-rate-limit-rpc.mjs` (Slice 3A verification helper, complements live infrastructure)

Commit message: `chore(3b-task-0a): stage Slice 3A diagnostics, commit Slice 2C planning, gitignore session dirs`

Quality gate: none (no source changes).

### Task 1 -- Ticket table unification (SQL)

Generate `~/Desktop/PASTE-INTO-SUPABASE-slice3b-ticket-unification.sql` with idempotent `DO $$ ... END $$` blocks for:

1. `RENAME TABLE public.requests TO _deprecated_requests` (guarded by `IF EXISTS`)
2. `RENAME TABLE public.material_requests TO tickets`
3. `RENAME TABLE public.material_request_items TO ticket_items`
4. `RENAME CONSTRAINT material_request_items_request_id_fkey TO ticket_items_ticket_id_fkey` on `ticket_items`
5. (Decision-2 dependent) Cosmetic renames: indexes (`idx_material_requests_*` -> `idx_tickets_*`), trigger (`material_requests_updated_at` -> `tickets_updated_at`), RLS policies (`"Users manage own material requests"` -> `"Users manage own tickets"`, etc.)

Update `SCHEMA.md` in the same task:
- Mark `material_requests` row as renamed -> `tickets` (live)
- Mark `material_request_items` row as renamed -> `ticket_items` (live)
- Add `_deprecated_requests` row (status `deprecated`, log Slice X hard-drop)
- Update Slice plan table to add Slice 3B summary

Append to `LATER.md`:
- Hard-drop `_deprecated_requests` after [date + 30 days] confidence soak
- Migrate `@/components/materials/*` directory to `@/components/tickets/*` (deferred per scope)
- Rename `MaterialRequest`, `MaterialRequestStatus`, `MaterialRequestRow`, etc. type/component identifiers to `Ticket*` (deferred per scope)

**BLOCKING CHECKPOINT.** Print the absolute SQL path. Wait for Alex to paste in Supabase SQL Editor and report success. Then run `NOTIFY pgrst, 'reload schema';` autonomously via MCP (Rule 23).

Commit (after paste confirmation): `refactor(007): Slice 3B Task 1 -- rename material_requests to tickets, soft-deprecate orphan requests table`

### Task 2 -- Verify migration (read-only)

Generate `~/Desktop/PASTE-INTO-SUPABASE-slice3b-ticket-unification-VERIFY.sql` -- but per Rule 23, **read-only verification runs via MCP, not paste-file**. So Task 2 is autonomous: I run the verify queries via `mcp__supabase__execute_sql` and report results. The "paste file" path is preserved as a backup record so Alex can re-run later if needed.

Verify queries:
1. `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('tickets','ticket_items','_deprecated_requests','material_requests','requests');` -- expect first 3 present, last 2 absent
2. `SELECT COUNT(*) FROM public.tickets;` -- expect 23
3. `SELECT COUNT(*) FROM public.ticket_items;` -- expect 23
4. `SELECT COUNT(*) FROM public._deprecated_requests;` -- expect 0
5. `SELECT policyname FROM pg_policies WHERE tablename IN ('tickets','ticket_items') ORDER BY tablename, policyname;` -- expect 4 policies (2 per table)
6. `SELECT conname FROM pg_constraint WHERE conrelid='public.ticket_items'::regclass AND contype='f';` -- expect `ticket_items_ticket_id_fkey`

No commit (verification only).

### Task 3 -- Code refactor: table-name strings + route collapse

**3a -- Update `.from()` strings (21 sites in 11 files):**
- `src/app/(app)/tickets/page.tsx` (2 hits)
- `src/app/(app)/tickets/[id]/actions.ts` (4 hits incl. 2 `writeEvent.object.table` literals)
- `src/app/(app)/tickets/[id]/page.tsx` (1)
- `src/app/(app)/materials/page.tsx` (2; this file becomes a redirect, so the Supabase calls disappear)
- `src/app/(app)/contacts/[id]/page.tsx` (1)
- `src/app/(app)/analytics/page.tsx` (1)
- `src/components/materials/material-request-row.tsx` (1)
- `src/components/materials/material-request-form.tsx` (1)
- `src/components/dashboard/print-tickets-panel.tsx` (1)
- `src/lib/captures/promote.ts` (2)
- `src/lib/intake/process.ts` (1)

Also update `material_request_items(*)` -> `ticket_items(*)` in the 2 join projections.

**3b -- /materials route collapse:**
- Replace `src/app/(app)/materials/page.tsx` body with a 308 redirect: `import { redirect } from "next/navigation"; export default function Page(){ redirect("/tickets"); }`
- Port the two unique features from /materials into /tickets header:
  - `NewIntakeBadge` (count of `source='intake'` AND `status='submitted'`) -- add to `tickets/page.tsx` `right` slot of `PageHeader`
  - `PreviewLink` to `/weekly-edge/preview` -- add to `tickets/page.tsx` `right` slot of `PageHeader`
- Remove the status filter pills from `/materials` -- the `/tickets` kanban already columns by status, the filter is redundant.

**3c -- Update navigation/route literals:**
- `src/components/sidebar.tsx:36` -- change `{ href: "/materials", label: "Materials" ... }` to `{ href: "/tickets", label: "Tickets" ... }`. Keep the `Printer` icon.
- `src/components/command-palette.tsx:283` -- `navigate("/materials")` -> `navigate("/tickets")`. Update label if it says "Materials" too.
- `src/lib/captures/promote.ts:184` and `:509` -- `targetUrl: '/materials'` -> `targetUrl: '/tickets'` (both branches).
- `src/app/(app)/captures/captures-client.tsx:59` -- `if (target === "ticket") return "/materials";` -> `return "/tickets";`

**3d -- Verify no live `/materials` references remain (Acceptance Gate #4):**
After 3b/3c, run `grep -rn "/materials" src/` and verify the only matches are in the redirect handler at `src/app/(app)/materials/page.tsx` (now a redirect) plus comments. No live route refs.

Quality gate after 3a-3d: `pnpm typecheck && pnpm build`.

Commit: `refactor(007): Slice 3B Task 3 -- update table refs, collapse /materials into /tickets, port intake badge + preview link`

### Task 4 -- GOOGLE_REFRESH_TOKEN audit (no removal this slice per Decision-4)

Audit report only:
- 1 live caller: `src/lib/gmail/client.ts:7`, used by `fetchUnreadThreads`, called from `src/app/api/inbox/scan/route.ts:47`.
- Parallel new flow exists at `src/lib/gmail/sync-client.ts` reading from `oauth_tokens`. Comment in that file confirms `client.ts` is legacy.
- Recommendation: defer removal to Slice 4 (or earlier dedicated session) after migrating `/api/inbox/scan` to `sync-client.ts`.

Add new entry to `BLOCKERS.md`:
> ### [2026-04-26] Slice 4 follow-up: migrate /api/inbox/scan to oauth_tokens-backed sync client
> Broken: `src/app/api/inbox/scan/route.ts:47` calls `fetchUnreadThreads` from `src/lib/gmail/client.ts`, which reads `process.env.GOOGLE_REFRESH_TOKEN`. This blocks removal of the `GOOGLE_REFRESH_TOKEN` env var. New flow exists at `src/lib/gmail/sync-client.ts` reading from `oauth_tokens` table.
> Where: `src/app/api/inbox/scan/route.ts:47`, `src/lib/gmail/client.ts:1-22`.
> Fix needed: refactor scan route to use `loadTokens()` + `getOAuth2Client()` from `src/lib/gmail/oauth.ts` (already wired for Gmail + Calendar combined scope). Then remove `GOOGLE_REFRESH_TOKEN` from .env.local + Vercel envs. Smoke /api/inbox/scan locally first.

No source changes this slice; documentation only. Single commit folds with Task 9 doc updates -- no separate commit for Task 4.

### Task 5 -- OAUTH_STATE_SIGNING_KEY introduction (Decision-5 path a)

Generate the new key (32 bytes hex, 64 chars) deterministically via `node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))'`.

Refactor `src/lib/gmail/oauth.ts`:
- Add helper at top: `function getStateSigningKey(): string { return process.env.OAUTH_STATE_SIGNING_KEY ?? requireEnv("OAUTH_ENCRYPTION_KEY"); }` -- one slice cycle of fallback so in-flight nonces (10-min TTL) still verify across the deploy boundary.
- Line 40: `createHmac("sha256", requireEnv("OAUTH_ENCRYPTION_KEY"))` -> `createHmac("sha256", getStateSigningKey())`
- Line 52: same swap.

Generate paste file `~/Desktop/PASTE-INTO-ENV-slice3b-oauth-state-signing-key.txt`:
```
# Add to .env.local AND Vercel env (preview + production):
OAUTH_STATE_SIGNING_KEY=<NEW_64_HEX_VALUE>
```

Append to LATER.md:
- After 1 slice cycle (assume 7-14 days post-merge), remove the `?? requireEnv("OAUTH_ENCRYPTION_KEY")` fallback in `oauth.ts` so encryption and signing keys are fully decoupled.
- When a non-Google OAuth provider (Outlook, Apple Calendar, etc.) is added, introduce `OAUTH_STATE_SIGNING_KEY_<PROVIDER>` per-provider keys. Today the single key is correct because `oauth.ts:13-17` runs ONE combined Gmail+Calendar OAuth flow.

**BLOCKING CHECKPOINT.** Print the absolute path of the env paste file. Wait for Alex to add the new var to `.env.local` AND Vercel envs (preview + production) and report success before proceeding.

Quality gate: `pnpm typecheck && pnpm build` after the oauth.ts edit, BEFORE Alex adds the env var (the fallback ensures the build still works without the new var).

Commit: `refactor(007): Slice 3B Task 5 -- decouple OAuth state signing from OAUTH_ENCRYPTION_KEY`

### Task 6 -- Lib carryforwards (4 atomic sub-commits)

Each sub-task: `pnpm typecheck && pnpm build` between commits. If any fails, revert that commit and log to BLOCKERS.md.

**6a -- Rename `src/lib/captures/parse.ts` -> `src/lib/captures/rules.ts`.**
- `git mv src/lib/captures/parse.ts src/lib/captures/rules.ts`
- Update imports at:
  - `src/app/api/captures/route.ts`
  - `src/components/capture-bar.tsx`
- No body changes.
- Commit: `refactor(007): Slice 3B Task 6a -- rename captures/parse.ts to rules.ts`

**6b -- Fold `src/lib/captures/promote.ts` into `src/lib/captures/actions.ts`.**
- Read both files. `actions.ts` is currently a stub from Slice 3A. Move all exports from `promote.ts` into `actions.ts` (preserving function bodies, type imports).
- Delete `promote.ts`.
- Update import at `src/app/api/captures/[id]/process/route.ts`.
- Commit: `refactor(007): Slice 3B Task 6b -- fold captures/promote.ts into actions.ts`

**6c -- Fold `src/lib/campaigns/auto-enroll.ts` into `src/lib/campaigns/actions.ts`.**
- Move `autoEnrollNewAgent` + the helper types into `actions.ts`.
- Delete `auto-enroll.ts`.
- Update imports at:
  - `src/app/api/contacts/route.ts`
  - `src/app/api/contacts/[id]/auto-enroll/route.ts`
  - `src/lib/intake/process.ts`
- Commit: `refactor(007): Slice 3B Task 6c -- fold campaigns/auto-enroll.ts into actions.ts`

**6d -- Promote `src/lib/events/invite-templates/` to `src/lib/events/invite-templates.ts` (single file, Decision-6 path a).**
- Concatenate the 8 sub-files into a single `src/lib/events/invite-templates.ts` preserving export shape from `index.ts`. Internal helpers become module-private.
- Order in concatenated file: types -> shell -> signature -> 4 renderers (home-tour, class-day, content-day, happy-hour). Re-export the same names that `index.ts` exposed today so import sites do not change.
- `git rm -r src/lib/events/invite-templates/`
- Grep for current imports of `from "@/lib/events/invite-templates"` -- they should all keep working unchanged because the new path is the same string (Node resolves `invite-templates.ts` when no `invite-templates/` directory exists).
- Commit: `refactor(007): Slice 3B Task 6d -- promote events/invite-templates to top-level single file`

If any sub-task breaks typecheck/build/lint, revert THAT sub-task only and log to BLOCKERS.md. Do not block remaining sub-tasks.

### Task 7 -- Quality gates

```bash
cd ~/crm
pnpm typecheck   # must exit 0
pnpm lint        # must exit 0, warning count <= main
pnpm build       # must exit 0
```

Lint warning baseline (per Slice 3A closure): "✔ No ESLint warnings or errors". Same baseline expected after 3B.

If lint surfaces new warnings from the refactors, fix them in this slice (do not push the warning count up). Likely candidates: unused imports after route collapse, duplicate type imports after Task 6 folds.

If typecheck or build fails, fix root cause; do not declare done. No commit unless fixes are needed.

### Task 8 -- Local dev smoke

```bash
cd ~/crm && pnpm dev
```

Probe both 3000 and 3001 per Standing Rule 17 before assuming the port. If both respond, ask Alex which is the active session.

Smoke checks:
- `/tickets` -- list view loads, kanban shows all 23 tickets across status columns. Header shows new intake badge + preview link if applicable.
- `/tickets/<id>` -- detail view loads (pick any of the 23 ticket IDs).
- `/materials` -- 308s to `/tickets` (verify in browser network tab or curl).
- `/captures` -- create a test capture with text "ticket flyer" -> Process -> verify "Promoted -> Ticket (view)" links to `/tickets` (not `/materials`).
- OAuth state signing -- visit `/api/auth/gmail/authorize` (or whichever route generates the URL with state). Confirm callback verifies. Do NOT actually re-auth Alex's account; just confirm the state token round-trips. (Read-only test.)

If any flow regresses, revert the relevant task and re-attempt.

No commit unless smoke surfaces fixes.

### Task 9 -- Update BUILD.md / BLOCKERS.md / SCHEMA.md / LATER.md

- **BUILD.md**: move "Slice 3B" entry from Currently Building -> Built with date 2026-04-26 (or whatever ship date), with a one-paragraph summary.
- **BLOCKERS.md**:
  - Resolve 4 carryforward entries dated 2026-04-24 (parse.ts rename, promote.ts fold, auto-enroll.ts fold, invite-templates promotion). Move to Resolved with closing commit SHAs.
  - Add 1 new entry: Slice 4 follow-up -- migrate /api/inbox/scan to oauth_tokens-backed sync client (Task 4 finding).
- **SCHEMA.md**: confirmed in Task 1; double-check the unified `tickets` row, the `ticket_items` row, the `_deprecated_requests` row are all present and correct.
- **LATER.md**:
  - Hard-drop `_deprecated_requests` after data confidence soak (Slice X).
  - Remove `OAUTH_ENCRYPTION_KEY` fallback in `src/lib/gmail/oauth.ts` after one slice cycle (Slice 4+).
  - Per-provider OAuth signing keys when non-Google providers arrive (Slice X).
  - Migrate `@/components/materials/*` -> `@/components/tickets/*` (deferred per Slice 3B scope).
  - Rename `MaterialRequest*` types to `Ticket*` (deferred per Slice 3B scope).

Single commit folds Tasks 4 + 9: `docs(007): Slice 3B -- update BUILD/BLOCKERS/SCHEMA/LATER, log GOOGLE_REFRESH_TOKEN audit findings`

### Task 10 -- Push, compare URL, stop

```bash
cd ~/crm
git push -u origin gsd/007-slice-3b-ticket-unification-oauth-cleanup-lib-carryforward
echo "https://github.com/alexhollien-alt/gat-bos/compare/main...gsd/007-slice-3b-ticket-unification-oauth-cleanup-lib-carryforward"
```

STOP. Do NOT use `gh` CLI. Do NOT create the `slice-3b-complete` tag (Alex tags the merge commit on main after manual merge). Do NOT auto-poll PR status.

### Task 11 -- Stale-branch sweep (post-merge, on main, AFTER Alex tags)

After Alex merges PR + tags `slice-3b-complete` on the merge commit on main:

```bash
git checkout main
git pull
git branch -d gsd/001-slice-1-activity-ledger
git branch -d gsd/002-slice-2a-spine-drop
git branch -d gsd/003-slice-2b-captures-consolidation
git branch -d gsd/004-slice-2c-tasks-opportunities-interactions
git branch -d gsd/005-slice-3-interactions-routes-cleanup
git branch -d gsd/006-slice-3a-route-thinning-lib-standardization
git branch -d gsd/007-slice-3b-ticket-unification-oauth-cleanup-lib-carryforward
git branch -d worktree-agent-aa001731
```

Lowercase `-d` only. NEVER `-D`. If any branch refuses delete (unmerged), STOP and report -- do not force.

This is the LAST step. After this, Slice 3B is fully closed.

---

## Atomic commit order

```
0a.  chore(3b-task-0a): stage Slice 3A diagnostics, commit Slice 2C planning, gitignore session dirs
1.   refactor(007): Slice 3B Task 1 -- rename material_requests to tickets, soft-deprecate orphan requests table
3.   refactor(007): Slice 3B Task 3 -- update table refs, collapse /materials into /tickets, port intake badge + preview link
5.   refactor(007): Slice 3B Task 5 -- decouple OAuth state signing from OAUTH_ENCRYPTION_KEY
6a.  refactor(007): Slice 3B Task 6a -- rename captures/parse.ts to rules.ts
6b.  refactor(007): Slice 3B Task 6b -- fold captures/promote.ts into actions.ts
6c.  refactor(007): Slice 3B Task 6c -- fold campaigns/auto-enroll.ts into actions.ts
6d.  refactor(007): Slice 3B Task 6d -- promote events/invite-templates to top-level single file
9.   docs(007): Slice 3B -- update BUILD/BLOCKERS/SCHEMA/LATER, log GOOGLE_REFRESH_TOKEN audit findings
```

9 commits total on the feature branch. Tasks 0, 2, 4, 7, 8, 10, 11 produce no commits (branch creation, read-only verification, audit-only, quality gates, smoke, push, post-merge cleanup).

---

## Risk register

| # | Risk | Mitigation |
|---|------|------------|
| 1 | Missed `.from('material_requests')` call site silently fails in prod after rename | Pre-rename grep audit (Task 3 verification) -- confirmed 21 sites in 11 files. Post-rename grep must return zero hits. Acceptance Gate verifies. |
| 2 | `material_request_items(*)` join projections in select strings -- 2 sites | Listed explicitly in Task 3. Update both. |
| 3 | RLS policy names retain `material_requests` wording (cosmetic only) | Decision-2 path a renames them in same SQL; otherwise logged in LATER.md. |
| 4 | OAuth state nonces in flight (< 10 min) at deploy boundary fail to verify because new key was deployed mid-flight | Task 5 fallback to `OAUTH_ENCRYPTION_KEY` covers the boundary; nonces still verify until the next OAuth flow within TTL. Document removal of fallback after one slice cycle. |
| 5 | Component dir naming drift (`@/components/materials/*` after route is `/tickets`) | Conscious deferral per starter scope; logged to LATER.md. Not a regression. |
| 6 | `/api/inbox/scan` still requires `GOOGLE_REFRESH_TOKEN` | Documented in BLOCKERS.md (Task 4); env var stays. No accidental removal. |
| 7 | Slice 3A's `~/Desktop/PASTE-INTO-SUPABASE-rate-limit-rpc.sql` still on Desktop, executed but not archived (per Standing Rule 22) | Out of scope for 3B per starter; flag in Task 9 for follow-up archival. Could be folded into Task 0a but that bloats the hygiene commit. Defer. |
| 8 | `requests` table FK to `listings` -- if `listings` doesn't exist, the rename to `_deprecated_requests` is fine (FK survives), but if `listings` is also orphan, the FK chain is rotting | `listings` not in scope; confirmed via earlier MCP query (`SELECT table_name ... LIKE 'request%'` returned only `requests`). Listings table exists separately (per FK). Check via MCP if Alex wants comfort, otherwise defer. |
| 9 | `pg_proc` `increment_rate_limit` already lives in prod (confirmed pre-flight Step 8). Task 1 SQL must not collide. | Task 1 only touches `tickets` / `material_requests` / `material_request_items` / `requests`. No collision. |
| 10 | Stale branch list in Task 11 includes `worktree-agent-aa001731` -- if it has unmerged commits, `git branch -d` will refuse, prompting a manual review | Designed: lowercase `-d` only, never `-D`. If a branch refuses delete, STOP and report rather than force. |

---

## Acceptance gate

All must be true before calling Slice 3B done:

1. `tickets` table exists; `material_requests` does not. Row count = 23.
2. `ticket_items` table exists; `material_request_items` does not. Row count = 23.
3. `_deprecated_requests` table exists with 0 rows.
4. `SCHEMA.md` reflects all three above.
5. `/materials` returns HTTP 308 to `/tickets` (or 404 if Decision-3 chooses removal).
6. `grep -rn "/materials" src/` returns matches only inside `materials/page.tsx` (the redirect handler) and comments. No live route refs.
7. `grep -rn "material_requests\|material_request_items" src/` returns zero hits.
8. `GOOGLE_REFRESH_TOKEN` either removed from `.env.local` + Vercel + `.env.example` AND zero `src/` references, OR documented decision to defer in BLOCKERS.md (path b per Decision-4 = defer).
9. `OAUTH_STATE_SIGNING_KEY` lives in `.env.local` + Vercel envs; `oauth.ts:40,52` reads it via `getStateSigningKey()` helper with one-slice fallback to `OAUTH_ENCRYPTION_KEY`; LATER.md logs fallback removal.
10. `src/lib/captures/parse.ts` does not exist; `src/lib/captures/rules.ts` does, with prior `parse.ts` exports.
11. `src/lib/captures/promote.ts` does not exist; its exports live in `src/lib/captures/actions.ts`.
12. `src/lib/campaigns/auto-enroll.ts` does not exist; its exports live in `src/lib/campaigns/actions.ts`.
13. `src/lib/events/invite-templates/` directory does not exist; `src/lib/events/invite-templates.ts` single file does, with same export surface.
14. `pnpm typecheck` -- exit 0.
15. `pnpm lint` -- exit 0, warning count not increased vs main.
16. `pnpm build` -- exit 0.
17. Branch pushed; compare URL printed; tool execution stopped.

---

## Rollback plan

If Task 1 SQL paste produces unexpected state (e.g., a rename misfires partway), Alex can restore via Supabase SQL Editor:

```sql
-- Worst case: explicit reverse rename (only run if a partial state exists)
DO $$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE tablename='tickets') THEN
  EXECUTE 'ALTER TABLE public.tickets RENAME TO material_requests'; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE tablename='ticket_items') THEN
  EXECUTE 'ALTER TABLE public.ticket_items RENAME TO material_request_items'; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE tablename='_deprecated_requests') THEN
  EXECUTE 'ALTER TABLE public._deprecated_requests RENAME TO requests'; END IF; END $$;
NOTIFY pgrst, 'reload schema';
```

Code rollback: `git revert <commit-sha>` for the Task 3 commit will undo the `.from()` swaps. The feature branch can be reset to pre-Task-1 state with `git reset --hard <task-0a-sha>`.

If any of Tasks 6a-6d breaks typecheck or build, revert that single commit (`git revert <sub-task-sha>`); the other carryforwards remain shipped. BLOCKERS.md gets a new entry for the failed sub-task.

If Task 5 OAuth changes break the auth flow, revert the Task 5 commit; the env var Alex added becomes harmless (unused). LATER.md notes that the var can be removed if needed.

---

## Skipped from starter

- Per-provider OAuth state-signing key split (`_GMAIL` + `_GCAL`) -- premise does not match current state (single combined Google flow). Decision-5 path a; logged for future provider expansion.
- `GOOGLE_REFRESH_TOKEN` removal -- 1 live caller, defer per Decision-4.

---

## Lock gate

This plan is awaiting Alex's responses to the 6 open questions and a literal "lock it" or "go" before Task 0 (branch creation) executes.
