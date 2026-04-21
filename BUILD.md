# BUILD.md

What we're building. Read at session start alongside `BLOCKERS.md`. Update at session end.

---

## Currently Building

**Session 4 -- Resend announcement email linking to the three live `/agents/<slug>` pages.**

Taglines + Julie headshot shipped today (part 1 of Session 4). Still ahead: re-email-design (Kit 1 -- Instrument Serif + Inter), three agent cards linking to `gat-bos.vercel.app/agents/{julie-jarmiolowski|fiona-bigbee|denise-van-den-bossche}`, three-draft approval gates, then practice-send to the target address Alex confirms at Draft 1.

---

## Built

- [2026-04-21] Build vs Plumbing Protocol installed in `CLAUDE.md`. `BUILD.md` + `BLOCKERS.md` seeded at repo root.
- [2026-04-21] **Session 2** -- `/agents/[slug]` dynamic route live locally. Middleware public-route bypass extended to `/agents/`. Layout at `src/app/agents/[slug]/layout.tsx` (GAT-wrapped public shell, Kit Screen fonts, dark screen palette). Page at `src/app/agents/[slug]/page.tsx` renders hero + about + gallery-empty-state + contact + referral footer (Option B, agent-forward). Julie hardcoded in `AGENTS` const with temp headshot fallback + `[PLACEHOLDER]` tagline. JSON-LD RealEstateAgent schema + Open Graph metadata wired per SEO minimum. `pnpm typecheck` PASS, `pnpm build` PASS with `/agents/[slug]` prerendered as SSG at `/agents/julie-jarmiolowski`. Three blockers logged (see `BLOCKERS.md`).
- [2026-04-21] **Session 4 part 1** -- Taglines J1/F1/D1 patched into `AGENTS` const in `src/app/agents/[slug]/page.tsx` (Julie: Optima Camelview resident-realtor line; Fiona: 85258 backyard line; Denise: Paradise Valley + Scottsdale discretion line). Julie real headshot resolved and wired at `/public/agents/julie-jarmiolowski.jpg` (800×798 JPEG, 179KB). Blockers #2, #3, #5 closed. `pnpm typecheck` PASS, `pnpm build` PASS, commit + prod deploy + smoke pending on same turn. Remaining in Session 4: Resend announcement email via `re-email-design` three-draft gates, practice-send only.
- [2026-04-21] **Session 3** -- Fiona Bigbee + Denise van den Bossche added to `/agents/[slug]` alongside Julie. Third-agent pick: Denise (tiebreaker: active Organic-Luxe brochure work = live content, not placeholder rows). Migration call: hardcode, batch contacts migration as post-Session-4 plumbing. `AgentRecord` type tightened (phone/website nullable) with conditional render in the contact block; CONTACT.md for both Fiona + Denise lists email only. "About Julie" eyebrow made dynamic (`About {firstName}` + `Work with {firstName}`). Headshots staged to `/public/agents/{fiona-bigbee,denise-van-den-bossche}.jpg` (JPEG 900w q85 via sips). Julie headshot stays on temp fallback (Blocker #3, scoped to Session 4 prep). `pnpm typecheck` PASS, `pnpm build` PASS -- all three routes prerender as SSG. Commit `7fc593e`, deploy `dpl_E8FFAyDYAKUJaqZmAZvvcp8smdHu` aliased to `gat-bos.vercel.app`. Prod smoke: all three routes HTTP 200 with correct `<title>` + `RealEstateAgent` JSON-LD; both new headshot assets resolve at `/agents/*.jpg`. New blockers: #4 (Fiona+Denise phone/website missing from CONTACT.md), #5 (Fiona+Denise taglines pending copy).
