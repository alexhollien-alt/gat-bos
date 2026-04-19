#!/usr/bin/env node
/**
 * Phase 9 Gate 1 -- Lighthouse performance >= 85 on /today.
 *
 * Flow:
 *   1. Auth helper mints a Supabase session for alex via magic link.
 *   2. Playwright writes storage state to /tmp/phase-9-auth-state.json.
 *   3. Cookies for localhost:3000 are composed into a single Cookie header string.
 *   4. `lighthouse` (programmatic) runs against http://localhost:3000/today using a
 *      Chrome instance launched by chrome-launcher, with extraHeaders.Cookie set so
 *      the middleware treats the request as authenticated alex.
 *   5. Report written to ~/Desktop/phase-9-lighthouse-today.{json,html}.
 *   6. Pass if performance category score >= 0.85.
 *
 * Exit 0 = PASS. Non-zero = fail.
 */
import { ensureAuthState, loadEnv } from './phase-9-auth-helper.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import lighthouse from 'lighthouse';
import { launch as launchChrome } from 'chrome-launcher';

const STATE = resolve(tmpdir(), 'phase-9-auth-state.json');
const { SITE } = loadEnv();
const TARGET = `${SITE}/today`;
const REPORT_JSON = resolve(homedir(), 'Desktop', 'phase-9-lighthouse-today.json');
const REPORT_HTML = resolve(homedir(), 'Desktop', 'phase-9-lighthouse-today.html');
const THRESHOLD = 0.85;

console.log('[gate-1] Ensuring alex session...');
await ensureAuthState(STATE);

// Build Cookie header for localhost.
const state = JSON.parse(readFileSync(STATE, 'utf8'));
const cookies = state.cookies.filter((c) => c.domain === 'localhost' || c.domain === '.localhost');
if (cookies.length === 0) throw new Error('No cookies captured for localhost');
const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
console.log(`[gate-1] Using ${cookies.length} cookies (${cookieHeader.length} chars)`);

console.log('[gate-1] Launching Chrome for Lighthouse...');
const chrome = await launchChrome({
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
});

try {
  console.log(`[gate-1] Running Lighthouse against ${TARGET}...`);
  const runnerResult = await lighthouse(TARGET, {
    port: chrome.port,
    output: ['json', 'html'],
    logLevel: 'error',
    onlyCategories: ['performance'],
    extraHeaders: { Cookie: cookieHeader },
    // Desktop preset so we're comparing against a realistic dashboard context.
    formFactor: 'desktop',
    screenEmulation: { mobile: false, width: 1440, height: 900, deviceScaleFactor: 1, disabled: false },
    throttlingMethod: 'simulate',
    throttling: {
      rttMs: 40,
      throughputKbps: 10 * 1024,
      cpuSlowdownMultiplier: 1,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0,
    },
  });

  if (!runnerResult) throw new Error('Lighthouse returned no result');
  const [jsonReport, htmlReport] = runnerResult.report;
  writeFileSync(REPORT_JSON, jsonReport);
  writeFileSync(REPORT_HTML, htmlReport);
  console.log(`[gate-1] Report written to ${REPORT_JSON}`);
  console.log(`[gate-1] Report written to ${REPORT_HTML}`);

  const lhr = runnerResult.lhr;
  const perfScore = lhr.categories.performance?.score ?? null;
  const finalUrl = lhr.finalDisplayedUrl || lhr.finalUrl || lhr.requestedUrl;
  const audits = lhr.audits;
  const metrics = {
    fcp: audits['first-contentful-paint']?.numericValue,
    lcp: audits['largest-contentful-paint']?.numericValue,
    tbt: audits['total-blocking-time']?.numericValue,
    cls: audits['cumulative-layout-shift']?.numericValue,
    si: audits['speed-index']?.numericValue,
    tti: audits['interactive']?.numericValue,
  };

  console.log('\n=== Phase 9 Gate 1 -- Lighthouse /today ===');
  console.log(`Final URL: ${finalUrl}`);
  if (finalUrl && finalUrl.includes('/login')) {
    console.error('FAIL: Lighthouse followed a redirect to /login. Auth cookies did not stick.');
    process.exit(2);
  }
  console.log(`Performance score: ${(perfScore * 100).toFixed(1)} / 100`);
  for (const [k, v] of Object.entries(metrics)) {
    if (v !== undefined) console.log(`  ${k}: ${Math.round(v)}${k === 'cls' ? '' : 'ms'}`);
  }

  if (perfScore >= THRESHOLD) {
    console.log(`\nPASS (>= ${THRESHOLD * 100})`);
    process.exit(0);
  }
  console.log(`\nFAIL (< ${THRESHOLD * 100})`);
  process.exit(1);
} finally {
  await chrome.kill();
}
