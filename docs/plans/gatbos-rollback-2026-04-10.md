# GAT-BOS Reconciliation Rollback Plan

**Date:** 2026-04-10
**Companion to:** `gatbos-reconciliation-plan.md`
**Branch:** `feat/gatbos-schema-reconciliation` (off `feat/spine-phase1`)
**Supabase project:** `rndnxhvibbqqjrzapdxs`

This document is the recovery path if any phase of the GAT-BOS schema reconciliation fails. Read it before starting Phase 4. Keep it open during Phase 4.

---

## What's backed up (Phase 0 snapshot, 2026-04-10)

| File | Rows | Size | SHA-256 (first 16) |
|---|---|---|---|
| `supabase/backups/contacts-pre-gatbos-2026-04-10.json` | 107 | 103453 B | `a9440a0ab42b1d6a` |
| `supabase/backups/tasks-pre-gatbos-2026-04-10.json` | 7 | 3722 B | `740d75eedd7c9aff` |

Both files are PostgREST JSON dumps taken with the real `service_role` key, bypassing RLS. This captured everything including 1 soft-deleted contact that would not appear through the app.

**Not backed up (confirmed empty at snapshot time):**

- `interactions` (0 rows)
- `follow_ups` (0 rows)
- `opportunities` (0 rows)
- `deals` (0 rows, dead table)
- `campaigns` (0 rows)

If any of these gained rows between Phase 0 and Phase 4, re-run the snapshot before proceeding.

**Checksum verification before any restore:**

```bash
cd ~/crm
shasum -a 256 supabase/backups/contacts-pre-gatbos-2026-04-10.json
# expect prefix: a9440a0ab42b1d6a
shasum -a 256 supabase/backups/tasks-pre-gatbos-2026-04-10.json
# expect prefix: 740d75eedd7c9aff
```

If a checksum does not match, STOP. Do not attempt restore. Investigate file integrity first.

---

## Rollback scenarios

There are three failure points. Each needs a different response.

### Scenario A: Phase 2 fails (contacts reshape migration)

**Symptoms:** migration `20260410000200_contacts_reconcile_to_spec.sql` errors during apply, or post-migration smoke test shows app breakage.

**State of the world:** Schema is partially reshaped. Data is intact (the migration is additive + renames, no destructive changes).

**Rollback:**

1. Halt dev server if running.
2. Revert the migration in Supabase using its exact reverse:
   ```sql
   -- Reverse renames
   ALTER TABLE contacts RENAME COLUMN last_touchpoint TO last_touch_date;
   ALTER TABLE contacts RENAME COLUMN next_followup TO next_action_date;
   -- Drop added columns
   ALTER TABLE contacts DROP COLUMN IF EXISTS full_name;
   ALTER TABLE contacts DROP COLUMN IF EXISTS is_dormant;
   ALTER TABLE contacts DROP COLUMN IF EXISTS metadata;
   ALTER TABLE contacts DROP COLUMN IF EXISTS lender_partner_id;
   DROP VIEW IF EXISTS public.contacts_spec_view;
   -- Note: enum values cannot be removed, 'escrow' stays on contact_type enum. Harmless.
   ```
3. Mark the migration as reverted in `supabase_migrations.schema_migrations` if needed.
4. `git revert` the Phase 2 commit.
5. Verify app boots on localhost.
6. No data restore needed. The 107 contacts are untouched.

### Scenario B: Phase 3 fails (new tables migration)

**Symptoms:** migration `20260410000300_gatbos_new_tables.sql` errors during apply.

**State of the world:** Schema has Phase 2 changes + partial Phase 3. Data is intact.

**Rollback:**

1. Halt dev server.
2. Drop the new tables that did get created:
   ```sql
   DROP TABLE IF EXISTS public.email_log CASCADE;
   DROP TABLE IF EXISTS public.events CASCADE;
   DROP TABLE IF EXISTS public.email_inbox CASCADE;
   DROP TABLE IF EXISTS public.voice_memos CASCADE;
   DROP TABLE IF EXISTS public.agent_metrics CASCADE;
   ```
3. `git revert` the Phase 3 commit.
4. Decide: keep Phase 2 live (retry Phase 3 later) OR also rollback Phase 2 per Scenario A.
5. No data restore needed.

### Scenario C: Phase 4 fails (destructive data wipe + xlsx seed)

**This is the dangerous one.** Phase 4 runs `TRUNCATE contacts, interactions, tasks, follow_ups, opportunities RESTART IDENTITY CASCADE` and then re-inserts from the xlsx. If it partially runs and fails mid-flight, the old data is gone and the new data is incomplete.

**Symptoms:** seed script errors after the TRUNCATE statement runs. The transaction should rollback if wrapped in `BEGIN/COMMIT`, but verify.

**State of the world possibilities:**

1. **Transaction rolled back cleanly:** contacts/tasks are back to pre-Phase-4 state. No restore needed. Investigate the seed error, fix, retry.
2. **Transaction committed partially:** some of the xlsx rows are in, old rows are gone. Need full restore from backup.
3. **Seed script ran outside a transaction:** same as option 2.

**Verify which state you're in first:**

```bash
cd ~/crm
SERVICE_ROLE_KEY=$(supabase projects api-keys --project-ref rndnxhvibbqqjrzapdxs -o json 2>/dev/null | python3 -c "import sys,json; keys=json.load(sys.stdin); print(next(k['api_key'] for k in keys if k.get('name')=='service_role'))")
SB_URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2)
curl -sS -D /dev/stderr -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "Prefer: count=exact" -H "Range: 0-0" "$SB_URL/rest/v1/contacts?select=id" 2>&1 | grep -i content-range
unset SERVICE_ROLE_KEY
```

