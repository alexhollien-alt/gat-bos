# Revenue Automation Engine -- CRM Build Reference

**Purpose:** Strategic blueprint for all touchpoint lifecycle, campaign automation,
and relationship intelligence features in GAT-BOS. Read this before building any
campaign, drip, signal, or lifecycle feature.

**Source:** Alex's research doc (Strategic Implementation Plan) + GAT-BOS system
inventory + STRATEGY-CONTEXT.md business rules. Synthesized 2026-04-12.

**This is a reference doc, not a task list.** Implementation happens phase by phase
when Alex calls for it. The logic here informs architectural decisions.

---

## Translation Layer -- Research to Alex's Context

Alex is NOT a realtor. His "leads" are real estate agents he wants as repeat partners.
Every framework below is adapted for that relationship.

| Generic Research Concept | Alex's Equivalent |
|---|---|
| Lead = homebuyer/seller | Lead = real estate agent Alex wants as partner |
| Speed-to-lead (5 min) | Speed-to-agent: fast follow-up after broker opens, BNI, home tours |
| 7-touch real estate formula | 7-touch agent relationship formula (below) |
| Cart abandonment | Stalled pipeline re-engagement |
| Lead scoring 0-100 | `health_score` (0-100) + `rep_pulse` (1-10) + materialized view |
| Co-marketing with lenders | Christine (Q1/Q4) + Stephanie (Q2/Q4), separation rules in STRATEGY-CONTEXT.md |
| SHAP/LIME AI governance | Overkill at 126 contacts. Revisit at 500+. |
| 17-touch B2B cadence | Wrong fit. Alex doesn't cold-prospect enterprises. |
| SMS/Twilio automation | Phone stays manual per locked tech stack. Text touches surface in Today View. |

---

## The 7-Touch Agent Relationship Lifecycle

This is the core cadence framework. Every new agent contact enters this sequence.
Adapted from the PrimeStreet 7-touch formula for title sales context.

| Touch | Timing | Channel | Content | CRM Trigger |
|---|---|---|---|---|
| 1 | Same day (after meeting) | Text (manual) | 60-second debrief follow-up | `interactions.insert` where type = 'meeting' |
| 2 | 24 hours | Email (Resend) | Value drop -- market data, listing comp, or Weekly Edge link | `signals.insert` type = 'post_meeting_24h' |
| 3 | Days 3-4 | Email | Educational -- "here's how I handled [their pain point]" with case study | Campaign step auto-fire |
| 4 | Days 7-10 | Call (manual, Today View) | Check-in: "Did you get what you needed?" | `focus_queue` surfaces it |
| 5 | Week 2 | Email | Social proof -- closed transaction shoutout or agent spotlight | Campaign step auto-fire |
| 6 | Weeks 3-4 | Email | Personalized market update for their farm area | `cycle_state` cadence trigger |
| 7 | Monthly | Weekly Edge + personal note | Long-term nurture -- on the rotation | `cycle_state` recurring |

Manual touches (1, 4) surface as action items in Today View.
Automated touches (2, 3, 5) fire via campaign step executor through Resend.
Hybrid touches (6, 7) are AI-drafted, Alex-approved before send.

---

## 3-Layer Loyalty Automation (Per Deal)

Maps directly from STRATEGY-CONTEXT.md System 02. CRM signals trigger each layer.

| Layer | CRM Trigger | Auto-Action | Manual Action (Today View) |
|---|---|---|---|
| 1: Pre-close | `deals.stage` = 'in_escrow' | Email template: "Everything is on track" | Surface: "Send milestone text to [agent] re [address]" |
| 2: At close | `deals.actual_close_date` = today | None (physical) | Surface: "Closing day for [agent] at [address] -- prepare gift + note" |
| 3: Post-close | `deals.actual_close_date` + 30 days | Email: "How did your buyer settle in?" | Surface: "30-day check-in with [agent] -- referral ask window" |

