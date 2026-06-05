# Decision: Campaign Sending -- Keep Custom Blast vs. Bought Tool

**Date:** 2026-06-04
**Scope:** System Consolidation Gameplan, Scope 6
**Status:** PROPOSED (awaiting Alex's confirmation)

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
- [ ] KEEP custom -- proceed to harden (Tasks K1-K4).
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

## Closure of the not-chosen path

[Filled in at Task K4 once KEEP lands, or at BUY-branch close-out.]
