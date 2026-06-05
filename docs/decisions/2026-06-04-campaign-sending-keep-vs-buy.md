# Decision: Campaign Sending -- Keep Custom Blast vs. Bought Tool

**Date:** 2026-06-04
**Scope:** System Consolidation Gameplan, Scope 6
**Status:** DECIDED -- KEEP CUSTOM

## The question

The CRM hand-rolls its own email deliverability stack: Resend send wrappers, a
dedicated warmup subdomain (opens.alexhollienco.com), RFC 8058 one-click
unsubscribe, webhook-driven bounce/complaint suppression, city-tagged recipient
pools, and a pre-send preflight checklist. Alex is the sole admin. The question:
keep owning deliverability, or move sending to a bought tool (Mailchimp,
Customer.io, Resend Broadcasts, etc.) where the vendor owns deliverability and we
own only creative + list?

## What exists today (audited 2026-06-04)

- Dedicated subdomain send path with WALL invariants (never root/CRM domain):
  `src/lib/open-house/`.
- Preflight checklist (PR #64): `src/lib/messaging/preflight.ts` -- recipient
  count, expected-count match, duplicate detection, unresolved-token detection,
  image-200 checks. **Enforced only on open-house blasts.**
- Suppression: `contacts.email_status` doubles as the suppression list; Resend
  webhook flips it on bounce/complaint.
- Caps: per-blast `daily_send_cap` + batch throttle (100 / 500ms). **No global
  daily cap.**
- Alerting: WALL thresholds (4% bounce, 0.08% complaint) are **dashboard-only.**

## Honest cost of "keep"

- Deliverability is a standing maintenance liability with Alex as single point of
  failure. One bad blast off the shared subdomain can degrade the domain used for
  real agent comms.
- The three gaps below are the difference between "a hobby blaster" and "a system
  that fails safe."

## Honest cost of "buy"

- Re-tooling cost: move the list, rebuild templates in the vendor, retire the
  custom infra to read-only. Lose the tight CRM integration (city pools,
  per-contact suppression synced to `contacts`).
- Recurring vendor cost; creative still in-house.

## Decision

[ALEX TO CONFIRM AT TASK 1 GATE]
- [x] KEEP custom -- proceed to harden (Tasks K1-K4).
- [ ] BUY -- proceed to migrate (BUY branch; re-expand via /superpowers:writing-plans).

## Rationale

The gameplan's standing answer is "keep building the CRM." This scope tests
whether that extends to the deliverability stack specifically. Keeping is
defensible **only if** the three fail-safes below land, because without them the
custom stack is a liability, not an asset:

1. A global hard daily send cap (backstop above warmup).
2. Preflight enforced on every multi-recipient send path, not just open-house.
3. Bounce/complaint spike alerting wired off the WALL thresholds.

## Explicitly out of scope (recorded, not dropped)

- 1:1 transactional draft replies (`approve-and-send`) stay outside the preflight
  gate by design: single recipient, human-approved in the UI. Adding an image-200
  fetch gate there is friction without domain protection.
- Generic rate-limiter integration, startup provider health checks, and
  suppression-in-sendMessage were surfaced in the audit but are NOT in this scope
  (YAGNI / Rule 25). Logged here so a future session knows they were considered
  and declined, not missed.

### Recorded tradeoffs in the KEEP hardening (surfaced in code review, accepted as backstop-grade)

These are deliberate altitude choices in the three fail-safes, not defects. Recorded so a
future session knows they were weighed, not missed:

- **Send-cap count-then-send is not transactional (TOCTOU).** `countBlastSendsToday()`
  reads the day's total, then `sendBlast()` sends; two concurrent sends (cron overlapping a
  manual blast) could both read the same total and collectively overshoot
  `GLOBAL_DAILY_SEND_CAP`. Acceptable for a reputation *backstop* against a runaway/fat-finger;
  a transactional counter would be over-engineering for a soft guard.
- **Deliverability alerting runs three serial count queries per bounce/complaint event.**
  Fine at current volume (fires only on bounce/complaint, not the high-volume delivered/opened
  path). Candidate to collapse into one query if blast volume grows.
- **No alert dedup.** Once a blast is over a WALL ceiling, every subsequent bounce re-fires the
  logError + activity event. Acceptable because both sinks are low-cost (log + feed, not
  pager/email/SMS). First-crossing-only dedup is a clean follow-up if the noise becomes a problem.
- **The alert activity event is fire-and-forget (`void writeEvent`).** Matches the existing
  webhook handler pattern; the durable `logError` IS awaited, so the breach record is never lost
  even if the feed event is dropped under a serverless freeze.

## Closure of the not-chosen path

DECISION: KEEP CUSTOM. The bought-tool migration is explicitly closed and will
not draw maintenance. Re-open only if a future blast actually damages domain
reputation despite the three fail-safes below, OR Alex's time cost on
deliverability ops exceeds the re-tooling cost.

The KEEP path is now hardened (shipped 2026-06-04):
- Global hard daily send cap (`src/lib/messaging/send-cap.ts`,
  `GLOBAL_DAILY_SEND_CAP`, default 5000, env `BLAST_DAILY_HARD_CAP`), enforced in
  `sendBlast()`.
- Preflight gate on every multi-recipient send (`src/lib/messaging/preflight-gate.ts`),
  wired into the Weekly Edge cron; open-house blasts already enforced it.
- Bounce/complaint WALL-breach alerting (`src/lib/messaging/deliverability-health.ts`),
  wired into the Resend webhook; emits `open_house.deliverability.alert` + error log.

No bought-tool account was provisioned. No list was exported to a vendor. The
custom stack remains the single sending path.
