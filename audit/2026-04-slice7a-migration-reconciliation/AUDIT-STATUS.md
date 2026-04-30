# Supabase Audit -- Run Status (2026-04-28)

## Step results

| Step | Status | Output |
|------|--------|--------|
| 1. List migrations w/ summaries | DONE | `audit/migration-list.md` |
| 2. Live schema dump | **BLOCKED** | see below |
| 3. Drift report (`supabase db diff`) | **BLOCKED** (same cause) | -- |
| 4. Migration status | DONE | `audit/migration-status.txt` |
| 5. Schema inventory | **BLOCKED** | requires Step 2 output to be authoritative |

## Blocker

`supabase db dump` requires Docker Desktop. **Docker is not installed** on this machine (`open -a Docker` returned "Unable to find application named 'Docker'").

Direct `pg_dump` (via Postgres.app's `/Users/alex/.local/bin/pg_dump`) works, but the pooler URL stored at `~/crm/supabase/.temp/pooler-url` does NOT contain the password. Sandbox blocks credential lookups (Keychain / env scan) so I cannot retrieve it autonomously.

## Headline finding (from Steps 1 + 4, before live dump)

There is **significant drift** between local migrations and the remote DB:

- **24 local migrations not yet applied remotely** -- the entire Slice 5B / Slice 6 / Slice 7A surfaces (campaign content, `ai_usage_log`, `ai_cache`, `accounts`, 14 `user_id` add-columns).
- **5 remote migrations not present locally** -- `20260427175941`, `20260427180122`, `20260427202955`, `20260427203006`, `20260428232101`. These were applied out-of-band (probably via Supabase SQL editor) and never captured as files.
- **6 non-conformant filenames** -- `phase-1.3.1-gmail-mvp.sql` etc. -- silently SKIPPED by the CLI. Their contents may or may not be live.

Until the live schema is captured, there is no way to confirm which of those local migrations have been replayed manually vs. genuinely missing, and no way to know what the 5 remote-only migrations actually changed.

## Unblock options

Pick one and I'll continue from Step 2:

1. **Recommended:** Run `supabase db pull` -- this generates a new local migration file from the remote state, captures the 5 missing remote migrations, AND produces enough info to reconcile drift. Read-only on the remote.
2. Provide DB password: `! PGPASSWORD='<pwd>' pg_dump --schema-only --schema=public "$(cat ~/crm/supabase/.temp/pooler-url)" > ~/crm/audit/live-schema.sql` -- I can then proceed with full Step 5 inventory.
3. Install Docker Desktop, then re-run the audit normally.

## Files written so far

```
~/crm/audit/migration-list.md         -- per-migration summary + drift recap
~/crm/audit/migration-status.txt      -- raw `supabase migration list` output
~/crm/audit/AUDIT-STATUS.md           -- this file
~/crm/audit/dump-errors.log           -- pg_dump auth failure trace (safe to delete)
~/crm/audit/live-schema.sql           -- empty placeholder, to be populated when unblocked
```

No database state was modified. No credentials were read or written.
