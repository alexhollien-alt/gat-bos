# AGENTS.md

One-page contract for any AI agent (Claude, Cursor, GPT, Gemini, or human) working in this repo. Load this first.

For depth, read `~/crm/docs/architecture/` (eight docs, start with `EXECUTIVE_SUMMARY.md`).

---

## Stack (locked)

- Next.js 14 (App Router), TypeScript strict
- Tailwind CSS v3, shadcn/ui v4
- Supabase (Auth + Postgres + Realtime + Storage)
- Anthropic Claude API (`@anthropic-ai/sdk`)
- Resend (transactional email)
- Google APIs (Gmail + Calendar via `googleapis`)
- OpenAI (Whisper transcription only)
- pnpm only. Never `npm` or `yarn`.
- Vitest 4 + Playwright 1.59 (smoke scripts in `scripts/`).

Vercel for deploy. Crons declared in `vercel.json`. No managed Vercel storage (KV / Blob / Edge Config).

---

## Hard rules

1. **Read-only on the 7A.5 perimeter.** Migrations, RLS, `tenantFromRequest`, the three Supabase clients, `api-auth.ts`, `writeEvent.ts`, `rate-limit/check.ts`, `ai/_budget.ts`, `captures/actions.ts`. Document and surface; do not auto-fix.
2. **No new migrations** without explicit Alex approval. Slice 7A.5 owns the migration ledger.
3. **No hard deletes.** Multi-tenant tables have `deleted_at`. Soft-delete always. Exception: `rate_limits` (operational, time-bounded).
4. **No em dashes** in any output (code, docs, comments, copy). Use commas, periods, semicolons, or double hyphens (` -- `). Per Standing Rule 2.
5. **No banned providers.** No Twilio / SMS, no Zapier / Make / n8n, no Stripe, no Sentry / PostHog / Datadog, no Vercel KV / Blob / Edge Config, no Mailerlite. If a request needs one, surface the conflict.
6. **No reintroducing extinct patterns.** No `OWNER_USER_ID` env var, no `ALEX_EMAIL` constant, no email-based RLS, no `material_requests` / `deals` / `follow_ups` / spine table reads. All renamed or dropped in Slices 1-7A.
7. **pnpm only.** `npm install` and `yarn add` are bugs.
8. **No commits without explicit ask.** Local edits accumulate; Alex commits on his schedule.

---

## File / folder cheat sheet

```
~/crm/
├── src/
│   ├── app/
│   │   ├── (app)/             authenticated routes
│   │   ├── (auth)/            login, signup
│   │   ├── api/               30 route.ts handlers (cron, webhook, internal)
│   │   ├── agents/[slug]/     public agent landing pages
│   │   └── intake/            public intake form
│   ├── components/
│   │   ├── ui/                shadcn primitives
│   │   ├── screen/            custom showcase-tier library
│   │   └── <feature>/         15 feature buckets
│   ├── lib/
│   │   ├── supabase/          {admin, server, client}.ts
│   │   ├── auth/              tenantFromRequest.ts (single resolver)
│   │   ├── activity/          writeEvent.ts (only sanctioned ledger writer)
│   │   ├── ai/                _client.ts + _budget.ts + _cache.ts + capabilities
│   │   ├── messaging/         send.ts + adapters/{resend, gmail}
│   │   ├── captures/          rules.ts + actions.ts (5-target promote state machine)
│   │   ├── hooks/             post-creation.ts dispatcher + isolated handlers
│   │   ├── rate-limit/        check.ts + extract-ip.ts
│   │   ├── gmail/             oauth.ts + sync-client.ts
│   │   ├── calendar/          client.ts
│   │   ├── intake/            process.ts
│   │   ├── api-auth.ts        Bearer + cron + session gates
│   │   └── <entity>/          standardized actions.ts/queries.ts/types.ts shape (8+ dirs)
│   └── middleware.ts          public-route bypass + session refresh
├── supabase/
│   ├── migrations/            91 timestamped SQL files (7A.5 OFF-LIMITS)
│   └── seed.sql, schema.sql   reference
├── docs/
│   ├── architecture/          this pass: 9 docs (system-map, data-flow, auth-flow, etc.)
│   └── *.md                   13 pre-existing feature docs
├── scripts/                   59 smoke + debug + seed scripts
├── vercel.json                9 cron declarations
├── BUILD.md                   currently-building + Built history
├── BLOCKERS.md                open broken integrations
├── ROADMAP.md                 Phase 1-4 multi-quarter
├── SCHEMA.md                  per-table tier + status
├── CLAUDE.md                  per-repo Claude Code rules
└── README.md                  public-facing (somewhat stale, needs Phase 1.x refresh)
```

