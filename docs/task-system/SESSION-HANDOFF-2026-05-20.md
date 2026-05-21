# Phase 0 Session Handoff -- 2026-05-20

Single source of truth for resuming the GAT-BOS Task System Phase 0 build in a fresh Claude Code session with zero context loss.

A fresh session should read THREE files plus this one to pick up cleanly:

1. This file (`docs/task-system/SESSION-HANDOFF-2026-05-20.md`) -- where we left off
2. `~/Downloads/gatbos-task-system-handoff.md` -- architectural spec (Section 1-12)
3. `~/Downloads/CLAUDE-CODE-BRIEF.md` -- execution playbook with the 5 gates
4. `~/.claude/projects/-Users-alex/memory/project_task_system_phase_0.md` -- compressed pause-state index

If those three docs disagree, this handoff wins for current-state, the brief wins for execution structure, and the spec wins for architectural intent.

---

## 1. CURRENT STATE

**Branch:** `task-system-phase-0` in `~/crm/`. Branched off `main` at `09028d0` (Slice 5 agent portal). Three commits, all local, nothing pushed to origin. No PR opened.

**Gate status:**

| Gate | Status | Commit |
|------|--------|--------|
| 0 -- Recon | COMPLETE (prior session) | none |
| 1 -- Schema + capture endpoint | COMPLETE, signed off by Alex | `70497e2` |
| 2 -- Conversational capture spec | COMPLETE, signed off by Alex | `03983a0` |
| Pause-state docs | COMPLETE | `306c196` |
| 2.5 (TBD) or Gate 3 prep -- MCP server | NOT STARTED, scope-then-build | -- |
| 3 -- Seed 25 agents | NOT STARTED, blocked on MCP server + manual claude.ai setup | -- |
| 4 -- Morning brief | NOT STARTED | -- |
| 5 -- Closeout | NOT STARTED | -- |

**One-line summary per commit:**

- `70497e2` -- "gate 1: task system phase 0 schema + capture endpoint". 11 files, +1670 / -19. Five tables (`nodes`, `tags`, `node_tags`, `cadences`, `node_events`), 3 triggers, 4 functions, 5 seeded Areas with stable UUIDs, capture endpoint extended via `target: "task_system"` discriminator, bearer auth via `INTERNAL_API_TOKEN`, walk-parent projection fix.
- `03983a0` -- "gate 2: task system phase 0 conversational capture spec". 5 files, +473 / -0. Area-writability 422 guard at route, Anthropic function-calling tool spec, full Claude Project system prompt, manual setup checklist, 3 new BLOCKERS.md entries.
- `306c196` -- "docs(task-system): record phase 0 pause state, mcp server blocker, gate 3 entry conditions". 2 files, +25 / -0. Top-of-doc disclaimer + MCP-required callout + Gate 3 entry conditions block in setup.md; new MCP-server-build entry in BLOCKERS.md.

**What is verified end-to-end (Gate 1):**

- 7 worked examples from handoff Section 5 all return HTTP 201 against `/api/captures` with bearer auth
- Cadence engine: tier 1 contact gets `target_days=7`; interaction insert advances `next_due_at` to `last_touched_at + target_days`
- Live AFTER INSERT trigger populates `node_events.contact_id` for interaction rows, `node_events.project_id` for task rows (walk-parent fix in migration `20260521003837`)
- `rebuild_node_events_from_activity()` matches the trigger logic in lockstep (rebuilt 17 rows, all populated correctly)
- `pnpm typecheck` PASS
- `pnpm build` PASS

**What is verified at code-spec level (Gate 2):**

- Area-writability guard: explicit `hints.type='area'` returns HTTP 422 with `{ error: "areas_not_writable", message, resolved_from }`
- Sanity contact creation still returns HTTP 201
- Tool schema compiles (uses `@anthropic-ai/sdk` `^0.85.0`, already in dependencies)
- `pnpm typecheck` PASS
- `pnpm build` PASS

