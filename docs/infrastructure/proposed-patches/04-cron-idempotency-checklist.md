# Patch 04 -- Cron idempotency checklist (review-only)

**Target paths:** each cron handler under `src/app/api/cron/**` and `src/app/api/{inbox,gmail,calendar}/**`
**Action:** Audit each cron, document its idempotency contract, add unique-index DB protection where missing.

---

## Why

Vercel cron is at-least-once. During deploys or platform incidents, a cron path can fire twice within seconds. Without a dedup mechanism:

- `morning-brief` may insert two `morning_briefs` rows for the same user-day.
- `touchpoint-reminder` may send the same Resend email twice.
- `inbox/scan` may write duplicate inbox rows for the same Gmail message.

The campaign-runner has built-in protection (`next_action_at <= now()` time-window query advances after first tick); other crons may not.

---

## Per-cron checklist template

For each cron, fill in:

| Job | Idempotency mechanism | Tested? | Schema artifact |
|-----|------------------------|---------|------------------|
| `inbox/scan` | (Gmail message_id?) | (no) | (assumed unique constraint?) |
| `gmail/sync` | (Gmail message_id) | (no) | (?) |
| `calendar/sync-in` | upsert on `gcal_event_id` | manual smoke 2026-04-18 | events table has `gcal_event_id` unique |
| `cron/recompute-health-scores` | recompute is idempotent by definition | implicit | n/a |
| `cron/morning-brief` | UNKNOWN | UNKNOWN | propose `morning_briefs (user_id, brief_date)` unique |
| `cron/campaign-runner` | time-window + `next_action_at` advancement | partial -- see route comment | none beyond enrollment state |
| `cron/touchpoint-reminder` | UNKNOWN | UNKNOWN | propose dedup on `(touchpoint_id, sent_date)` |

---

## Recommended schema work (post-7A.5)

Consolidate into one migration `slice7b_idempotency_keys.sql`:

```sql
-- morning_briefs: at most one per user per Phoenix-calendar day
ALTER TABLE morning_briefs
  ADD CONSTRAINT morning_briefs_user_day_unique
  UNIQUE (user_id, brief_date);

-- message_events: at most one event per provider_message_id+event_type
CREATE UNIQUE INDEX IF NOT EXISTS message_events_provider_event_unique
  ON message_events (provider_message_id, event_type)
  WHERE provider_message_id IS NOT NULL;

-- (additional uniques per audit findings; case-by-case)
```

Coupled code change: switch the matching insert to `.upsert({ ... }, { onConflict: 'provider_message_id,event_type', ignoreDuplicates: true })`.

---

## NOT autonomously applied

Schema work; HANDS-OFF until 7A.5 lands. Use `supabase migration new slice7b_idempotency_keys` per Standing Rule 23 when ready.
