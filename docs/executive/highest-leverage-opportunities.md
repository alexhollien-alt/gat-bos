# Highest-Leverage Opportunities

Ranked list of compounding wins for the GAT-BOS CRM, sorted by leverage-to-effort ratio. Top 10 in detail; runner-ups summarized at the bottom. All items are observed (tied to a named friction, repeated task, or measured cost), not speculative. Scope: post-Slice-7A.5 horizon through v2.0.

Format per item:
- **Why it matters** -- cost of not doing it
- **Impact** -- High / Medium / Low + a sentence on the change if it ships
- **Complexity** -- High / Medium / Low + a sentence on the lift
- **Dependencies** -- slices, systems, or other items that gate this
- **Compounding effects** -- what this enables downstream
- **Timing** -- before-v1.0, v1.0 launch, or after-v1.0 (v2.0)

## Ranking summary (top 10)

| Rank | Item | Impact | Complexity | Timing |
|------|------|--------|------------|--------|
| 1 | Migration registry hygiene gate (post-7A.5 enforcement) | High | Low | Before-v1.0 |
| 2 | Resend wiring + email send unblock | High | Low | Before-v1.0 |
| 3 | Slice 7B ship (multi-tenant contacts + 5 agent seed) | High | Medium | Before-v1.0 |
| 4 | Auto-link inbound email to existing contact | High | Low | Before-v1.0 |
| 5 | Materialized view: cold-leads bucket | Medium | Low | Before-v1.0 |
| 6 | task-list.tsx refactor (979 LOC -> custom hooks) | Medium | Medium | v1.0 launch |
| 7 | Skill telemetry + monthly consolidation cadence | Medium | Low | Before-v1.0 |
| 8 | Slice 7C ship (agent portal + magic links) | High | High | v1.0 launch |
| 9 | Template versioning + draft re-render flag | Medium | Medium | After-v1.0 |
| 10 | Slice 8A content engine (long-form to short-form pipeline) | High | High | After-v1.0 |

---

## 1. Migration registry hygiene gate (post-7A.5 enforcement)

**Why it matters.** 7A.5 is closing 17 prod-only timestamps + 6 phase-prefixed files + ~44 unapplied local files. The cost of letting registry drift recur is the entire 7A.5 plumbing window again, plus a real risk of a contributor running `supabase db reset` on a clean local instance and getting a divergent schema. Every paste-and-mirror SQL session since 2026-04-03 has been one source of this drift; absent a gate, it will recur within weeks.

**Impact.** High. A single check in the post-merge or pre-push hook flips this from "audit every quarter" to "auto-flag at the moment of drift."

**Complexity.** Low. One Bash hook that runs `supabase migration list --linked`, parses for any non-zero diff, and fails the operation. Maybe 20 lines of shell.

**Dependencies.** 7A.5 must ship first (clean baseline). Standing Rule 23 already names the CLI as the only path; this is enforcement, not new policy.

**Compounding effects.** Eliminates the dominant source of paste-files. Removes the manual `supabase db reset` gate-check from every plumbing session. Lowers the bar for future contributors (or future Alex on a fresh laptop).

**Timing.** Before-v1.0. The cost of rebuilding the gate at v1 is small; the cost of re-running 7A.5 at v1 is multi-day.

## 2. Resend wiring + email send unblock

**Why it matters.** Email send has been blocked since 2026-04-03. Onboarding sequence, Closing Brief, Monthly Toolkit, Weekly Edge, and four quarterly drips all sit behind this single wiring step. Every week the wiring stays open, the campaign content backlog grows; every week the drips stay dark, agent relationship health depends entirely on Alex's manual outreach.

**Impact.** High. Unblocks Slice 5A (campaign-runner cron is built and waiting), Slice 5B (event hooks dispatch), and the entire content-engine roadmap downstream.

**Complexity.** Low. The Resend webhook secret + API key are the only missing pieces; abstraction (`sendMessage()`), templates table, and message_events ingestion are already shipped in Slice 4 + 5A. STATUS.md already lists `RESEND_WEBHOOK_SECRET` as pending.

**Dependencies.** None inside the codebase. Alex's account setup at Resend is the only blocker.

**Compounding effects.** Activates the campaign automation stack already built. Closes the 28-paste-file friction loop where every send is hand-pasted. Provides a measurable proxy for relationship health (open + click rates) instead of relying on the manual MV refresh.

**Timing.** Before-v1.0. v1.0 cannot launch with email send dark.

## 3. Slice 7B ship (multi-tenant contacts + 5 agent seed)

**Why it matters.** Slice 7B is locked, scoped, and paused on 7A.5. It adds account_id + slug + tagline to contacts, seeds 5 agents (type='agent'), and ships a public agent RPC. Without it, the agent portal (7C) cannot start, and the multi-tenant work in 7A is technically complete but practically dormant. The longer 7B sits, the more the surface drifts (already 1 schema-drift correction baked into the locked plan).