**What is NOT verified (deferred to post-MCP-server):**

- End-to-end conversational capture from a Claude Project on claude.ai (requires the MCP server proxy layer)
- Seeded 25 agents (Gate 3)
- Morning brief send (Gate 4)
- Idempotency of brief send (no double-send check yet, Gate 4 builds it)

---

## 2. NEXT STEP

The immediate next piece of work, in order:

**Step A -- MCP server scope decision (separate session, fresh scope brief).**

The Claude Project on claude.ai cannot directly call `/api/captures` because the endpoint requires a bearer secret that must not leave Alex's laptop. The wiring layer that holds `INTERNAL_API_TOKEN` and forwards each `capture_to_task_system` tool invocation to `http://localhost:<port>/api/captures` does not exist yet. It needs to be scoped in a dedicated session before any code is written. Decision still open whether this is its own micro-gate (Gate 2.5) or rolls into Gate 3 prep.

The tool schema for the MCP server to register lives at `~/crm/src/lib/claude-tools/capture-tool.ts` (`captureTool` constant). The MCP server will forward calls with `target: "task_system"`, `source: "claude"`, `Authorization: Bearer $INTERNAL_API_TOKEN` injected. Local-only for Phase 0; hosted MCP for mobile is Phase 1.

**Step B -- Manual claude.ai Project setup (Alex, ~20 minutes).**

After the MCP server lands, Alex runs the 7-step checklist in `~/crm/docs/task-system/setup.md`. Outcomes to verify: the 3-capture test conversation passes; rows visible in `public.nodes` and `public.node_events`; the area-creation attempt in step 3 of the test correctly produces NO row (no tool call fires).

**Step C -- Gate 3, seed 25 agents.**

Entry conditions block in `setup.md` lists six conditions (a through f) that must all be true. Specifically: MCP server built, manual claude.ai setup complete, 3-capture test passed, destructive-bash bypass requested explicitly at Gate 3 kickoff for the local-reset command, local DB drift cleared via the reset, agent source confirmed at `~/Documents/Alex Hub(Obs)/wiki/agents/`.

Gate 3 deliverable: `scripts/seed-agent-contacts.ts`. Reads the Obsidian wiki agent files, normalizes the data, inserts each as a `contact` node with assigned tier (~5 Tier 1, ~10 Tier 2, ~10 Tier 3), inserts paired `cadence` rows with tier-default `target_days` (7, 14, 30), sets `last_touched_at` to today minus half target_days, is idempotent on `(name + brokerage)` or `email`. Standing rules honored in seed data per brief Gate 3 section: Julie (lender co-brand Christine McConnell, specialty Optima Camelview Village), Joey + Amber Hollien (My Home Group, North Scottsdale, 85258), Fiona Bigbee (EDDM, 85258), Stephanie Reid (Gravity Home Loans, role lender).

**Step D -- Gate 4, morning brief.**

Extend the existing `/api/cron/morning-brief/route.ts`. Cron triggers at 7am Phoenix time (14:00 UTC during MST, 13:00 UTC during DST). Queries: 1 Big Thing (highest-priority active task under active project with soonest deadline), 3 overdue contacts from `cadences WHERE next_due_at < now()` ranked by tier then days overdue, 2 stale projects (no `events` row in 14 days, status `active`), 1 annual theme prompt from rotating 12-prompt list (hardcode for Phase 0). Skip Google Calendar pull in Phase 0; placeholder `[Calendar integration: Phase 1]` in the brief. HTML email template at `src/lib/email/templates/morning-brief.tsx` matching existing GAT-BOS transactional pattern. NO GAT logo in this email (internal to Alex, not partner-facing). Send via Resend to Alex's email read from env. Log to `activity_events` with verb `brief_sent`. Idempotent: check for today's `brief_sent` row before sending.

**Step E -- Gate 5, closeout.**

