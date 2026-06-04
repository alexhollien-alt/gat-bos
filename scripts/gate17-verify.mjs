#!/usr/bin/env node
/**
 * Gate 17 verification -- Resend webhook config + signing-secret parity.
 *
 * Reads PROD creds from .env.prod-probe.local (gitignored sidecar pulled via
 * `vercel env pull`). NEVER prints raw secrets -- only sha256-prefix hashes,
 * boolean match, and non-sensitive webhook fields (status, endpoint, events).
 *
 * Resolves the four BLOCKERS.md hypotheses:
 *   (a) endpoint missing    -> no webhook with our URL in GET /webhooks
 *   (b) endpoint disabled    -> status !== 'enabled'
 *   (c) wrong URL            -> endpoint != https://gat-bos.vercel.app/api/webhooks/resend
 *   (d) secret mismatch      -> signing_secret hash != RESEND_WEBHOOK_SECRET hash
 */
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const env = Object.fromEntries(
  readFileSync(resolve(homedir(), 'crm', '.env.prod-probe.local'), 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

const sha8 = (s) => (s ? createHash('sha256').update(s).digest('hex').slice(0, 12) : null);
const EXPECTED_URL = 'https://gat-bos.vercel.app/api/webhooks/resend';
// Prefer a full-access key (manages webhooks); fall back to the send-only key.
const apiKey = env.RESEND_FULL_API_KEY || env.RESEND_API_KEY;
const vercelSecret = env.RESEND_WEBHOOK_SECRET; // write-only in Vercel -> pulls empty; compare best-effort

const out = {
  resend_api_key_present: !!apiKey,
  vercel_webhook_secret_present: !!vercelSecret,
  vercel_secret_prefix_ok: vercelSecret?.startsWith('whsec_') ?? false,
  vercel_secret_hash: sha8(vercelSecret),
};

// 1. List webhooks
const listRes = await fetch('https://api.resend.com/webhooks', {
  headers: { Authorization: `Bearer ${apiKey}` },
});
out.list_http = listRes.status;
const list = await listRes.json().catch(() => ({}));
out.webhooks = (list.data ?? []).map((w) => ({
  id: w.id, status: w.status, endpoint: w.endpoint, events: w.events,
}));

// 2. Find the one matching our endpoint (and report any near-misses)
const match = (list.data ?? []).find((w) => w.endpoint === EXPECTED_URL);
const pathMatch = (list.data ?? []).find((w) => (w.endpoint || '').includes('/api/webhooks/resend'));
out.exact_url_match = !!match;
out.path_match_diff_host = pathMatch && !match ? pathMatch.endpoint : null;

const target = match || pathMatch;
if (target) {
  // 3. Get single webhook -> signing_secret
  const getRes = await fetch(`https://api.resend.com/webhooks/${target.id}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  out.get_http = getRes.status;
  const wh = await getRes.json().catch(() => ({}));
  out.target = { id: wh.id, status: wh.status, endpoint: wh.endpoint, events: wh.events };
  out.resend_signing_secret_hash = sha8(wh.signing_secret);
  out.SECRET_MATCH = !!wh.signing_secret && !!vercelSecret && wh.signing_secret === vercelSecret;
  out.subscribed_to_email_events = (wh.events ?? []).some((e) => String(e).startsWith('email.'));
}

// 4. Corroborate against prod Supabase: message_events ever + error_logs tally
try {
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { count: meCount } = await admin
    .from('message_events').select('*', { count: 'exact', head: true });
  const { data: el } = await admin
    .from('error_logs')
    .select('created_at, error_message, context, status_code')
    .ilike('endpoint', '%webhooks/resend%')
    .order('created_at', { ascending: false })
    .limit(50);
  out.prod_message_events_total = meCount;
  out.prod_error_logs_webhook_total = el?.length ?? 0;
  out.prod_error_logs_reason_tally = (el ?? []).reduce((a, r) => {
    const k = r.context?.reason ?? r.error_message ?? 'unknown';
    a[k] = (a[k] ?? 0) + 1; return a;
  }, {});
  out.prod_error_logs_recent = (el ?? []).slice(0, 5).map((r) => ({
    at: r.created_at, reason: r.context?.reason, code: r.status_code,
  }));
} catch (e) {
  out.prod_supabase_error = e.message;
}

console.log(JSON.stringify(out, null, 2));
