---
phase: 003-slice-2b-captures-consolidation
plan: 04
subsystem: infra
tags: [supabase, storage, cron, vercel, next-api-route]

# Dependency graph
requires:
  - phase: 003-slice-2b-captures-consolidation
    provides: captures schema with source/status columns from plans 01-03
provides:
  - Cron GET route at /api/captures/cleanup-audio deleting audio objects older than 30 days
  - BLOCKERS.md lifecycle entry for wiring cleanup cron to Vercel scheduler
  - Paste SQL ready for captures-audio bucket creation in Supabase storage
affects:
  - 003-05
  - 003-06
  - Any future audio capture work (voice/mic feature, transcription API)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "cron route pattern: verifyCronSecret + adminClient.schema('storage').from('objects').delete()"
    - "storage schema access via adminClient.schema('storage') -- not adminClient.from() which hits public schema"

key-files:
  created:
    - src/app/api/captures/cleanup-audio/route.ts
  modified:
    - BLOCKERS.md

key-decisions:
  - "Use adminClient.schema('storage').from('objects') for storage.objects access -- public schema .from() does not reach storage schema"
  - "Bucket check could not be performed (Docker not running) -- paste SQL written to ~/Desktop for manual execution"
  - "Route is safe whether or not bucket exists -- DELETE WHERE returns 0 rows if bucket absent"
  - "30-day retention constant as RETENTION_DAYS to make it easy to tune later"
  - "Return { deleted, bucket, cutoff } in success response for Vercel cron log visibility"

patterns-established:
  - "storage-cron-pattern: adminClient.schema('storage').from('objects').delete().eq('bucket_id', BUCKET_ID).lt('created_at', cutoff).select('id')"

requirements-completed:
  - SLICE-2B-05

# Metrics
duration: 8min
completed: 2026-04-23
---

# Phase 003 Plan 04: Cleanup-Audio Cron Route Summary

**Cron GET route at /api/captures/cleanup-audio deleting 30-day-old storage objects from captures-audio bucket, authenticated via CRON_SECRET, with paste SQL for bucket creation and BLOCKERS.md lifecycle entry**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-23T00:00:00Z
- **Completed:** 2026-04-23T00:08:00Z
- **Tasks:** 2 (5a bucket check + 5b route creation)
- **Files modified:** 2

## Accomplishments
- Created cleanup-audio cron route following canonical recompute-health-scores pattern
- Route authenticates via verifyCronSecret (timing-safe, 401 on mismatch)
- Route deletes storage.objects from captures-audio bucket older than 30 days via storage schema access
- BLOCKERS.md updated with lifecycle entry to wire route to Vercel cron scheduler
- Paste SQL written to ~/Desktop/PASTE-INTO-SUPABASE-slice2b-bucket.sql for bucket creation

## Task Commits

1. **Task 5b: Create cleanup-audio cron route** -- `22eada8` (feat)

Note: Task 5a (bucket check) produced no repo changes -- result was a paste file on Desktop and a console note. No commit for 5a.

## Files Created/Modified
- `src/app/api/captures/cleanup-audio/route.ts` -- Cron GET handler; verifyCronSecret auth; 30-day retention delete on storage.objects; returns { deleted, bucket, cutoff }
- `BLOCKERS.md` -- Added captures-audio lifecycle entry under ## Open with fix instructions for vercel.json wiring

## Decisions Made
- `adminClient.schema('storage').from('objects')` used for storage schema access -- plain `.from()` on adminClient targets the public schema and would not reach storage.objects
- Bucket check failed (Docker not running) -- paste SQL written anyway per plan fallback; route is bucket-safe regardless
- Return shape `{ deleted, bucket, cutoff }` includes bucket name and ISO cutoff for Vercel cron log diagnostics

## Deviations from Plan

None -- plan executed exactly as written. The Docker-not-running path was anticipated in the plan and handled per its fallback instructions.

## Issues Encountered
- Supabase CLI bucket check could not run (Docker not running). Plan specified this as expected fallback: write the paste SQL, note the failure, continue. Paste file at ~/Desktop/PASTE-INTO-SUPABASE-slice2b-bucket.sql is ready for manual execution before audio capture goes live.

## User Setup Required
- **captures-audio bucket may not exist.** Paste `~/Desktop/PASTE-INTO-SUPABASE-slice2b-bucket.sql` into Supabase SQL Editor before voice/audio capture feature goes live. The cleanup cron route works safely whether or not the bucket exists.
- **Cron not yet wired.** See BLOCKERS.md "captures-audio lifecycle" entry. To enable: add `{ "path": "/api/captures/cleanup-audio", "schedule": "0 12 * * *" }` to vercel.json and confirm CRON_SECRET is set in Vercel project settings.

## Next Phase Readiness
- Cleanup cron route is complete and typechecks clean
- Bucket paste SQL is ready for Alex to execute
- Plans 005 and 006 can proceed -- they do not depend on storage bucket state

---
*Phase: 003-slice-2b-captures-consolidation*
*Completed: 2026-04-23*