**Impact.** High. Unlocks Slice 7C (agent portal + magic links) and the full partner-motion roadmap. Makes 5 named agents addressable in the system instead of as data-entry rows.

**Complexity.** Medium. Pre-flight is 80% complete; tasks 0-9 defined; estimated 6-8 hours of execution. Subquery pattern for RLS is confirmed.

**Dependencies.** 7A.5 must ship first.

**Compounding effects.** Every downstream slice (7C, 8A, 8B) treats the contacts table as multi-tenant. Account-scoped health scoring becomes possible. Agent landing pages become possible without further schema work.

**Timing.** Before-v1.0. 7B is on the critical path.

## 4. Auto-link inbound email to existing contact

**Why it matters.** `email_drafts.email.from_email` is available at draft generation; today there is no auto-create or auto-link path against `contacts.email`. Every inbound email that names a known agent requires Alex to manually associate the draft to the contact, or accept that the draft sits decoupled. This is the single most-named retyping risk in the business-domain pass.

**Impact.** High. Closes a per-draft retyping loop. Improves health-score timeliness because interactions auto-attach to the contact's activity_events feed.

**Complexity.** Low. One lookup on `contacts.email = email.from_email` at draft creation; populate `email_drafts.contact_id` if found; flag for review if multiple matches. Idempotent. ~30 lines in the draft generator path.

**Dependencies.** None. Slice 6 AI layer exposes the draft generator; the contacts table is stable.

**Compounding effects.** The auto-link feeds activity_events writes through `writeEvent()`, which trips the relationship-health refresh trigger. Contact health goes from manual-by-Alex to system-driven. Aggregates ("interactions_30d") become real.

**Timing.** Before-v1.0. Underpins the demo: every inbound email shows the right contact in the timeline.

## 5. Materialized view: cold-leads bucket

**Why it matters.** Today View widgets ship for drafts-pending, touchpoints-due, and projects-active. There is no widget for "agents going cold" despite the dashboard architecture doc naming it as a Tier-1 surface. AI-driven detection (Slice 6 morning brief) is the long path; a deterministic materialized view from `health_score` + `days_since_contact` + `stage` is the short path.

**Impact.** Medium. Makes the going-cold bucket a first-class Today View tile instead of a morning-brief paragraph. Surfaces the right work before Alex opens his inbox.

**Complexity.** Low. One MV `contacts_cold_leads` with criteria `health_score < threshold AND days_since_contact > 30 AND stage NOT IN ('lost','closed')`. Refresh on activity_events trigger (already wired for relationship_health_scores). One Today widget.

**Dependencies.** Slice 7A's user_id columns are in place. Slice 5B touchpoint cron is the closest analog and is already shipped.

**Compounding effects.** Provides a non-AI baseline that the morning brief can reference and compare against, which improves brief quality without requiring AI. Becomes the foundation for the "reactivation" automation (8B territory).

**Timing.** Before-v1.0. The MV is small; the widget is one component.

## 6. task-list.tsx refactor (979 LOC -> custom hooks)

**Why it matters.** `src/components/dashboard/task-list.tsx` is 979 LOC of compound state (filter + sort + Realtime subscription) plus drag-drop mutations plus the completion flow. Every time a task-related feature touches this file, the blast radius is the entire dashboard. Two of the named complexity hotspots (intake/page.tsx 728, contacts/[id]/page.tsx 679, analytics/page.tsx 923) are similar shapes; task-list is the one most-edited.

**Impact.** Medium. Reduces blast radius on every future task-related change. Sets the pattern for how to refactor the other three hotspots without a full rewrite.

**Complexity.** Medium. Extract filter/sort logic into custom hooks. Split mutation handlers (complete, snooze, delete) into separate functions or a reducer. Target shape: ~400 LOC component + 3-4 hook files. No behavior change.

**Dependencies.** None at the schema level. Should follow Slice 7B contact-scoping changes so the refactor lands on stable RLS.

**Compounding effects.** Establishes the refactor template for intake/page.tsx, contacts/[id]/page.tsx, and analytics/page.tsx. Each follow-on refactor gets cheaper.

**Timing.** v1.0 launch. Not blocking 7B/7C, but should land before 8A adds more dashboard surfaces.

## 7. Skill telemetry + monthly consolidation cadence

**Why it matters.** 169 skills installed; only 21 unique skills in the last 200 telemetry entries. The long tail is dead weight, and dead weight in the skill index lengthens skill-routing decisions on every prompt. The 2026-04-16 audit named SEO (~20 skills), design review (5), Vercel (4 + 30 plugin), and re-* design (5) as consolidation clusters; no consolidation has shipped because the audit is run by hand each time.

**Impact.** Medium. Lower ambient context cost per session. Faster skill matching. Pruning 50+ n=1 skills cuts the index roughly in half.

**Complexity.** Low. A monthly scheduled job reads the telemetry JSONL, groups by invocation count, flags n=1 candidates, and posts a candidate list. Decision step stays manual. Maybe 50 lines of jq + Bash.

