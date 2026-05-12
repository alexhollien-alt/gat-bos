#!/usr/bin/env node
// scripts/log-event.mjs
// CLI bridge for writing a single row into activity_events.
// Mirrors src/lib/activity/writeEvent.ts insert shape, using service-role.
//
// Usage:
//   node scripts/log-event.mjs \
//     --verb deliverable.shipped \
//     --object-table deliverables \
//     --object-id <uuid> \
//     --context '{"contact_id":"<uuid>","format":"flyer"}' \
//     [--actor <slug-or-uuid>]  (default: "system")
//
// Resolves user_id by looking up GOOGLE_USER_EMAIL in auth.users via admin API.
// Emits {id, occurred_at} JSON on stdout on success.
// Phase 1 of ~/.claude/plans/idempotent-toasting-tome.md.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

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

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const OWNER_EMAIL = env.GOOGLE_USER_EMAIL;

for (const [k, v] of Object.entries({
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
  GOOGLE_USER_EMAIL: OWNER_EMAIL,
})) {
  if (!v) {
    console.error(`Missing ${k} in .env.local`);
    process.exit(1);
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

const args = parseArgs(process.argv);
const verb = args.verb;
const objectTable = args['object-table'];
const objectId = args['object-id'];
const actor = args.actor || null; // null => default to owner user_id post-resolve
const contextRaw = args.context || '{}';

if (!verb || !objectTable || !objectId) {
  console.error('Required: --verb <v> --object-table <t> --object-id <uuid> [--context <json>] [--actor <id>]');
  process.exit(1);
}

let context;
try {
  context = JSON.parse(contextRaw);
} catch (e) {
  console.error(`Invalid --context JSON: ${e.message}`);
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function resolveOwnerUserId() {
  // Page through auth.users until we find the owner email match.
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error(`auth.admin.listUsers failed: ${error.message}`);
      process.exit(1);
    }
    const match = data.users.find((u) => (u.email || '').toLowerCase() === OWNER_EMAIL.toLowerCase());
    if (match) return match.id;
    if (data.users.length < perPage) break;
    page++;
  }
  console.error(`No auth.users row matches GOOGLE_USER_EMAIL=${OWNER_EMAIL}`);
  process.exit(1);
}

async function main() {
  const userId = await resolveOwnerUserId();
  const actorId = actor ?? userId;
  const { data, error } = await admin
    .from('activity_events')
    .insert({
      user_id: userId,
      actor_id: actorId,
      verb,
      object_table: objectTable,
      object_id: objectId,
      context,
    })
    .select('id, occurred_at')
    .single();

  if (error) {
    console.error(`insert failed: ${error.message}`);
    process.exit(1);
  }
  process.stdout.write(JSON.stringify({ id: data.id, occurred_at: data.occurred_at }) + '\n');
}

main();
