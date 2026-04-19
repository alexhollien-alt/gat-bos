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