Track completion with `deals.loyalty_layer` (integer 0-3 or jsonb with layer timestamps).
Layer 3 is the natural referral ask window per STRATEGY-CONTEXT.md.

---

## Personalization Tiers (Mapped to Contact Tiers)

| Alex Tier | Cadence | Treatment | Email Generation |
|---|---|---|---|
| A (7-day) | Deep human-led | Custom content per touch. Morning briefing highlights by name. Hand-crafted emails. | Claude drafts, Alex reviews every one. |
| B (10-day) | AI-enhanced | Claude generates based on farm area, interactions, deal history. | Claude drafts, Alex batch-reviews weekly. |
| C (14-day) | Intelligent automation | Template campaigns with dynamic merge fields (name, brokerage, farm area). | Auto-fire with RESEND_SAFE_RECIPIENT lock until explicitly removed. |
| P (Passive) | Monthly | Weekly Edge only. No active campaigns. No Today View surfacing unless re-engagement signal. | N/A |

---

## Campaign Templates (Build Library)

These are the reusable campaign blueprints that the campaigns schema supports.

### Acquisition Campaigns

| Campaign | Trigger | Steps | Goal |
|---|---|---|---|
| New Agent Onboard | Manual enrollment or post-creative-brief | Full 7-touch sequence | Agent becomes active partner |
| Post-Meeting Follow-Up | `interactions.insert` type='meeting', contact has no active campaign | Touches 1-4 (lighter sequence) | Maintain momentum from meeting |
| BNI/Event Follow-Up | Manual enrollment after Tuesday BNI or Thursday broker opens | Day 0: connection text, Day 1: value email, Day 7: check-in call | Convert event contact to relationship |

### Nurture Campaigns

| Campaign | Trigger | Steps | Goal |
|---|---|---|---|
| Reactivation | 60+ days no interaction AND tier != P | Email 1: "What's new" + recent win, Email 2: market update for their area, Email 3: direct ask | Re-engage dormant agent |
| Seasonal Touchpoint | Quarterly (Q1 kickoff, Q2 spring, Q3 summer, Q4 gratitude) | Single email with event invite or seasonal content | Maintain presence |
| Co-Marketing: First-Time Buyer | Manual, Christine + Julie scope ONLY | Joint educational content, co-branded landing page | Capture first-time buyer segment |
| Co-Marketing: Farming | Manual, Stephanie scope | Farming strategy follow-up, Fiona case study | Demonstrate farming expertise |

### Retention Campaigns

| Campaign | Trigger | Steps | Goal |
|---|---|---|---|
| Loyalty Layer Sequence | `deals.insert` (new deal) | Layer 1 at in_escrow, Layer 2 at close, Layer 3 at +30 days | Complete full loyalty loop |
| Annual Review | 12 months since first interaction | Personalized "year in review" email with transaction count, value delivered | Deepen partnership |

---

## Signal Detection Logic

The `signals` table captures AI-detected events. These inform Today View prioritization.

| Signal Type | Detection Rule | Priority Bucket |
|---|---|---|
| `going_cold` | Tier A: no interaction in 14+ days (2x cadence). Tier B: 20+ days. Tier C: 28+ days. | Yellow -- "Agents going cold" |
| `closing_soon` | `deals.scheduled_close_date` within 3 days | Orange -- "Closings today/tomorrow" |
| `stalled_pipeline` | `opportunities.stage` unchanged for 30+ days | Gray -- "Pipeline items needing attention" |
| `post_meeting_24h` | `interactions.insert` type='meeting' + 24 hour delay | Green -- "Proactive touchpoints" |
| `loyalty_layer_due` | Deal reached layer trigger point (see Loyalty Automation above) | Orange (Layer 2) or Green (Layer 1, 3) |
| `reactivation_candidate` | 60+ days no interaction, tier != P, no active campaign | Yellow -- "Agents going cold" |
| `referral_window` | Layer 3 completed + positive sentiment in last interaction | Green -- "Proactive touchpoints" |

