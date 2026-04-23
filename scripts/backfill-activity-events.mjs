#!/usr/bin/env node
// scripts/backfill-activity-events.mjs
// One-time backfill: writes interaction.backfilled events for every
// interactions row from the last 7 days. Idempotent -- checks for existing
// rows with the same object_id before inserting.
//
// Run: node scripts/backfill-activity-events.mjs
// Requires: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + OWNER_USER_ID in .env.local
// Slice 1 -- 2026-04-22.

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
const OWNER_USER_ID = env.OWNER_USER_ID;

for (const [k, v] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY, OWNER_USER_ID: OWNER_USER_ID })) {
  if (!v) { console.error(`Missing ${k} in .env.local`); process.exit(1); }
}

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function main() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch interactions from last 7 days.
  const { data: interactions, error: fetchErr } = await adminClient
    .from('interactions')
    .select('id, contact_id, type, summary, occurred_at, user_id')
    .gte('created_at', sevenDaysAgo)
    .order('occurred_at', { ascending: true });

  if (fetchErr) {
    console.error('Failed to fetch interactions:', fetchErr.message);
    process.exit(1);
  }

  if (!interactions || interactions.length === 0) {
    console.log('No interactions in the last 7 days. Nothing to backfill.');
    return;
  }

  console.log(`Found ${interactions.length} interactions to backfill.`);

  let inserted = 0;
  let skipped = 0;

  for (const interaction of interactions) {
    // Idempotency check: skip if an interaction.backfilled event already
    // exists for this object_id.
    const { data: existing } = await adminClient
      .from('activity_events')
      .select('id')
      .eq('object_table', 'interactions')
      .eq('object_id', interaction.id)
      .eq('verb', 'interaction.backfilled')
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    const { error: insertErr } = await adminClient
      .from('activity_events')
      .insert({
        user_id: OWNER_USER_ID,
        actor_id: OWNER_USER_ID,
        verb: 'interaction.backfilled',
        object_table: 'interactions',
        object_id: interaction.id,
        context: {
          contact_id: interaction.contact_id,
          type: interaction.type,
          summary: interaction.summary,
        },
        occurred_at: interaction.occurred_at,
      });

    if (insertErr) {
      console.error(`Failed to insert for interaction ${interaction.id}:`, insertErr.message);
    } else {
      inserted++;
    }
  }

  console.log(`Backfill complete. Inserted: ${inserted}, Skipped (already existed): ${skipped}.`);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