---

## Build commands

```bash
cd ~/crm
pnpm install                 # if dependencies changed
pnpm dev                     # local dev server
pnpm typecheck               # tsc --noEmit
pnpm lint                    # next lint
pnpm build                   # next build
pnpm test                    # vitest run
pnpm test:watch              # vitest watch
```

---

## Verify-before-done gate (mandatory)

Per CLAUDE.md, before claiming any change is done:

```bash
cd ~/crm && pnpm typecheck && pnpm build
```

Both must pass. Also `pnpm lint` if you touched anything within ESLint scope (`src/app/**`, `src/components/**`).

If you touched routing or middleware, also confirm dev server: `pnpm dev` and load the affected route.

If you touched a Server Component or Client Component boundary, open the page in a browser. Typecheck does not catch all SC/CC mistakes.

---

## Plan / Lock / Execute (GSD inside ~/crm/)

Inside this repo, GSD replaces `/lock`:

1. `/gsd-plan-phase` emits a phase plan block.
2. **Stop.** Wait for Alex's literal "lock it" or "go".
3. `/gsd-execute-phase` runs the locked plan.

`.planning/config.json` enforces interactive mode + no auto-advance. Every phase transition is manual.

For paths outside `~/crm/`, `/lock` still applies.

---

## When you hit a broken integration mid-build

Per CLAUDE.md "Build vs Plumbing protocol":

1. Fill-and-flag: hardcode a fallback so the build can continue.
2. Append a row to `BLOCKERS.md` with timestamp, what's broken, where it lives, what's needed.
3. Move on with the build.
4. A future plumbing session resolves the blocker.

Do not refactor adjacent systems mid-build.

---

## Data integrity invariants

- **Every server side effect emits an `activity_events` row** via `writeEvent({userId, actorId, verb, object, context})`. Verbs from `ActivityVerb` union (`src/lib/activity/types.ts`, 40 verbs).
- **Every API route resolves tenant via `tenantFromRequest(req, opts?)`.** User path returns `{userId, accountId}`. Service path requires `opts.service` and returns `{kind:'service', reason}` -- caller MUST scope rows manually.
- **Every Anthropic call goes through `callClaude()`** (`src/lib/ai/_client.ts`). Composes budget guard + prompt cache + retry + `ai_usage_log` write.
- **Service-role queries (`adminClient`) MUST scope by `user_id` or `account_id`.** RLS does not save you.
- **Public routes are rate-limited.** `/api/intake` (10/5min), `/api/captures` (30/60s), `/api/captures/[id]/process` (20/60s).
- **The Resend webhook is intentionally NOT rate-limited.** Svix HMAC is the boundary.

---

## Where the docs live

| Doc | Purpose |
|---|---|
| `docs/architecture/system-map.md` | Module map + route tree + dependency graph |
| `docs/architecture/data-flow.md` | 9 traced end-to-end flows with Mermaid diagrams |
| `docs/architecture/auth-flow.md` | Middleware + tenantFromRequest + RLS philosophy |
| `docs/architecture/dependency-analysis.md` | External integrations + internal cross-module imports + god-file scan |
| `docs/architecture/technical-debt-hotspots.md` | P0/P1/P2/P3 debt with DO NOT AUTO-FIX banners |
| `docs/architecture/ai-agent-guide.md` | Cold-start orientation: where to find X, conventions, deprecated patterns |
| `docs/architecture/EXECUTIVE_SUMMARY.md` | Top-of-funnel summary (start here for handoff) |
| `docs/INDEX.md` | The pre-existing 13-doc feature reference |
| `BUILD.md`, `BLOCKERS.md`, `ROADMAP.md`, `SCHEMA.md` | Operational state |
| `CLAUDE.md` | Per-repo Claude Code rules |
| `PROJECT_CONTEXT.md` | Business + product framing |

---

## Escalation

- **Anything inside the 7A.5 perimeter** (auth, RLS, migrations, tenant scoping, captures/actions, activity_events, rate-limit, AI budget): document, do not auto-fix. Surface to Alex.
- **Schema change request**: don't write a migration. Surface to Alex with a clear ask, including the consumer code that would benefit.
- **Banned-provider request** (Twilio, Zapier, etc.): surface conflict; do not introduce.
- **Em dash slip**: hooks at `~/.claude/hooks/em-dash-check.sh` will block the write. Use ` -- `.
- **External LLM audit dump**: per Standing Rule 16, dispatch an Explore agent to verify before acting. Do not trust pasted external audits directly.

---

End of contract. Read `docs/architecture/EXECUTIVE_SUMMARY.md` next.