---

## Revenue Metrics (Dashboard Analytics)

Build these when data is flowing through campaigns and deals.

| Metric | Formula | Target |
|---|---|---|
| Pipeline Coverage | Total opportunity value / quarterly target | 3:1 to 5:1 ratio |
| Touch Consistency | Avg days between interactions per Tier A contact | 7 +/- 2 days |
| Campaign Completion Rate | Completed steps / total enrolled steps | > 80% |
| Loyalty Layer Completion | Deals with all 3 layers done / total closed deals | > 90% |
| Re-engagement Success | Dormant contacts interacting within 14 days of reactivation campaign | > 25% |
| Email Performance | Deals closed where contact received campaign email in prior 90 days | Attribution tracking |
| Speed-to-Follow-Up | Avg hours between meeting interaction and first follow-up | < 24 hours |

---

## Channel Strategy

| Channel | When | CRM Integration |
|---|---|---|
| Phone/Text | High-intent moments (post-meeting, closing day, referral ask) | Manual -- surfaces in Today View as action items |
| Email (Resend) | Nurture, value drops, market updates, campaign steps | Automated via campaign executor, webhook feeds health_score |
| Weekly Edge | Long-term nurture for all tiers | Separate pipeline (re-email-design skill) |
| In-person | BNI, broker opens, classes, events | Logged as interactions, triggers post-meeting sequence |
| Print | Monthly postcards, listing materials | Cypher tickets via cypher-ticket-builder skill |
| Video | [PLACEHOLDER: future consideration] | Not in current tech stack |

---

## Implementation Phases (Reference Only)

### Phase 1: Close the Spine
Complete Tasks 13-18 from spine-phase1. Edge functions for parser, signal scan,
Monday rotation. Today View shell. Wire RESEND_WEBHOOK_SECRET.

### Phase 2: 7-Touch Lifecycle Engine
Campaign templates, auto-enrollment triggers, campaign step executor,
cycle_state-to-campaign wiring.

### Phase 3: 3-Layer Loyalty Automation
Deal lifecycle signals, loyalty email templates, deals.loyalty_layer tracking,
Today View integration.

### Phase 4: Personalization + Intelligence
Claude API edge function for Tier A/B content generation, preferred_channel logic,
going-cold detection, deal velocity signals.

### Phase 5: Co-Marketing Engine
Co-branded campaign templates, event-to-campaign pipeline, class registration intake.

### Phase 6: Metrics + Optimization
Nightly metrics computation, analytics widgets, A/B testing infrastructure,
morning briefing performance section.

**Dependency chain:** Phase 1 > Phase 2 > Phase 3 > Phase 4 > Phase 5 > Phase 6.
No phase starts until previous phase delivers standalone module.

---

## Intentional Omissions

- **SHAP/LIME AI governance** -- overkill at current scale
- **17-touch B2B cadence** -- wrong fit for agent relationships
- **Cart abandonment** -- no e-commerce
- **Twilio/SMS** -- phone stays manual per tech stack lock
- **iMessage/Workspace integration** -- parked, trigger: "wire up the inbox"
- **Auto-sending without safety lock** -- RESEND_SAFE_RECIPIENT stays until Alex removes it

---

## How to Use This Document

When building any CRM feature that involves:
- Campaigns, drips, or sequences: reference the Campaign Templates section
- Deal lifecycle or closing workflow: reference the 3-Layer Loyalty section
- Contact prioritization or Today View: reference the Signal Detection section
- Email automation: reference the 7-Touch Lifecycle and Personalization Tiers
- Dashboard metrics: reference the Revenue Metrics section
- Co-marketing with lenders: reference Co-Marketing campaigns + STRATEGY-CONTEXT.md lender rules

This doc + STRATEGY-CONTEXT.md + dashboard.md form the complete business logic layer.
Design tokens, typography, and visual rules live in brand.md and digital-aesthetic.md.
