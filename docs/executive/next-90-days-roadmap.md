# Next 90 Days Roadmap

Concrete sequencing for May, June, and July 2026 (~the next 90 days), slotted into the 15-slice roadmap in `~/.claude/plans/composed-herding-backus.md`. This is the operating sequence; deviations get logged in STATUS.md.

Format per item: action, owner gate, dependency, expected duration. All durations are best-effort estimates; the critical chain (7A.5 -> 7B -> 7C) takes priority over parallel items.

## Critical chain (must land in order)

| Order | Item | Owner gate | Estimated duration |
|-------|------|------------|--------------------|
| 1 | Slice 7A.5 (active) | Acceptance: `supabase db reset` clean, `supabase migration list --linked` zero drift | ~5-10 hours from now |
| 2 | Slice 7B (paused on 7A.5) | Acceptance: 5 agents seeded, public agent RPC live, RLS subquery pattern verified | ~6-8 hours |
| 3 | Slice 7C (scoped, not planned) | Acceptance: agent portal pages live, magic-link auth, account-aware health | ~multi-day |

Slipping any chain item slides the rest. Parallel items run alongside but cannot replace chain items.

---

## May 2026

### Week 1 (May 1-7)

**Critical chain.**
- Land Slice 7A.5. Reconcile 17 prod-only timestamps; rename or delete 6 phase-prefixed files; resolve duplicate timestamp collision; pass `supabase db reset` against fresh local Docker.

**Parallel items.**
- Resend account setup (Alex). Webhook secret + API key. Activate the Slice 4 + 5A wiring already in code.
- Migration registry hygiene gate. Bash hook on `supabase migration list --linked`. Land same week as 7A.5 to lock the floor.

**Stretch (only if 7A.5 ships early).**
- Begin Slice 7B pre-flight check on the now-clean local DB.

### Week 2 (May 8-14)

**Critical chain.**
- Slice 7B execution. Tasks 0-9 per locked plan. Add account_id + slug + tagline + headshot_url to contacts; seed 5 agents (type='agent'); ship public agent RPC; tenant-scope 6 core tables.

**Parallel items.**
- Inbound email -> contact auto-link. ~30 lines in the draft generator path. Test against a known inbound thread.
- Cold-leads MV + Today widget. Scope MV criteria; build the widget; verify against current cold contacts.

### Week 3 (May 15-21)

**Critical chain.**
- Slice 7B closes (smoke + soak). Verify health-score behavior under multi-tenant scoping. Confirm public agent RPC handles anon reads correctly.

**Parallel items.**
- Skill telemetry digest cycle 1. Read jsonl, group by invocation count, flag n=1 candidates. Decide one consolidation cluster (likely SEO or design-review) and queue for week 4.
- Vercel skill audit. Compare local vercel-* skills against the plugin set; deprecate or merge.

**Decision gate.**
- impeccable trial review (due 2026-05-01, was paused for 7A.5 and may slip into week 3). Decide: bake-in or dissolve.

### Week 4 (May 22-28)

**Critical chain.**
- Begin Slice 7C planning. (portal) route group, magic-link auth flow, account_members table, account-aware health scoring.

**Parallel items.**
- design-intelligence trial review (due 2026-05-28). Decide: bake validated rules into re-print-design / re-landing-page / re-listing-presentation, or dissolve.
- Tool-routing reflex prompt audit. Reinforce Standing Rule 23 in postgresql-table-design, sql-optimization-patterns, database-migration prompts.

---

## June 2026

### Week 5 (May 29 -- June 4)

**Critical chain.**
- Slice 7C execution starts. Magic-link flow first; (portal) routes second; account-aware health third.

**Parallel items.**
- Resend send observation soak. After Resend wiring lands (target: May Week 1), 4 weeks of cron-driven sends accumulate engagement data by now.
- External audit verification reflex bake-in (Standing Rule 16). Audit drift-audit, weekly-audit, opponent-review prompts.

### Week 6 (June 5-11)

**Critical chain.**
- Slice 7C continues. Magic-link delivery via Resend. Portal route security review.

