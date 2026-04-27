/**
 * Verification harness for QA F2 + F4 fixes against prod (commit 262fb19).
 *
 * F4 -- /opportunities must NOT render the two soft-deleted fixtures:
 *   - "B3 Test 5 -- refetchOnFocus" (id 59a61618...)
 *   - "B3 gate test -- do not ship"  (id b02c6704...)
 *
 * F2 -- /dashboard must NOT issue any 404 against PostgREST `agent_health`.
 */
import { chromium } from 'playwright';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { ensureAuthState } from './phase-9-prod-auth-helper.mjs';

const SITE = 'https://gat-bos.vercel.app';
const STATE_PATH = resolve(tmpdir(), 'phase-9-prod-auth-state.json');

const SOFT_DELETED_ADDRESSES = [
  'B3 Test 5 -- refetchOnFocus',
  'B3 gate test -- do not ship',
];

async function probe(page, path, settleMs = 4000) {
  const reqs = [];
  page.on('response', (resp) => {
    const url = resp.url();
    reqs.push({ url, status: resp.status() });
  });
  await page.goto(`${SITE}${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(settleMs);
  const html = await page.content();
  return { html, reqs };
}

async function main() {
  await ensureAuthState(STATE_PATH);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH });

  // F4: /opportunities
  const oppPage = await context.newPage();
  const opp = await probe(oppPage, '/opportunities', 5000);
  const oppFinalUrl = oppPage.url();
  const softDelHits = SOFT_DELETED_ADDRESSES.filter((a) => opp.html.includes(a));
  await oppPage.close();

  // F2: /dashboard
  const dashPage = await context.newPage();
  const dash = await probe(dashPage, '/dashboard', 6000);
  const dashFinalUrl = dashPage.url();
  const agentHealth404s = dash.reqs.filter(
    (r) => r.url.includes('agent_health') && r.status === 404,
  );
  const agentHealthAny = dash.reqs.filter((r) => r.url.includes('agent_health'));
  await dashPage.close();

  await browser.close();

  const verdict = {
    F4: {
      url: oppFinalUrl,
      pass: softDelHits.length === 0,
      softDeletedAddressesRendered: softDelHits,
    },
    F2: {
      url: dashFinalUrl,
      pass: agentHealth404s.length === 0,
      agentHealthRequestsTotal: agentHealthAny.length,
      agentHealth404s: agentHealth404s.map((r) => ({ url: r.url, status: r.status })),
    },
  };
  console.log(JSON.stringify(verdict, null, 2));
  if (!verdict.F4.pass || !verdict.F2.pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
