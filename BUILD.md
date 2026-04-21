# BUILD.md

What we're building. Read at session start alongside `BLOCKERS.md`. Update at session end.

---

## Currently Building

**Session 3 -- Fiona Bigbee + one more A-tier agent on the same `/agents/[slug]` pattern.**

Next step: pick the third A-tier agent, add their records to the hardcoded `AGENTS` const in `src/app/agents/[slug]/page.tsx` (alongside Julie), drop their headshots into `/public/agents/`, and verify both pages render locally. Referral footer stays Option B (agent-forward) unless Alex flips it. After Session 3, Session 4 builds the Resend announcement email linking to the three live pages.

Pre-session-3 decisions pending:
- Third A-tier agent pick (Amber? Denise? Chase?).
- Whether to resolve Blocker #1 (`contacts.slug/photo_url/tagline` migration) before Session 3 so Fiona + #3 ship DB-backed, OR keep hardcoding and batch the migration as plumbing after Session 4.

---

## Built

- [2026-04-21] Build vs Plumbing Protocol installed in `CLAUDE.md`. `BUILD.md` + `BLOCKERS.md` seeded at repo root.
- [2026-04-21] **Session 2** -- `/agents/[slug]` dynamic route live locally. Middleware public-route bypass extended to `/agents/`. Layout at `src/app/agents/[slug]/layout.tsx` (GAT-wrapped public shell, Kit Screen fonts, dark screen palette). Page at `src/app/agents/[slug]/page.tsx` renders hero + about + gallery-empty-state + contact + referral footer (Option B, agent-forward). Julie hardcoded in `AGENTS` const with temp headshot fallback + `[PLACEHOLDER]` tagline. JSON-LD RealEstateAgent schema + Open Graph metadata wired per SEO minimum. `pnpm typecheck` PASS, `pnpm build` PASS with `/agents/[slug]` prerendered as SSG at `/agents/julie-jarmiolowski`. Three blockers logged (see `BLOCKERS.md`).
