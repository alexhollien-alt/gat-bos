# Rebuilding `node_events` from `activity_events`

`node_events` is a read-optimized projection of `activity_events`, controlled
by a verb whitelist. The projection is maintained by a DB trigger
(`project_activity_to_node_events`) that fires `AFTER INSERT` on
`activity_events`. The trigger is idempotent.

If the whitelist changes (verb added, verb removed, projection logic
updated), historical rows need to be replayed through the new logic. That is
what `rebuild_node_events_from_activity()` does.

## When to run

Only in these cases:

- A new migration changes the projection whitelist or the field projection
  logic, and you want the historical `node_events` to match the new rules.
- Data corruption is suspected (`node_events` count mismatches the expected
  count from a fresh whitelist scan over `activity_events`).
- Manual recovery after an accidental TRUNCATE or DELETE on `node_events`
  (the source of truth is intact in `activity_events`).

If none of the above are true, do not run this. The trigger keeps everything
in sync on insert; `node_events` will not silently drift between rebuilds.

## How to run

Via the Supabase CLI against the linked project:

```bash
cd ~/crm
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" \
  -c "SELECT public.rebuild_node_events_from_activity();"
```

Or inside a fresh migration when wiring is part of the schema change:

```sql
SELECT public.rebuild_node_events_from_activity();
```

The function returns the row count inserted.

## Safety

- `TRUNCATE public.node_events` runs first. That removes every row,
  including any rows that downstream code might be reading.
- Brief window of "no data" between TRUNCATE and the INSERT...SELECT.
  Acceptable because the function runs in a single transaction; readers see
  either the old state or the new state, never an empty table externally.
- `node_events` is a projection of `activity_events`. Truncating is
  recoverable because the source ledger is intact. There is no
  user-authored data in `node_events` that would be lost.
- Never automate this. Run only after confirming the new whitelist or fix
  is correct.
- The function is `SECURITY DEFINER` and bypasses RLS. Call it only from
  the operator session (psql over the linked URL or a one-off migration).

## How the whitelist lives in three places

The same verb-to-type mapping is inlined in three files. They must stay in
sync.

1. `supabase/migrations/20260520194801_task_system_phase0.sql`
   - `project_activity_to_node_events()` trigger function (the live mapping)
   - `rebuild_node_events_from_activity()` replay function (used here)
2. `src/lib/task-system/projected-verbs.ts` -- the TypeScript constant the
   application uses for any client-side reasoning about projection rules.

Adding a new verb is a three-edit change. Write a new migration, update
both SQL sites and the TS const, then call `rebuild_node_events_from_activity()`
to project the historical rows.
