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
