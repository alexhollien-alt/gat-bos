// Cypher Pull Worker -- entry point.
// Orchestrates: login -> scrape -> sync -> teardown.
//
// WORKER_MODE env var:
//   sync     (default) -- JSON API, covers 50 most recent tickets
//   backfill           -- HTML list pagination, full historical scrape
//
// Required env vars:
//   CYPHER_USERNAME, CYPHER_PASSWORD
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js';
import { cypherLogin } from './login.js';
import { scrapeViaJsonApi, scrapeViaHtmlList } from './scrape-list.js';
import { syncTickets } from './sync.js';

const {
  CYPHER_USERNAME,
  CYPHER_PASSWORD,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  WORKER_MODE = 'sync',
} = process.env;

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

async function main() {
  const username = requireEnv('CYPHER_USERNAME');
  const password = requireEnv('CYPHER_PASSWORD');
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  const mode = WORKER_MODE === 'backfill' ? 'backfill' : 'sync';
  console.log(`[cypher-pull] Starting in ${mode} mode`);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { browser, page } = await cypherLogin(username, password);

  try {
    const tickets =
      mode === 'backfill'
        ? await scrapeViaHtmlList(page)
        : await scrapeViaJsonApi(page);

    console.log(`[cypher-pull] Scraped ${tickets.length} tickets`);

    const result = await syncTickets(supabase, tickets);
    console.log(
      `[cypher-pull] Sync complete -- updated: ${result.updated}, backfilled: ${result.backfilled}, unchanged: ${result.unchanged}, unmatched: ${result.unmatched}`
    );
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('[cypher-pull] Fatal error:', err);
  process.exit(1);
});
