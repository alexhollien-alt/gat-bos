#!/usr/bin/env node
// scripts/log-event.test.mjs
// Smoke test for log-event.mjs.
// Writes a deliverable.shipped event with test context, SELECTs it back,
// verifies shape, then soft-deletes the row.
// Phase 1 gate of ~/.claude/plans/idempotent-toasting-tome.md.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

const envPath = resolve(homedir(), 'crm', '.env.local');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

const testObjectId = randomUUID();
const testContext = {
  contact_id: null,
  format: 'flyer',
  file_path: '/tmp/smoke.pdf',
  skill: 're-print-design',
  smoke_test: true,
};

const cliPath = resolve(__dirname, 'log-event.mjs');
const result = spawnSync(
  'node',
  [
    cliPath,
    '--verb', 'deliverable.shipped',
    '--object-table', 'deliverables',
    '--object-id', testObjectId,
    '--context', JSON.stringify(testContext),
  ],
  { encoding: 'utf8' }
);

if (result.status !== 0) {
  fail(`CLI exited ${result.status}: ${result.stderr}`);
}

let payload;
try {
  payload = JSON.parse(result.stdout.trim());
} catch (e) {
  fail(`CLI stdout not JSON: ${result.stdout}`);
}

if (!payload.id || !payload.occurred_at) fail(`CLI payload missing id/occurred_at: ${result.stdout}`);

const { data: row, error } = await admin
  .from('activity_events')
  .select('id, verb, object_table, object_id, context, actor_id, deleted_at')
  .eq('id', payload.id)
  .single();

if (error) fail(`SELECT failed: ${error.message}`);
if (row.verb !== 'deliverable.shipped') fail(`verb mismatch: ${row.verb}`);
if (row.object_table !== 'deliverables') fail(`object_table mismatch: ${row.object_table}`);
if (row.object_id !== testObjectId) fail(`object_id mismatch: ${row.object_id}`);
if (row.context?.smoke_test !== true) fail(`context.smoke_test not preserved`);
if (!/^[0-9a-f-]{36}$/i.test(row.actor_id)) fail(`actor_id not a uuid: ${row.actor_id}`);
if (row.deleted_at !== null) fail(`row already soft-deleted`);

// Soft-delete the smoke row.
const { error: delErr } = await admin
  .from('activity_events')
  .update({ deleted_at: new Date().toISOString() })
  .eq('id', payload.id);

if (delErr) fail(`soft-delete failed: ${delErr.message}`);

console.log(`PASS: wrote + verified + soft-deleted activity_event ${payload.id}`);
