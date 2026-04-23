# CLAUDE.md -- GAT-BOS CRM

CRM-specific build rules and implementation details.
Brand tokens, screen aesthetic, and design logic live in the global rules.

---

## Pointers

- Brand tokens (colors, fonts, voice): `~/.claude/rules/brand.md`
- Screen aesthetic (depth, motion, components): `~/.claude/context/digital-aesthetic.md`
- Design logic (image audit, data models): `~/.claude/context/design-foundation.md`

---

## Stack

- Next.js 14 (App Router), Tailwind v3, shadcn v4, TypeScript
- pnpm only. Never npm or yarn.
- Supabase: `NEXT_PUBLIC_` prefix. Verify `.env.local` before auth/db code.
- Verify before done: `cd ~/crm && pnpm typecheck && pnpm build` -- every change must pass both.

---

## Tailwind Class Mapping (Kit Screen)

Canonical font classes tied to CSS variables in `app/globals.css`:

| Class | CSS variable | Font |
|-------|--------------|------|
| `font-display` | `--font-display` | Syne |
| `font-sans` | `--font-sans` | Inter (body default) |
| `font-mono` | `--font-mono` | Space Mono |

Use the Tailwind classes. Never hardcode font families in components.

---

## globals.css Utility Classes

Available classes, do not redeclare in component styles:

| Class | Purpose |
|-------|---------|
| `.glass-surface` | Frosted glass card (showcase tier) |
| `.glow-card` | Soft glow card with hover lift (showcase tier) |
| `.showcase-card` | Showcase tier card wrapper |
| `.headshot-mask` | Standard gradient-masked headshot |
| `.headshot-mask-hero` | Hero-size gradient-masked headshot |
| `.headshot-mask-sm` | Small (< 64px) gradient-masked headshot |

Deprecated (do not use): `.mesh-bg`, `.noise-overlay`, `.showcase-mesh`, `.showcase-noise`. Use real photography with text overlays instead.

---

## Motion

`prefers-reduced-motion: reduce` lives in `app/globals.css`. Do not duplicate it at the component level.

Workspace tier: hover/transition only, under 200ms. No keyframes on workspace content.
Showcase tier: full motion system per `digital-aesthetic.md`.

---

## Auth + Middleware

- Auth middleware lives at `middleware.ts`. New public routes (`/intake`, `/materials`, etc.) must be added to the bypass list.
- API routes under `/api/*` must be excluded from the `/login` redirect so clients receive JSON 401s instead of HTML.
- Always run typecheck after middleware changes.
- After any routing or middleware change, run (or restart) `pnpm dev` directly to confirm routes load.

---

## SQL + Migrations

- SQL migrations: idempotent, `DROP IF EXISTS` before `CREATE`.
- Verify live Supabase schema before writing migrations (columns, enums, array syntax).

---

## Assets

- WebP format preferred for all web images (not for email).
- Every landing page: JSON-LD schema markup + Open Graph meta tags.

---

## GSD Protocol (CRM only)

Inside `~/crm/`, GSD (`get-shit-done`) replaces `/lock` as the execution protocol. Outside `~/crm/`, `/lock` still owns every path.

- Use `/gsd-plan-phase` instead of `/lock`. It emits a phase plan block.
- After the plan block prints, stop. Wait for Alex to type "lock it" or "go" before running `/gsd-execute-phase`. This is the Rule 5 gate inside GSD.
- `.planning/config.json` sets `mode: interactive` and `workflow.auto_advance: false` so every phase transition requires explicit Alex approval.
- Do not run `/gsd-new-project` until Gmail MVP 1.3.1 ships. The plan at `~/.claude/plans/gat-bos-1.3.1-gmail-mvp.md` is the current active plan and GSD project bootstrap would collide with it.
- Design deliverables (re-print-design, re-email-design, re-landing-page, re-listing-presentation, listing-pipeline, canva-handoff) keep three-draft gates per Rule 6 and stay outside GSD. Those skills do not fire inside `~/crm/` anyway.
- Rollback: `cd ~/crm && git reset --hard pre-gsd-2026-04-19` plus `rm -rf ~/crm/.planning ~/crm/.claude/get-shit-done ~/crm/.claude/hooks/gsd-*` and settings.json revert.

---

## Architecture Notes (Slice 1+)

`activity_events` is the canonical write target for all user-observable actions from Slice 1 onward.
Every server-side write path emits an event via `writeEvent()` from `src/lib/activity/writeEvent.ts`.
Do not add new writes to spine tables (spine_inbox, commitments, signals, focus_queue, cycle_state) --
they are deprecated as of Slice 1 and will be dropped in Slice 2.
The contact detail page reads its Activity Feed from `getContactTimeline()` in `src/lib/activity/queries.ts`.

---

## Build vs Plumbing Protocol

Every session in this repo begins by classifying the work and reading two files at repo root: `BUILD.md` (what we're building) and `BLOCKERS.md` (broken integrations waiting for a dedicated fix).

### Session start

1. Ask (or infer from the prompt): **build or plumbing?**
   - **Build** = new product surface, feature work, UI, copy. Proceeds against `BUILD.md`.
   - **Plumbing** = migrations, schema fixes, auth, middleware, integrations, resolving items from `BLOCKERS.md`.
2. Read `BUILD.md` (current build + what's shipped) and `BLOCKERS.md` (open items).
3. Do not mix. A build session does not resolve plumbing; a plumbing session does not ship new UI. If a build session hits a broken integration, **fill-and-flag** (hardcode a fallback, log to `BLOCKERS.md`) and keep building.

### During a build session

- When a missing table column, unverified Supabase view, unreachable API, or unwarmed email sender blocks progress, log it to `BLOCKERS.md` with a timestamp, what's broken, where it lives (file/line), and what's needed to fix it. Then hardcode a fallback and keep going.
- Do not refactor, build new skills, or audit adjacent systems mid-session. If an urge surfaces, write a line to `LATER.md` (create at repo root if missing) and return to the current build.

### Session end

- Update `BUILD.md`: move anything completed this session into `## Built` with the date. Keep `## Currently Building` reflecting the next step's exact state.
- Any new blockers logged this session stay in `BLOCKERS.md` `## Open` until a dedicated plumbing session resolves them. Resolutions move to `## Resolved` with the date and the commit that closed them.
- `/clear` before the next session so the protocol question fires fresh.

### Resolving blockers

A plumbing session picks one item (or a small cluster) from `BLOCKERS.md` `## Open`, fixes the underlying integration (migration, env var, auth config), removes the hardcoded fallback at the flagged file/line, verifies `pnpm typecheck && pnpm build`, and moves the item to `## Resolved`.