**Parallel items.**
- Property address auto-populate from project metadata. ~one form change.
- Re-* design skill post-output logging verification. Ship one design piece; verify the post-output log row appears in media-memory and the wiki page is created.

### Week 7 (June 12-18)

**Critical chain.**
- Slice 7C smoke + soak. Verify portal access for the 5 seeded agents.

**Parallel items.**
- Skill telemetry digest cycle 2. Decide a second consolidation cluster.
- Brand drift verification cadence. Run brand-audit + verify-brand.sh against `~/.claude/skills` and `~/crm/src`.

### Week 8 (June 19-25)

**Critical chain.**
- Slice 7C closes. Agent portal in production with magic-link auth and account-scoped surfaces.

**Parallel items.**
- task-list.tsx refactor begins. Extract filter/sort hooks; split mutation handlers. Target: 979 LOC -> ~400 LOC + 3-4 hook files.
- Cold-leads reactivation drip scope. Build on cold-leads MV from May.

---

## July 2026

### Week 9 (June 26 -- July 2)

**Parallel items (no chain item this week; 7C closed; 8A planning).**
- task-list.tsx refactor continues.
- Slice 8A planning. content_calendar, social_posts, podcast_episodes schema. Long-form to short-form workflow.

### Week 10 (July 3-9)

**Parallel items.**
- task-list.tsx refactor closes. Audit blast radius on subsequent task changes.
- Template versioning planning. version column on templates; log on email_drafts; re-render path.

### Week 11 (July 10-16)

**Critical chain (8A starts).**
- Slice 8A schema lands. Three new tables. Initial UI surface for content_calendar.

**Parallel items.**
- intake/page.tsx refactor begins (728 LOC, hotspot 2 of 4). Apply task-list.tsx pattern.

### Week 12 (July 17-23)

**Critical chain.**
- 8A continues. Long-form to short-form workflow. Resend integration for newsletter delivery.

**Parallel items.**
- contacts/[id]/page.tsx refactor (679 LOC, hotspot 3 of 4).

### Week 13 (July 24-30)

**Critical chain.**
- 8A smoke + soak.

**Parallel items.**
- analytics/page.tsx refactor (923 LOC, hotspot 4 of 4).
- Skill telemetry digest cycle 3.

---

## 90-day acceptance gates

By end of July 2026:

1. Slices 7A.5, 7B, 7C shipped.
2. Slice 8A schema landed; long-form to short-form workflow functional for at least one piece (Weekly Edge -> 3+ social posts).
3. Resend wiring live for ~12 weeks; engagement data populating message_events.
4. Migration registry hygiene gate live; zero new prod-only timestamps since 7A.5.
5. Inbound email auto-link landed; cold-leads MV + Today widget shipped; property address auto-populate landed.
6. Skill telemetry digest run 3 times; at least 2 consolidation clusters shipped (likely SEO + design-review).
7. impeccable + design-intelligence trials closed; bake-in or dissolve decisions logged.
8. task-list.tsx refactor complete; one or two of intake/contacts/analytics hotspots also refactored.

## Out of scope for the 90 days

- Slice 8B (referrals + post-event automation). Q4 territory.
- Reactivation automation (built on cold-leads MV). Q4 territory; Cold-leads MV ships in May to provide the input.
- Derivative AI pipeline. Q4 territory.
- v2.0 surfaces (per `v1-to-v2-strategy.md`).

## Risk register for the 90 days

1. **7A.5 takes longer than estimated.** If reconciliation surfaces deeper drift, add a Phase 2 within 7A.5. Slides 7B by however long; everything else moves with it.
2. **Resend account setup gets stuck.** If wiring stalls past May Week 2, evaluate a Resend alternative inside the locked stack. Do not add any provider outside the locked stack per the analysis-session no-touch list.
3. **7C magic-link flow has security review issues.** Slipping 7C past June Week 8 cascades into 8A planning; that is acceptable but should be flagged.
4. **Skill trial decisions get re-deferred.** impeccable + design-intelligence have already been deferred once. A second deferral suggests dissolving rather than baking in.
5. **Hotspot refactors trigger regressions.** Each refactor needs a smoke test before committing.

## Remaining placeholders

None.