Compare the count to 107 (pre) or 126 (post). Anything else means partial commit.

**Restore procedure (for partial commit):**

1. **Halt the app immediately.** Vercel pause if deployed. Local dev stop.
2. Checksum the backup files (see top of this doc).
3. Run this Python restore script from `~/crm`:

```python
# ~/crm/scripts/restore-contacts-2026-04-10.py
import json, os, subprocess, sys, urllib.request, urllib.parse

def fetch_service_role_key():
    import json as _j
    out = subprocess.check_output(
        ["supabase", "projects", "api-keys", "--project-ref", "rndnxhvibbqqjrzapdxs", "-o", "json"],
        stderr=subprocess.DEVNULL
    )
    keys = _j.loads(out)
    return next(k["api_key"] for k in keys if k.get("name") == "service_role")

def sb_url():
    for line in open(".env.local"):
        if line.startswith("NEXT_PUBLIC_SUPABASE_URL="):
            return line.split("=", 1)[1].strip()
    raise RuntimeError("NEXT_PUBLIC_SUPABASE_URL not found")

def delete_all(table, key, base):
    req = urllib.request.Request(
        f"{base}/rest/v1/{table}?id=neq.00000000-0000-0000-0000-000000000000",
        method="DELETE",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Prefer": "return=minimal"},
    )
    urllib.request.urlopen(req).read()

def insert_rows(table, key, base, rows, columns_to_drop=None):
    columns_to_drop = columns_to_drop or []
    cleaned = []
    for r in rows:
        c = {k: v for k, v in r.items() if k not in columns_to_drop}
        cleaned.append(c)
    data = json.dumps(cleaned).encode()
    req = urllib.request.Request(
        f"{base}/rest/v1/{table}",
        method="POST",
        data=data,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
    )
    try:
        urllib.request.urlopen(req).read()
    except urllib.error.HTTPError as e:
        print("insert failed:", e.read().decode(), file=sys.stderr)
        raise

def main():
    key = fetch_service_role_key()
    base = sb_url()
    print("restoring contacts...")
    with open("supabase/backups/contacts-pre-gatbos-2026-04-10.json") as f:
        contacts = json.load(f)
    # If schema has post-Phase-2 generated columns, drop them before insert
    drop_if_post_phase2 = ["full_name", "is_dormant"]
    delete_all("contacts", key, base)
    insert_rows("contacts", key, base, contacts, columns_to_drop=drop_if_post_phase2)
    print(f"inserted {len(contacts)} contacts")

    print("restoring tasks...")
    with open("supabase/backups/tasks-pre-gatbos-2026-04-10.json") as f:
        tasks = json.load(f)
    delete_all("tasks", key, base)
    insert_rows("tasks", key, base, tasks)
    print(f"inserted {len(tasks)} tasks")

if __name__ == "__main__":
    main()
```

4. Run the restore script:
   ```bash
   cd ~/crm && python3 scripts/restore-contacts-2026-04-10.py
   ```
5. Re-verify row counts match the backup (107, 7).
6. `git revert` the Phase 4 commit.
7. Spin up localhost dev server and smoke test.
8. Debrief in `~/crm/docs/plans/gatbos-postmortem-2026-04-10.md`.

**Note on restoring across schema changes:** The JSON backup captures the PRE-Phase-2 schema (has `last_touch_date`, `next_action_date`, no `full_name`, no `metadata`, etc.). If schema is already post-Phase-2 when you restore, the column names in the JSON still match because Phase 2 uses renames (not drops) and adds (not replaces). Generated columns (`full_name`, `is_dormant`) must be dropped from the JSON payload before insert — the restore script does this.

---

## Git rollback reference

Any phase that produces a commit can be reverted without data loss as long as the migration was not applied. For applied migrations, revert the commit AND revert the migration in the DB per the scenario above.

```bash
# List Phase 0 and subsequent commits
git log --oneline feat/spine-phase1..feat/gatbos-schema-reconciliation

# Revert a specific commit (creates a new revert commit)
git revert <commit-sha>

# Abandon the branch entirely (if nothing has been applied)
git checkout feat/spine-phase1
git branch -D feat/gatbos-schema-reconciliation
# Note: this orphans the local branch. Do NOT force-push if it's been pushed.
```

Never force-push to `feat/spine-phase1` or `main`. Never `git reset --hard` on a branch that has been pushed. Never amend a commit that has been pushed.

---

## Halt and debrief protocol

If Phase 4 goes wrong and you cannot immediately restore:

1. **Stop the app.** Do not let new writes land on the half-broken schema.
2. **Do not run any more migrations.**
3. **Do not `TRUNCATE` anything else.**
4. **Do not delete or move the backup files.**
5. Capture current DB state: counts, error messages, the SQL that failed.
6. Open `~/crm/docs/plans/gatbos-postmortem-2026-04-10.md` and dump everything you know.
7. Ask for help before trying a second recovery. A failed first recovery can compound the problem.

---

## One-time note on the service_role key

During Phase 0 the `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` was found to actually contain the **anon** JWT (role claim = `anon`), not the real service_role. The real service_role key was fetched via `supabase projects api-keys` for the Phase 0 export.

**Action item for Alex:** before Phase 4 runs, fix `.env.local` to contain the real service_role key. Any app code that relies on elevated privileges is currently running as anon and silently returning 0 rows. This may be a hidden production bug in Phase 2.1 RLS work. Grep the codebase for `SUPABASE_SERVICE_ROLE_KEY` and confirm the server-side admin paths still work.

Fetch the correct key with:
```bash
cd ~/crm && supabase projects api-keys --project-ref rndnxhvibbqqjrzapdxs
```
Look for the row named `service_role`. Copy that value into `.env.local`.

---

*End of rollback plan.*