Write `docs/task-system/PHASE-0-COMPLETE.md` (what shipped, what stays manual, known limitations, Phase 1 entry conditions). Tag the commit `task-system-phase-0` or equivalent. Open placeholder `docs/task-system/PHASE-1-SCOPE.md` with three sections: Calendar integration, dashboard homepage port from the parallel Claude artifact, quarterly engine.

---

## 3. ARCHITECTURAL DECISIONS LOCKED (do not re-litigate)

Every decision resolved across the full Phase 0 effort, including ones from the prior session before this one.

- **`events` table rename to `node_events`.** Spec `events` collided with existing `public.events` in the GAT-BOS schema. Phase 0 spec table is `node_events`. The original `public.events` is untouched.
- **`activity_events` is canonical log; `node_events` is a derived projection.** AFTER INSERT trigger `project_activity_to_node_events()` on `activity_events` filters by a verb whitelist and writes the projection row. Manual replay via `rebuild_node_events_from_activity()` matches trigger logic in lockstep.
- **DB trigger over application-layer dual-write.** Rationale: 100+ existing call sites already write to `activity_events`; a dual-write at every call site would be missed in places, drift over time, and produce silent gaps in the projection. The trigger cannot be bypassed and mirrors the existing `opportunities` stage-transition trigger pattern from `20260512011051_opportunities_transaction_events_trigger.sql`.
- **Projection walks `parent_id` one step for relational types.** For `interaction`, `event`, `task`: the activity row's `object_id` IS the relational node; its parent is the contact (interaction), or the contact / project (event), or the project / area (task). The trigger walks one level up and denormalizes `contact_id` / `project_id` so Gate 4 queries can do simple `WHERE contact_id = X` joins. Migration `20260521003837_task_system_phase0_projection_walk_parent.sql`.
- **Morning brief extends existing `/api/cron/morning-brief/route.ts`, not a new Supabase scheduled function.** The brief spec wrote "Supabase scheduled function" but GAT-BOS already has a Vercel cron at that route. Match existing patterns first.
- **Capture endpoint extends existing `/api/captures` (plural) with `target` field, not new `/api/capture` (singular).** Original spec wrote `/api/capture`; existing GAT-BOS pattern is `/api/captures`. Discriminator field `target: "captures" | "task_system"` routes inside the route handler. Honors brief Decision #4 (work in existing repo, match existing patterns).
- **Capture endpoint auth: session cookie OR `Bearer INTERNAL_API_TOKEN`.** Bearer path resolves user via `OWNER_USER_ID` env (the existing `/api/intake` convention). Both paths are accepted; bearer is the path the MCP server will use.
- **`OWNER_USER_ID` env var name.** Brief mentioned `GAT_OPERATOR_USER_ID`; that was drift. Existing convention `OWNER_USER_ID` wins. No rename.
- **5 Areas seeded with stable UUIDs `a0000001` through `a0000005`.** Sales Production, Agent Partnerships, GAT-BOS Build, BNI / SAAR / WCR, Personal. Stable UUIDs so IDs are reproducible across environments and rebuilds. Seed runs in `20260520194801_task_system_phase0.sql` `DO $$` block resolving `user_id` from the single active `public.accounts` row.
- **Areas fixed at 5, enforced by route guard + system prompt.** The unified nodes table cannot enforce the cap with a CHECK constraint (areas are nodes alongside everything else). Route returns HTTP 422 `{ error: "areas_not_writable", message, resolved_from }` immediately after type inference, before any DB write. Claude Project system prompt repeats the constraint and includes Example 7 as the load-bearing "do not call the tool" pattern.
- **Cadence side-effects live in app layer at `/api/captures`, NOT in the trigger.** `createCadence` on new contact insert; `touchCadenceForInteraction` on interaction insert (advances `next_due_at` to `last_touched_at + tier target_days`). Helpers in `src/lib/task-system/cadence.ts`. The trigger handles ONLY the immutable log projection.
- **Tier defaults from brief Section 3.6:** 1 = top producer (7-day cadence, ~5 contacts), 2 = active partner (14-day, ~10), 3 = maintenance (30-day, ~10). New contact captured without a tier hint defaults to 3 with a `missing_tier` warning surfaced in the response.
- **Type inference: hints.type wins; otherwise Claude inference with fill-and-flag fallback to `type='task'` `status='inbox'`.** `src/lib/task-system/infer-type.ts` swallows errors and falls back; defense-in-depth catch in the route handler logs `inference_fallback` warning if anything else throws.
- **Triple-mirrored verb whitelist accepted as Phase 0 debt.** Verb-to-projection-type mapping lives in three places: SQL trigger `project_activity_to_node_events()`, SQL `rebuild_node_events_from_activity()`, TypeScript `src/lib/task-system/projected-verbs.ts`. Phase 1 consolidation candidate: codegen from TS, or move into a Postgres lookup table.
- **Local MCP for Phase 0, hosted MCP for mobile is Phase 1.** Conversational capture works from Alex's laptop only in Phase 0. Mobile capture (Claude on iOS, or any off-laptop path) is a Phase 1 deliverable.
- **Optional iOS Shortcut fallback (`/api/capture/manual/route.ts`) skipped.** Brief Section 7 listed this as optional Gate 2 deliverable; Alex explicitly skipped to keep Gate 2 lean. Phase 1 task.
- **Local-first development; remote pushes require explicit approval.** Standing instruction across all three commits. No `git push`, no PR opened, no Vercel deploy until Alex explicitly authorizes per piece.
- **Destructive-bash hook bypass approved for `supabase db reset --local` specifically, one command only.** Pre-approved by Alex 2026-05-20 for Gate 3 kickoff. Must be requested explicitly in the Gate 3 kickoff message; granted for that one command only; hook stays on for everything else. Side effects of the local-reset command should be flagged in the Gate 3 kickoff before bypass is granted (it replays all migrations from scratch, re-runs `seed.sql`, regenerates local auth users via the bootstrap migration, re-applies RLS policies).
- **Phase 0 is backend only.** No dashboard UI work in any gate of Phase 0. The new homepage visual port comes in a separate brief after the prototype is locked in a parallel Claude artifact on claude.ai.
- **Brief decisions resolved up-front (do not re-ask):** Scope Phase 0 only (Decision #1); skip Todoist bridge (Decision #2); deterministic SQL for Big Thing selection in Phase 0 (Decision #3); work in existing GAT-BOS repo (Decision #4); agent source is `~/Documents/Alex Hub(Obs)/wiki/agents/` (Decision #4 follow-up).

---

## 4. KNOWN ISSUES IN BLOCKERS.md (Phase 0 carry-forward only)

Listed in the order they appear at the top of `~/crm/BLOCKERS.md` `## Open` after commit `306c196`. One line each.

- **[2026-05-20] Local MCP server build required before manual claude.ai setup can complete.** Scope-then-build. Schema source: `capture-tool.ts`. Env: `INTERNAL_API_TOKEN` + `OWNER_USER_ID`. Contract: forward as `target/source/auth`. Phase 1 covers hosted-mobile variant.
- **[2026-05-20] Task System Phase 0 verb whitelist mirrored in 3 places.** SQL trigger, SQL rebuild function, `projected-verbs.ts`. Phase 1 consolidation candidate via codegen or Postgres lookup table.
- **[2026-05-20] Task System Phase 0 local dev DB drift from prior verification sessions.** Duplicate "Agent Partnerships" area (`ac7bd5c9-...` alongside seeded `a0000002-...`), 3 Julie cadence rows, 1 ad-hoc area from test 7. Defer cleanup to Gate 3 start via the local-reset bypass.
- **[2026-05-20] Multiple dev server instances during Gate 1 verification.** Three `next dev` instances bound to :3000, :3001, :3002 simultaneously during testing. Kill stale instances before deeper testing per Rule 17.

Non-Phase-0 entries in `BLOCKERS.md` are unrelated (Resend webhook, drafts route, Altos credentials, portal RPCs, several Slice 2B rebuild items, etc.) and are tracked by their own plumbing sessions.

---

## 5. FILE INVENTORY

Every file shipped in Phase 0 (across commits `70497e2`, `03983a0`, `306c196`). One line each.

**Migrations (in `~/crm/supabase/migrations/`):**

- `20260427000000_local_bootstrap_auth_user.sql` -- local-only auth.users + auth.identities row so slice7a accounts FK resolves on a fresh local stack; no-op on remote (ON CONFLICT DO NOTHING); production user provisioning still goes through Supabase Auth API.
- `20260520194801_task_system_phase0.sql` -- nodes / tags / node_tags / cadences / node_events tables with RLS, idempotent `IF NOT EXISTS`, `updated_at` triggers, projection trigger + rebuild function, 5 seeded Areas with stable UUIDs.
- `20260521003837_task_system_phase0_projection_walk_parent.sql` -- replaces trigger and rebuild function with walk-parent-one-step logic so relational types (interaction / event / task) populate `contact_id` and `project_id` for Gate 4 morning brief joins.

**TypeScript types (in `~/crm/src/lib/types/`):**

- `task-system.ts` -- Node, Tag, NodeTag, Cadence, NodeEvent interfaces; type enums (NodeType, TaskStatus, ProjectStatus, AreaStatus, ContactStatus, ContactTier); CaptureRequestBody / CaptureHints / CaptureInferred / CaptureWarning / TaskSystemCaptureResponse contracts; `TIER_TARGET_DAYS` constant (1=>7, 2=>14, 3=>30).

**TypeScript helpers (in `~/crm/src/lib/task-system/`):**

- `cadence.ts` -- `createCadence` (on contact insert), `touchCadenceForInteraction` (advances next_due_at).
- `infer-type.ts` -- Claude inference with fill-and-flag fallback to `type='task'` status='inbox'.
- `projected-verbs.ts` -- TypeScript mirror of the SQL trigger's verb whitelist. Used by future server-side adapters that need to predict whether a verb will project to node_events.
- `resolve-parent.ts` -- resolves `hints.contact / project / area` strings to existing node UUIDs by title (case-insensitive); appends warnings on miss.

**Anthropic tool definitions (in `~/crm/src/lib/claude-tools/`):**

- `capture-tool.ts` -- canonical `captureTool` (Anthropic `Tool` shape) for `capture_to_task_system`. `hints.type` enum excludes `area`; `hints.area` enum locked to the 5 fixed areas; `target` and `source` NOT exposed to the model. Typed `CaptureToolInput` export.

**Activity layer (in `~/crm/src/lib/activity/`):**

- `types.ts` modified -- added five new `capture.promoted.*` ActivityVerb members (`capture.promoted.task`, `capture.promoted.contact`, `capture.promoted.touchpoint`, `capture.promoted.event`) plus retained `capture.created`. These are the verbs the projection trigger keys on.

**Route changes (in `~/crm/src/app/api/`):**

- `captures/route.ts` modified -- POST handler now accepts `target: "captures" | "task_system"` discriminator. Default `target="captures"` preserves existing behavior verbatim. `target="task_system"` branch: bearer-OR-session auth, source/type/tier enum validation, type inference, parent resolution, area-writability 422 guard, cadence side-effects, writeEvent emission. ~370 lines added.

**Documentation (in `~/crm/docs/task-system/`):**

- `projection-rebuild.md` -- docs for the `rebuild_node_events_from_activity()` manual replay tool (when to run, side effects, idempotency guarantees).
- `claude-project-prompt.md` -- full system prompt for the Claude Project on claude.ai; schema overview, when to call vs not call, all 7 worked examples translated to tool-call JSON, Section 11 standing rules verbatim, voice + tone, failure-mode discipline.
- `setup.md` -- manual setup checklist for Alex on claude.ai; wiring options (MCP server vs webhook proxy); 3-capture test conversation; verification queries; HTTP-code-to-remediation table; Gate 3 entry conditions block at bottom; top-of-doc laptop-only disclaimer.
- `SESSION-HANDOFF-2026-05-20.md` -- this file.

**BLOCKERS.md additions (in `~/crm/`):**

- 4 new `## Open` entries at top of file (MCP server build required, verb whitelist mirrored in 3 places, local dev DB drift, multiple dev server instances).

**Memory updates (in `~/.claude/projects/-Users-alex/memory/`):**

- `project_task_system_phase_0.md` -- new project memory file with compressed pause state, commits, decisions, Gate 3 entry conditions.
- `MEMORY.md` modified -- new pointer line under `## Project (active)`.

---

## 6. STANDING RULES (re-state, do not paraphrase)

These apply to every gate of Phase 0 and to any future session resuming this work.

- **No em dashes anywhere, ever.** Code, comments, docs, commits, email copy. Use commas, periods, semicolons, or double hyphens ( -- ). Em-dash check hook is active and will block on violation.
- **Fill-and-flag missing inputs as `[PLACEHOLDER: description]`.** Never stop generation outside defined gates.
- **No hard deletes.** Soft-delete via status fields. The destructive-bash hook enforces this for SQL operations and DB resets.
- **Stack locked: Supabase, Vercel, Claude API, Resend.** No new tools. No Twilio, no Zapier, no Make, no n8n, no Pipedream.
- **Match existing GAT-BOS patterns first, invent second.** Capture endpoint extends `/api/captures`. Morning brief extends `/api/cron/morning-brief`. Bearer auth resolves via `OWNER_USER_ID`. Activity emits via `writeEvent`.
- **Existing system wins over handoff doc spec where they conflict.** Flag the conflict, propose reconciliation, stop. Do not silently build parallel systems.
- **Phase 0 is backend only.** No dashboard UI work. The new homepage visual port comes in a separate brief after the prototype is locked.
- **Local-first for migrations and route work. No remote pushes until Alex explicitly approves.** No `git push`. No PR open. No Vercel deploy.
- **Gate report is the checkpoint.** Stop at every gate. Do not chain across stop gates without explicit approval from Alex.

---

## 7. RESUMPTION PROMPT

Ready-to-paste prompt for opening a fresh Claude Code session.

```
Resuming GAT-BOS Task System Phase 0 work after pause at end of Gate 2.

REPO: ~/crm/ (GAT-BOS, Next.js 14 + Supabase + Vercel + Resend)
BRANCH: task-system-phase-0 (local, never pushed)
LAST COMMITS: 70497e2 (Gate 1), 03983a0 (Gate 2), 306c196 (pause-state docs)

PRIMARY HANDOFF DOC: ~/crm/docs/task-system/SESSION-HANDOFF-2026-05-20.md
ARCHITECTURAL SPEC: ~/Downloads/gatbos-task-system-handoff.md
EXECUTION PLAYBOOK: ~/Downloads/CLAUDE-CODE-BRIEF.md
PROJECT MEMORY: ~/.claude/projects/-Users-alex/memory/project_task_system_phase_0.md

FIRST ACTIONS:

1. Read ~/crm/docs/task-system/SESSION-HANDOFF-2026-05-20.md in full.
2. Read ~/crm/CLAUDE.md, ~/crm/BUILD.md, ~/crm/BLOCKERS.md to load current
   standing rules and any updates that landed between sessions.
3. Run git status and git log --oneline -10 on ~/crm/ to confirm branch
   state matches the handoff.

IMMEDIATE NEXT STEP:

The MCP server build is the gate. Phase 0 capture cannot reach Supabase
until a local MCP server forwards Claude Project tool calls from
claude.ai to http://localhost:<port>/api/captures with bearer
INTERNAL_API_TOKEN. Tool schema lives at
~/crm/src/lib/claude-tools/capture-tool.ts (captureTool constant).

I have not decided whether this is its own micro-gate (Gate 2.5) or
rolls into Gate 3 prep. Open with a scoping conversation, not code.

After MCP server lands:
- I run the manual claude.ai Project setup per ~/crm/docs/task-system/setup.md
- After 3-capture test passes, Gate 3 (seed 25 agents from Obsidian wiki)
- Then Gate 4 (extend /api/cron/morning-brief), then Gate 5 (closeout)

STANDING RULES (full text in handoff doc Section 6):
- No em dashes anywhere
- Fill-and-flag missing inputs
- No hard deletes
- Stack locked: Supabase, Vercel, Claude API, Resend
- Match existing GAT-BOS patterns first
- Existing system wins over handoff doc spec on conflict
- Local-first, no remote pushes without explicit approval
- Phase 0 is backend only
- Stop at every gate

LOCKED DECISIONS (full text in handoff doc Section 3, compressed here):
- events table renamed to node_events (collision with public.events)
- activity_events canonical, node_events projection via AFTER INSERT
  trigger with verb whitelist, walks parent_id one step
- Morning brief extends existing /api/cron/morning-brief route
- Capture endpoint extends /api/captures (plural) with target field
- Bearer auth via OWNER_USER_ID env (existing convention)
- 5 Areas seeded with stable UUIDs a0000001 through a0000005
- Areas fixed at 5, route returns HTTP 422 on attempted create
- Cadence side-effects in app layer, NOT in trigger
- Local MCP for Phase 0, hosted MCP for mobile is Phase 1
- Triple-mirrored verb whitelist accepted as Phase 0 debt
- destructive-bash hook bypass for the local Postgres replay command:
  pre-approved by Alex for one command only, request explicitly at
  Gate 3 kickoff
- Phase 0 is backend only, no dashboard UI

DO NOT:
- Push to remote
- Open a PR
- Deploy
- Start Gate 3 before MCP server lands + manual claude.ai setup
  completes + 3-capture test passes
- Re-ask any decision listed in the handoff doc Section 3

Report current state per the handoff doc Section 1, then propose the
MCP server scope conversation before any code or DB work.
```

---

## 8. CONTEXT FRESHNESS WARNING

Standing rules and project state can change between sessions. Before treating this handoff as canonical, a resuming session must:

1. Read `~/CLAUDE.md` and `~/.claude/rules/standing-rules.md` -- the auto-loaded global rules may have been updated.
2. Read `~/crm/CLAUDE.md` and `~/crm/BUILD.md` -- the repo-local standing rules and current build state may have been updated.
3. Read `~/crm/BLOCKERS.md` top entries -- newer blockers may have landed.
4. Check `git log --oneline -10` on `task-system-phase-0` -- additional commits may have landed (e.g. a separate session built the MCP server, or amended a Phase 0 commit).
5. Read `~/.claude/projects/-Users-alex/memory/MEMORY.md` and the project memory file -- decisions or new feedback may have been captured.

If any of those sources contradict this handoff, the newer source wins. This handoff is a snapshot frozen at the moment of `306c196`. Phase 0 progress, decisions, and rules may have moved forward.

The brief explicitly says: "Alex wins over the handoff doc, the handoff doc wins over your training." This applies here. Alex's current-conversation directives override anything in this file. This file overrides the brief on current-state only; the brief still owns gate structure and the architectural spec still owns architectural intent.

---

Remaining placeholders in this file: none. Tokens like `[PLACEHOLDER: description]` appearing above are meta-references to the standing fill-and-flag rule, not actual unresolved gaps in this handoff.