**Dependencies.** Telemetry hook already installed (2026-04-16). Has ~43 entries to date; another 1-2 weeks gives a usable signal.

**Compounding effects.** Each consolidation cycle reduces context cost on every future session. Combined with the impeccable + design-intelligence trial closures, the skill ecosystem can shrink without losing capability.

**Timing.** Before-v1.0. The audit is light; the win recurs.

## 8. Slice 7C ship (agent portal + magic links)

**Why it matters.** 7C unlocks the partner motion that the entire CRM is in service of: agents request marketing, see their own KPIs, and access account-aware surfaces. Before 7C, every agent interaction routes through Alex; after 7C, agents self-serve on the high-frequency requests.

**Impact.** High. Changes the operating model from "Alex is the bottleneck" to "Alex reviews and approves." Account-aware health scoring becomes meaningful (per-account vs global).

**Complexity.** High. New (portal) route group, magic-link auth flow, account_members multi-user table, agent-specific views, and account-aware health scoring. The auth flow is the highest-risk piece.

**Dependencies.** 7B must ship first (account_id + slug on contacts). Slice 4 templates abstraction supports magic-link emails. Resend wiring (item 2) must be live for magic-link delivery.

**Compounding effects.** Every downstream feature (8A content delivery, 8B referrals) has an authenticated agent identity to attach to. Health scoring per account becomes the foundation for partner-tier triage.

**Timing.** v1.0 launch. 7C is what makes the demo a product.

## 9. Template versioning + draft re-render flag

**Why it matters.** `email_drafts.draft_subject` and `draft_body_html` are stored at generation time. If the source `templates` row updates, old drafts retain stale content with no invalidation. This is the named template-changelog gap from the business-domain pass and feeds the recurring "color/font reconciliation" theme in operational patterns (Playfair -> Instrument Serif, GAT Red/Blue swaps; multiple sessions consumed each time).

**Impact.** Medium. Eliminates the "send a draft and discover the template changed last week" failure mode. Makes template edits low-risk.

**Complexity.** Medium. Add `template_version` to templates + a column on email_drafts logging which version generated. UI surface: "this draft was generated against template v3; current is v5; re-render?" One-click re-render path. ~half-day of work.

**Dependencies.** Slice 4 templates table is the source. No schema-level dependency on 7B/7C.

**Compounding effects.** Lets template iteration happen freely without sweeping through the drafts queue. Speeds up the recurring template polish cycles in the operational patterns log.

**Timing.** After-v1.0. v1.0 ships with hand-curated templates; versioning earns its keep at the second or third template sweep.

## 10. Slice 8A content engine (long-form to short-form pipeline)

**Why it matters.** 8A scopes `content_calendar`, `social_posts`, and `podcast_episodes` plus a long-form to short-form workflow and asset performance attribution. Without it, content production stays manual; with it, every long-form piece (Weekly Edge, blog post, podcast episode) auto-fans to derivative short-form posts with attribution back to the source.

**Impact.** High. Changes content production economics. One Weekly Edge becomes 5-10 social posts plus 2-3 podcast snippets. Attribution closes the loop on which formats actually drive engagement.

**Complexity.** High. Three new tables, the long-to-short workflow, AI-assisted derivative generation (which the Slice 6 AI layer already supports), and the attribution data model. Multi-week build.

**Dependencies.** Slice 7C agent portal (8A surfaces include agent-specific content). Slice 4 templates abstraction. Slice 6 AI layer for the derivative pipeline. Resend wiring for newsletter delivery.

**Compounding effects.** Content + email + agent portal converge into a self-serving partner experience. The morning briefing skill gets richer raw material.

**Timing.** After-v1.0. v2.0 territory. Speculative until v1.0 metrics confirm content is the next constraint.

---

## Runner-ups (one-line each)

11. **Auto-populate opportunity.property_address from project metadata.** Listing projects already carry the address; opportunity creation re-asks for it.
12. **FK constraint or trigger guard on project_touchpoints (entity_table, entity_id).** Today the loose reference orphans silently when the referenced row deletes.
13. **`/today` -> `/today-v2` cutover (LATER.md item).** Ship 7B, finish v2 mutations, then redirect.
14. **Remove `openai` package.json dependency.** No active call sites in src/; pure dead weight.
15. **Relocate `wrapReplyHtml` and `detectEscalation` out of `src/lib/claude/draft-client.ts`.** Slice 6 LATER.md carryover; deferred from Task 7c.
16. **Daily skill-invocation digest at end of day.** Auto-surfaces n=1 skills as candidates for the monthly consolidation cycle.
17. **Captures fuzzy-match fallback when first-name lookup fails.** Today the rules parser gives up silently and contact_id stays null.
18. **Health-score refresh queue with backoff.** Today the trigger fires per-event; bulk inserts cause lag.
19. **Calendar invite refresh when an attendee email changes.** Today gcal_event attendees go stale.
20. **Public-agent RPC caching layer.** 7B ships the RPC; cache it before agents drive traffic against it.

## Remaining placeholders

None.
