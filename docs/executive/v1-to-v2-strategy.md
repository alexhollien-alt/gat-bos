# v1.0 to v2.0 Strategy

Explicit cut-line between v1.0 and v2.0. What ships in v1.0 vs what waits. The reasoning is "what does Alex need to operate the CRM end-to-end with 5 seeded agents, with email send live, with a working partner portal" -- v1.0 -- vs "what scales the operation to 25+ agents and a multi-format content engine" -- v2.0.

## v1.0 cut-line definition

v1.0 ships when:

1. Slice 7A.5 closed, registry clean, hygiene gate live.
2. Slices 7B and 7C shipped. 5 seeded agents addressable; agent portal live with magic-link auth.
3. Resend wiring live; campaign-runner cron sending; message_events ingesting.
4. Inbound email auto-link, cold-leads MV + Today widget, property address auto-populate all landed.
5. task-list.tsx refactor done.
6. Skill telemetry monthly digest cadence active; at least 2 consolidation clusters shipped.
7. Three trial closures (impeccable, design-intelligence, design-critique) decided and logged.
8. Migration registry hygiene gate enforcing.

Target window: end of July 2026 per `next-90-days-roadmap.md`.

## v2.0 cut-line definition

v2.0 ships when:

1. Slice 8A content engine live. content_calendar, social_posts, podcast_episodes all shipping content.
2. Slice 8B referrals + post-event automation live. Referral attribution working; post-event drips firing.
3. Derivative AI pipeline live. Long-form to short-form generation in agent voice; cost bounded by Slice 6 AI budget guard.
4. Reactivation automation live. Cold-leads MV feeds drip enrollment; escalation to Alex on second cold cycle.
5. Template versioning + draft re-render landed.
6. Calendar attendee-staleness flag-and-prompt landed.
7. The remaining hotspot refactors complete (intake, contacts/[id], analytics).

Target window: end of December 2026.

---

## v1.0 inclusion list (with reasoning)

### Critical chain

| Item | Why v1.0 |
|------|---------|
| Slice 7A.5 | Blocks everything else. Without clean migration registry, no schema work proceeds. |
| Slice 7B | Multi-tenant contacts + agent seeding is the foundation of every partner-facing surface. |
| Slice 7C | Agent portal is what makes the demo a product. Without it, every agent interaction routes through Alex. |

### Email + automation

| Item | Why v1.0 |
|------|---------|
| Resend wiring live | The largest dark surface in the system. Cannot launch v1.0 with email send dark. |
| Slice 5A campaign-runner activated | Already built; activates at Resend wiring. |
| Slice 5B touchpoint reminder activated | Already built; activates at Resend wiring. |
| Inbound email auto-link | Closes a per-draft retyping loop. Feeds health-score pipeline. |

### Surfaces + intelligence

| Item | Why v1.0 |
|------|---------|
| Cold-leads MV + Today widget | Tier-1 dashboard surface per dashboard architecture doc. Currently a roadmap gap. |
| Property address auto-populate | Eliminates a per-opportunity retype. |
| task-list.tsx refactor | Sets the pattern for the other three hotspots. Reduces blast radius on every future task change. |

### Hygiene + polish

| Item | Why v1.0 |
|------|---------|
| Migration registry hygiene gate | Prevents 7A.5 from recurring. |
| Skill telemetry monthly digest | Drives consolidation. Lower ambient context cost on every session. |
| Trial closures (impeccable, DI, design-critique) | Three trials should not run forever. Decisions inform the v1.0 design pipeline. |
| Re-* design skill post-output logging verified | Closes the 6-skill logging gap from 2026-04-19. |
| Tool-routing reflex prompt audit | Reinforces Standing Rule 23 muscle memory. |

---

## v2.0 deferral list (with reasoning)

### Content engine

| Item | Why not v1.0 |
|------|---------------|
| Slice 8A (content_calendar, social_posts, podcast_episodes) | Speculative until v1.0 metrics confirm content is the next constraint. |
| Long-form to short-form derivative pipeline | Depends on 8A schema. AI cost is bounded but not free. |
| Asset performance attribution | Depends on Resend engagement data soaking for ~3+ months. |

### Referrals + events

| Item | Why not v1.0 |
|------|---------------|
| Slice 8B (referrals table, post-event automation) | Roadmap gap names this as Q4 territory. RSVP/attendance schema currently missing. |
| Sponsor association | Builds on 8B referrals + events. |
| Reactivation drip automation | Cold-leads MV (v1.0) provides input. Drip itself is v2.0. |

### Polish + advanced

| Item | Why not v1.0 |
|------|---------------|
| Template versioning + draft re-render | v1.0 ships with hand-curated templates. Versioning earns its keep at the second or third sweep. |
| Calendar attendee-staleness flag | Silent failure mode; not blocking. |
| Captures fuzzy-match fallback | Same; silent failure mode. |
| Health-score refresh queue | Today's volume does not stress the per-event trigger. Becomes important at scale. |
| intake/page.tsx, contacts/[id]/page.tsx, analytics/page.tsx refactors | Each gets cheaper after task-list.tsx sets the pattern. v2.0 timeline is more comfortable. |

### Speculative

| Item | Why not v1.0 |
|------|---------------|
| Voice memo transcription pipeline | Captures rules parser is text-only today; AI parser is opt-in flag. Voice transcription is a separate build. |
| Contact enrichment pipeline | Phase 4 territory per `dashboard-architecture.md`. |
| Per-account health scoring (vs global) | 7C ships account_id; per-account health is a v2.0 polish. |
| Email-to-deal attribution | Requires campaigns and deals to coexist with stable engagement data. |

---

## What changes between v1.0 and v2.0

### Operating model

v1.0: Alex runs the CRM with 5 seeded agents. Agent portal lets agents see their own surfaces but Alex still drives marketing production. Content is hand-produced (Weekly Edge, podcast, social).

v2.0: Agent portal is the partner front door for ~25+ agents. Content engine produces derivatives at marginal cost. Referral + post-event automation runs without Alex's intervention. Reactivation drips fire on the cold-leads MV.

### Data shape

v1.0: contacts (multi-tenant), opportunities, deals, projects, project_touchpoints, email_drafts, events, captures, activity_events, agent_relationship_health.

v2.0 adds: content_calendar, social_posts, podcast_episodes, referrals, account_members (for multi-user accounts beyond Alex), event_attendees / event_rsvp.

### Stack

No stack changes between v1.0 and v2.0. Both versions use:
- Next.js 14 App Router
- Supabase + Postgres + RLS
- TanStack Query v5, Recharts, dnd-kit, cmdk
- shadcn/ui v4
- Anthropic SDK for AI; Resend for email; Google Calendar OAuth for events
- pnpm

The locked-stack rule (`~/.claude/rules/dashboard-architecture.md`) governs both versions.

### Skill ecosystem

v1.0: ~150 skills (post-prune cycle 1-2). Trials closed.
v2.0: ~120 skills (post additional consolidation). Design-review unified into single QC gate. SEO family routed through one umbrella.

---

## Test for cut-line decisions

When a new item shows up, the test is:

1. Does v1.0 launch without it? If yes, it is v2.0.
2. Does shipping it earlier compound on a v1.0 surface? If yes, consider v1.0.
3. Is it a roadmap gap (RSVP schema, content_calendar, etc.)? If yes, v2.0 by default.
4. Is it a polish item (template versioning, calendar staleness flag)? If yes, v2.0.
5. Is it a refactor that reduces v1.0 blast radius? If yes, evaluate; only task-list.tsx makes the v1.0 cut.

## Remaining placeholders

None.
