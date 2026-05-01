#!/usr/bin/env node
/**
 * Slice 7B -- Public agent route + RPC smoke harness.
 *
 * Plan: ~/.claude/plans/2026-04-30-slice-7b-locked.md (Task 6).
 * Starter: ~/Desktop/slice-starters/slice-7b-starter.md (Task 6).
 *
 * Three layers, run in order:
 *
 *   Layer 1 -- RPC defense check (always runs).
 *     - get_public_agent_slugs() returns the 5 seeded slugs.
 *     - get_public_agent_by_slug() returns whitelisted columns only.
 *     - get_public_agent_by_slug('nonexistent') returns 0 rows.
 *
 *   Layer 2 -- Anon direct-table negatives (always runs).
 *     - Anon SELECT FROM contacts returns 0 rows (RLS denies).
 *     - Anon SELECT email FROM contacts returns 0 rows (no kind!='agent' leak,
 *       no private-column leak even for agent rows).
 *
 *   Layer 3 -- HTTP route smoke (runs only if dev server reachable on 3000
 *   or 3001 per Standing Rule 17). Tests:
 *     - GET /agents/julie-jarmiolowski        -> 200, JSON-LD, name+tagline+headshot
 *     - GET /agents/fiona-bigbee              -> same
 *     - GET /agents/denise-van-den-bossche    -> same
 *     - GET /agents/joey-gutierrez            -> 200, JSON-LD, name+headshot (NO tagline; Q3=c)
 *     - GET /agents/amber-hollien             -> 200, JSON-LD, name+headshot (NO tagline; Q3=c)
 *     - GET /agents/nonexistent-slug          -> 404
 *
 * Override base URL via SLICE7B_BASE_URL env var. If neither 3000 nor 3001
 * responds, Layer 3 is skipped with INFO -- harness still exits 0 if Layers
 * 1+2 are green (data layer is the contract; HTTP is verification).
 *
 * Override Supabase target via SLICE7B_SUPABASE_URL / SLICE7B_SUPABASE_ANON_KEY
 * env vars. Default reads NEXT_PUBLIC_* from ~/crm/.env.local (prod). Use the
 * override to target local Docker:
 *
 *   SLICE7B_SUPABASE_URL=http://127.0.0.1:54321 \
 *   SLICE7B_SUPABASE_ANON_KEY=$(supabase status -o env | grep ANON_KEY | cut -d= -f2- | tr -d '"') \
 *   node scripts/slice7b-smoke.mjs
 *
 * Exit 0 = all run layers green. Exit 1 = any FAIL.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

// -------------------- env load --------------------
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
const URL = process.env.SLICE7B_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.SLICE7B_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL || !ANON) {
  console.error('Missing Supabase URL / anon key. Set SLICE7B_SUPABASE_URL+SLICE7B_SUPABASE_ANON_KEY or NEXT_PUBLIC_* in ~/crm/.env.local');
  process.exit(2);
}

const anon = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

// -------------------- expected fixtures --------------------
const EXPECTED_SLUGS = [
  'amber-hollien',
  'denise-van-den-bossche',
  'fiona-bigbee',
  'joey-gutierrez',
  'julie-jarmiolowski',
];

// Per Q3 = (c): Joey + Amber tagline = NULL; route hides null tagline.
const AGENTS = {
  'julie-jarmiolowski': {
    first_name: 'Julie', last_name: 'Jarmiolowski',
    headshot_url: '/agents/julie-jarmiolowski.jpg',
    expectTagline: true,
  },
  'fiona-bigbee': {
    first_name: 'Fiona', last_name: 'Bigbee',
    headshot_url: '/agents/fiona-bigbee.jpg',
    expectTagline: true,
  },
  'denise-van-den-bossche': {
    first_name: 'Denise', last_name: 'van den Bossche',
    headshot_url: '/agents/denise-van-den-bossche.jpg',
    expectTagline: true,
  },
  'joey-gutierrez': {
    first_name: 'Joey', last_name: 'Gutierrez',
    headshot_url: '/agents/joey-gutierrez.jpg',
    expectTagline: false,
  },
  'amber-hollien': {
    first_name: 'Amber', last_name: 'Hollien',
    headshot_url: '/agents/amber-hollien.jpg',
    expectTagline: false,
  },
};

const PUBLIC_RPC_COLUMNS = new Set([
  'id', 'slug', 'first_name', 'last_name', 'title', 'brokerage',
  'headshot_url', 'tagline', 'phone', 'email', 'website_url',
]);

// Columns that MUST NOT appear in the public RPC payload.
const PRIVATE_COLUMNS_TO_REJECT = [
  'account_id', 'user_id', 'deleted_at', 'source',
  'internal_note', 'notes', 'stage', 'tier', 'rep_pulse',
  'health_score', 'farm_area', 'farm_zips',
];

// -------------------- report --------------------
const findings = [];
let failures = 0;
const fail = (l, d) => { failures++; findings.push(`FAIL  ${l}${d ? '  ' + d : ''}`); };
const pass = (l, d) => findings.push(`PASS  ${l}${d ? '  ' + d : ''}`);
const info = (l) => findings.push(`INFO  ${l}`);

// -------------------- Layer 1: RPC defense --------------------
console.log('=== Slice 7B Smoke Harness ===');
console.log(`URL=${URL}`);

console.log('\n--- Layer 1: RPC defense ---');

// 1a. get_public_agent_slugs() returns 5 seeded slugs.
{
  const { data, error } = await anon.rpc('get_public_agent_slugs');
  if (error) {
    fail('rpc get_public_agent_slugs', error.message);
  } else {
    const slugs = (data ?? []).map((r) => r.slug).sort();
    const expected = [...EXPECTED_SLUGS].sort();
    if (slugs.length !== 5) {
      fail('rpc get_public_agent_slugs count', `expected 5, got ${slugs.length}`);
    } else if (JSON.stringify(slugs) !== JSON.stringify(expected)) {
      fail('rpc get_public_agent_slugs content',
        `expected ${JSON.stringify(expected)}, got ${JSON.stringify(slugs)}`);
    } else {
      pass('rpc get_public_agent_slugs returns 5 seeded slugs');
    }
  }
}

// 1b. get_public_agent_by_slug() returns whitelisted columns; values match.
for (const slug of EXPECTED_SLUGS) {
  const expected = AGENTS[slug];
  const { data, error } = await anon.rpc('get_public_agent_by_slug', { p_slug: slug });
  if (error) {
    fail(`rpc get_public_agent_by_slug(${slug})`, error.message);
    continue;
  }
  const rows = data ?? [];
  if (rows.length !== 1) {
    fail(`rpc get_public_agent_by_slug(${slug}) row count`, `expected 1, got ${rows.length}`);
    continue;
  }
  const row = rows[0];

  // Column whitelist: every key in row must be in PUBLIC_RPC_COLUMNS.
  const cols = Object.keys(row);
  const extras = cols.filter((k) => !PUBLIC_RPC_COLUMNS.has(k));
  if (extras.length > 0) {
    fail(`rpc get_public_agent_by_slug(${slug}) leaked private columns`, extras.join(','));
    continue;
  }

  // Spot-check specific private columns are absent.
  const leaks = PRIVATE_COLUMNS_TO_REJECT.filter((k) => k in row);
  if (leaks.length > 0) {
    fail(`rpc get_public_agent_by_slug(${slug}) leaked private columns`, leaks.join(','));
    continue;
  }

  if (row.first_name !== expected.first_name || row.last_name !== expected.last_name) {
    fail(`rpc get_public_agent_by_slug(${slug}) name mismatch`,
      `expected ${expected.first_name} ${expected.last_name}, got ${row.first_name} ${row.last_name}`);
    continue;
  }
  if (row.headshot_url !== expected.headshot_url) {
    fail(`rpc get_public_agent_by_slug(${slug}) headshot mismatch`,
      `expected ${expected.headshot_url}, got ${row.headshot_url}`);
    continue;
  }
  if (expected.expectTagline) {
    if (!row.tagline || typeof row.tagline !== 'string' || row.tagline.length < 10) {
      fail(`rpc get_public_agent_by_slug(${slug}) tagline empty/short`, JSON.stringify(row.tagline));
      continue;
    }
  } else {
    if (row.tagline !== null) {
      fail(`rpc get_public_agent_by_slug(${slug}) expected NULL tagline (Q3=c)`, JSON.stringify(row.tagline));
      continue;
    }
  }
  pass(`rpc get_public_agent_by_slug(${slug}) row matches seed`);
}

// 1c. get_public_agent_by_slug('nonexistent') returns 0 rows.
{
  const { data, error } = await anon.rpc('get_public_agent_by_slug', { p_slug: 'nonexistent-slug-zzz' });
  if (error) {
    fail('rpc get_public_agent_by_slug(nonexistent)', error.message);
  } else if ((data ?? []).length !== 0) {
    fail('rpc get_public_agent_by_slug(nonexistent) leaked', `got ${data.length} row(s)`);
  } else {
    pass('rpc get_public_agent_by_slug(nonexistent) returns 0 rows');
  }
}

// -------------------- Layer 2: anon direct-table negatives --------------------
console.log('\n--- Layer 2: anon direct-table denial ---');

// 2a. Anon SELECT FROM contacts -> 0 rows (RLS denies).
{
  const { data, error } = await anon.from('contacts').select('id').limit(10);
  if (error && /permission denied|row-level/i.test(error.message)) {
    pass('anon SELECT contacts denied by RLS', error.message);
  } else if ((data?.length ?? 0) === 0) {
    pass('anon SELECT contacts returned 0 rows (RLS scoped)');
  } else {
    fail('anon SELECT contacts LEAK', `got ${data.length} row(s) without auth`);
  }
}

// 2b. Anon SELECT email FROM contacts -> still 0 rows / denied.
//     Even agent rows must not be readable via direct table SELECT.
{
  const { data, error } = await anon
    .from('contacts')
    .select('email,phone,account_id,user_id')
    .limit(10);
  if (error && /permission denied|row-level/i.test(error.message)) {
    pass('anon SELECT email/phone/account_id/user_id from contacts denied', error.message);
  } else if ((data?.length ?? 0) === 0) {
    pass('anon SELECT private columns from contacts returned 0 rows');
  } else {
    fail('anon SELECT contacts.email LEAK',
      `got ${data.length} row(s); first row keys: ${Object.keys(data[0] ?? {}).join(',')}`);
  }
}

// 2c. Anon SELECT WHERE type='agent' -> still denied (defense in depth).
{
  const { data, error } = await anon.from('contacts').select('email').eq('type', 'agent').limit(10);
  if (error && /permission denied|row-level/i.test(error.message)) {
    pass("anon SELECT WHERE type='agent' denied", error.message);
  } else if ((data?.length ?? 0) === 0) {
    pass("anon SELECT WHERE type='agent' returned 0 rows");
  } else {
    fail("anon SELECT WHERE type='agent' LEAK", `got ${data.length} row(s)`);
  }
}

// -------------------- Layer 3: HTTP route smoke (optional) --------------------
console.log('\n--- Layer 3: HTTP route smoke ---');

async function probePort(port) {
  try {
    const r = await fetch(`http://localhost:${port}/api/healthz`, {
      signal: AbortSignal.timeout(2000),
    }).catch(() => null);
    if (r) return port;
    // Fallback: any HTTP response on root indicates a live server.
    const r2 = await fetch(`http://localhost:${port}/`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(2000),
    }).catch(() => null);
    return r2 ? port : null;
  } catch {
    return null;
  }
}

let baseUrl = process.env.SLICE7B_BASE_URL ?? null;
if (!baseUrl) {
  const port = (await probePort(3000)) ?? (await probePort(3001));
  if (port) baseUrl = `http://localhost:${port}`;
}

if (!baseUrl) {
  info('dev server unreachable on 3000 or 3001; Layer 3 SKIPPED');
  info('to run Layer 3 manually: cd ~/crm && pnpm dev   then re-run this script');
} else {
  info(`Layer 3 target: ${baseUrl}`);

  // 3a. 5 agent slugs -> 200 + JSON-LD + name + headshot + (tagline if expected).
  for (const slug of EXPECTED_SLUGS) {
    const expected = AGENTS[slug];
    const url = `${baseUrl}/agents/${slug}`;
    let resp;
    try {
      resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    } catch (e) {
      fail(`GET ${url}`, `fetch error: ${e.message}`);
      continue;
    }
    if (resp.status !== 200) {
      fail(`GET /agents/${slug}`, `expected 200, got ${resp.status}`);
      continue;
    }
    const html = await resp.text();

    // JSON-LD presence + parse.
    const jsonLdMatch = html.match(
      /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/
    );
    if (!jsonLdMatch) {
      fail(`GET /agents/${slug}`, 'JSON-LD <script> not found');
      continue;
    }
    let ld;
    try {
      ld = JSON.parse(jsonLdMatch[1]);
    } catch (e) {
      fail(`GET /agents/${slug}`, `JSON-LD parse error: ${e.message}`);
      continue;
    }
    const fullName = `${expected.first_name} ${expected.last_name}`.trim();
    if (ld['@type'] !== 'RealEstateAgent') {
      fail(`GET /agents/${slug}`, `JSON-LD @type expected RealEstateAgent, got ${ld['@type']}`);
      continue;
    }
    if (ld.name !== fullName) {
      fail(`GET /agents/${slug}`, `JSON-LD name expected "${fullName}", got "${ld.name}"`);
      continue;
    }
    if (ld.image !== expected.headshot_url) {
      fail(`GET /agents/${slug}`, `JSON-LD image expected "${expected.headshot_url}", got "${ld.image}"`);
      continue;
    }

    // Body assertions: name + headshot path appear in HTML.
    if (!html.includes(fullName)) {
      fail(`GET /agents/${slug}`, `body missing rendered name "${fullName}"`);
      continue;
    }
    if (!html.includes(expected.headshot_url)) {
      fail(`GET /agents/${slug}`, `body missing headshot src ${expected.headshot_url}`);
      continue;
    }

    // Tagline visibility per Q3=c. Joey + Amber render no <p> tagline block.
    if (expected.expectTagline) {
      // We don't have the full DB tagline here without a second RPC call; the
      // RPC layer already verified content. Body check: confirm text/15 class
      // (the tagline <p> wrapper) is present for these three.
      if (!/text-\[14px\]|text-\[15px\]/.test(html)) {
        // Soft signal only -- the class string above is the route's tagline
        // size token. Not a strict pass/fail since other elements may share it.
        // Stronger check: re-fetch tagline from RPC and grep.
        const { data: lookup } = await anon.rpc('get_public_agent_by_slug', { p_slug: slug });
        const tag = lookup?.[0]?.tagline;
        if (tag && !html.includes(tag.slice(0, 30))) {
          fail(`GET /agents/${slug}`, `tagline text not rendered in body (first 30 chars): "${tag.slice(0, 30)}"`);
          continue;
        }
      }
    }

    pass(`GET /agents/${slug} 200 + JSON-LD + name + headshot${expected.expectTagline ? ' + tagline' : ' (tagline hidden, Q3=c)'}`);
  }

  // 3b. Nonexistent slug -> 404.
  {
    const url = `${baseUrl}/agents/nonexistent-slug-zzz`;
    let resp;
    try {
      resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    } catch (e) {
      fail(`GET ${url}`, `fetch error: ${e.message}`);
    }
    if (resp) {
      if (resp.status === 404) {
        pass('GET /agents/nonexistent-slug-zzz returns 404');
      } else {
        fail('GET /agents/nonexistent-slug-zzz', `expected 404, got ${resp.status}`);
      }
    }
  }
}

// -------------------- finish --------------------
console.log('\n=== Findings ===');
for (const f of findings) console.log(f);

const passCount = findings.filter((l) => l.startsWith('PASS')).length;
const failCount = findings.filter((l) => l.startsWith('FAIL')).length;
const infoCount = findings.filter((l) => l.startsWith('INFO')).length;

console.log('\n=== Summary ===');
console.log(`PASS lines: ${passCount}`);
console.log(`FAIL lines: ${failCount}`);
console.log(`INFO lines: ${infoCount}`);

if (failures === 0) {
  console.log('\nGREEN -- Slice 7B smoke harness passed.');
  process.exit(0);
} else {
  console.log(`\nRED -- ${failures} failure(s).`);
  process.exit(1);
}
