# CLAUDE.md -- Alex Hollien
# Title Sales Executive, Great American Title Agency, Phoenix Valley

Not a realtor. My clients are realtors. I am their one-person marketing department.

---

## Rules (auto-loaded from .claude/rules/)

| File | What It Contains |
|------|-----------------|
| ~/.claude/rules/routing.md | **Read first, every request.** Classify-first router: 4-field classification, disambiguation, hat resolution. Routes to skills + rule packs. Classification is internal -- HAT block recited only on request. |
| standing-rules.md | Fill-and-flag, no em dashes, no hard deletes, no scraping, approval gates, copy standards, co-brand rules, lender scoping, referral handle (canonical rule text; loaded as packs via the router) |
| brand.md | Colors (#b31a35, #003087, full palette), font kits, voice tokens, agent palettes, co-brand rules |
| design-foundation.md | Shared design logic, components, image audit, price tiers, brokerage adaptation, validation checks |
| digital-aesthetic.md | Screen aesthetic v2: showcase/workspace tiers, Syne+Inter+Space Mono, motion budgets, headshot gradient masks |
| dashboard.md | GAT-BOS dashboard architecture contract: stack lock (shadcn+TanStack+dnd-kit), bento grid, Today View, Supabase Realtime + TanStack Query hybrid, accessibility floor |
| leverage-patterns.md | Session optimization, think modes, model selection, context efficiency |

---

## How to Work With Me

1. Confirm before building. Tell me what, where, and how. Wait for OK.
2. Build in order. Phase 1 before Phase 2. If blocked, stop and tell me.
3. Right directory. CRM: `~/crm/`. Skills: `~/.claude/skills/`. Output: `~/Desktop/` or specified path.
4. Use templates as provided. The template is the spec.
5. Stay on task. Finish the assignment, then offer extras.
6. Session start: read `~/.claude/memory/recent-memory.md` and `~/.claude/memory/project-memory.md`.
7. Long-term context: read `~/.claude/memory/long-term-memory.md` on demand when you need facts, decisions, preferences, or people context.
8. Session end: when Alex says "wrap up" or runs /learn, update project-memory.md if project state changed.

---

## Routing -- classify first, then build

**Do not match keywords straight to skills.** Every request goes through the
classify-first router before any output:

1. `~/.claude/rules/routing.md` -- classify into four fields (client, output, channel,
   mode), disambiguate overloaded words, resolve the hat, then build (classification is
   internal; the HAT block is recited only on request). It also carries the
   controlled vocabularies + disambiguation table and the **single** map of
   classification -> hat -> rule packs + skill. This is where the old keyword->skill table moved (re-print-design,
   re-email-design, re-landing-page, re-listing-presentation, re-marketing,
   canva-handoff, listing-pipeline, agent-bd, agent-strategy-session,
   cypher-ticket-builder, agent-creative-brief, morning/end-of-day-briefing,
   research-assistant, and the quality/review skills).

Why: "marketing" and "flyer" do not identify a route by themselves -- the same skill
serves an agent and serves Alex under different rules. The router resolves *who/what/
where/how* first so only the matching rule packs load.

---

## Source Files (read on demand, not auto-loaded)

| File | When | Path |
|------|------|------|
| Recent Memory | Session start | ~/.claude/memory/recent-memory.md |
| Project Memory | Session start | ~/.claude/memory/project-memory.md |
| Long-term Memory | On demand | ~/.claude/memory/long-term-memory.md |
| Obsidian Wiki Master Index | Agent/market/design/relationship context | ~/Documents/Alex Hub(Obs)/wiki/_master-index.md |
| Knowledge Base Index (legacy) | Before KB queries, pre-Obsidian | ~/.claude/knowledge-base/wiki/_master-index.md |
| Strategy Context | Before strategic/BD output | ~/STRATEGY-CONTEXT.md |
| Design Tokens | Before visual output | skills/design-tokens/SKILL.md |

---

## Knowledge Wiki

When you need agent context, design history, personality profiles, market data, or relationship status, read from the Obsidian wiki at:
`~/Documents/Alex Hub(Obs)/wiki/`
Start at `_master-index.md`. Follow links. Load only what the job needs.

---

## Build and Dev (CRM at ~/crm/)

- **pnpm only.** Never npm or yarn. Use pnpm for all package management in this project.
- CRM: Next.js 14, Tailwind v3, shadcn v4. New projects: Tailwind v4.
- Check package.json before assuming dependency versions.
- Supabase vars: `NEXT_PUBLIC_` prefix. Verify `.env.local` before auth/db code.
- SQL migrations: idempotent, DROP IF EXISTS before CREATE.
- MCP servers go in `~/.mcp.json`, not `settings.json`.
- WebP format preferred for all web images (10x lighter than PNG, no quality loss). Not for email.
- Every landing page includes JSON-LD schema markup (RealEstateAgent, RealEstateListing).
- Every landing page includes Open Graph meta tags for social sharing.

---

## Execution Style

- When a dev server or command needs to run, execute it directly rather than telling the user to run it. Do not hand back shell snippets for things you can run yourself.

---

## Safety Rules

- Never use `sed` pipelines for multi-line file edits. Use the Edit tool instead. `sed` is allowed only for single-line, single-file, reversible transforms.

---

## Architecture / Auth

- API routes under `/api` must be excluded from auth middleware redirects to `/login`. Middleware matchers must skip `/api/*` so API clients receive JSON 401s instead of HTML redirects.
