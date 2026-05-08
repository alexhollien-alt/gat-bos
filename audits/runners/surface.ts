import { execSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { Check, CheckResult } from "../lib/invariants";
import { loadEnv } from "../lib/env";
import { isKnownIssue } from "../lib/known-issues";

function ok(payload: unknown, smell?: string): CheckResult {
  return { pass: true, severity: "green", payload, smell };
}
function red(payload: unknown, smell: string): CheckResult {
  return { pass: false, severity: "red", payload, smell };
}
function yellow(payload: unknown, smell: string, knownIssueId?: string): CheckResult {
  return { pass: false, severity: "yellow", payload, smell, knownIssueId };
}

function baseUrl(): string {
  loadEnv();
  if (process.env.AUDIT_BASE_URL) return process.env.AUDIT_BASE_URL.replace(/\/+$/, "");
  return "https://gat-bos.vercel.app";
}

const FETCH_TIMEOUT_MS = 15000;

async function timedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}

// 1. /api/morning/latest -- auth-gated. Alive if it returns 401 (route exists,
// auth check working) or 200 (somehow public). Anything else is a red.
const surfaceMorningLatest: Check = {
  id: "surface.morning-latest",
  layer: "surface",
  title: "/api/morning/latest responds with auth-gated shape",
  run: async () => {
    const url = `${baseUrl()}/api/morning/latest`;
    try {
      const res = await timedFetch(url);
      if (res.status === 401) {
        return ok({ url, status: 401 }, "route alive, returns 401 unauthenticated as expected");
      }
      if (res.status === 200) {
        const body = await res.json().catch(() => null);
        const hasShape =
          body && typeof body === "object" &&
          "brief_date" in body && "generated_at" in body && "brief_text" in body;
        if (hasShape) return ok({ url, status: 200 }, "200 with expected JSON shape");
        return red({ url, status: 200, body }, "200 but missing brief_date|generated_at|brief_text");
      }
      if (res.status === 404) return red({ url, status: 404 }, "no brief found (404) -- morning-brief cron may be silent");
      return red({ url, status: res.status }, `unexpected status ${res.status}`);
    } catch (err) {
      return red({ url, error: (err as Error).message }, `fetch failed: ${(err as Error).message}`);
    }
  },
};

// 2. /api/cron/morning-brief -- requires Bearer CRON_SECRET. Reading-only
// behavior: GET with the secret returns 200 if cron handler short-circuits
// or completes; without secret, 401. We do not fire writes here. If
// CRON_SECRET is unset, yellow with a smell.
const surfaceCronMorningBrief: Check = {
  id: "surface.cron-morning-brief",
  layer: "surface",
  title: "/api/cron/morning-brief authorizes Bearer CRON_SECRET",
  run: async () => {
    loadEnv();
    const url = `${baseUrl()}/api/cron/morning-brief`;
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      return yellow({ url }, "CRON_SECRET missing from .env.local -- cannot verify cron auth path");
    }
    // First probe: no Authorization should be 401.
    try {
      const noAuth = await timedFetch(url);
      if (noAuth.status !== 401) {
        return red(
          { url, unauthStatus: noAuth.status },
          `expected 401 without Authorization, got ${noAuth.status}`,
        );
      }
      // Second probe: with secret, expect 200 (handler may produce a brief).
      // Cron handler is idempotent per upsert; running it ad-hoc is safe but
      // can take ~30s if it actually generates. We accept 200 OR 504/timeout
      // as alive-route signals; only auth/unexpected statuses are red.
      const withAuth = await timedFetch(url, {
        headers: { Authorization: `Bearer ${secret}` },
      });
      if (withAuth.status === 200) {
        return ok({ url, status: 200 }, "cron auth ok, handler returned 200");
      }
      if (withAuth.status === 401 || withAuth.status === 403) {
        return red(
          { url, status: withAuth.status },
          `Bearer CRON_SECRET rejected (${withAuth.status}) -- env var drift between local + Vercel`,
        );
      }
      return yellow(
        { url, status: withAuth.status },
        `cron handler returned ${withAuth.status} (alive but non-200; check logs)`,
      );
    } catch (err) {
      return red({ url, error: (err as Error).message }, `fetch failed: ${(err as Error).message}`);
    }
  },
};

// 3. /api/webhooks/resend -- POST a Svix-signed dummy event with a bogus
// provider_message_id. The route looks up messages_log; bogus id misses,
// no insert fires, no contact side-effects fire (event_type 'email.sent'
// is not in the delivered/opened/clicked branch). Result: 200, zero DB
// pollution. If RESEND_WEBHOOK_SECRET missing, yellow with KI pointer.
const surfaceResendWebhookProbe: Check = {
  id: "surface.resend-webhook-probe",
  layer: "surface",
  title: "/api/webhooks/resend accepts a Svix-signed probe (no DB side-effects)",
  run: async () => {
    loadEnv();
    const url = `${baseUrl()}/api/webhooks/resend`;
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    const ki = isKnownIssue("resend-webhook-broken");
    if (!secret) {
      return yellow(
        { url },
        "RESEND_WEBHOOK_SECRET missing from .env.local -- cannot probe webhook auth",
        ki?.id,
      );
    }
    const secretBody = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
    let keyBytes: Buffer;
    try {
      keyBytes = Buffer.from(secretBody, "base64");
    } catch (err) {
      return red(
        { error: (err as Error).message },
        "RESEND_WEBHOOK_SECRET not valid base64 after whsec_ strip",
      );
    }
    if (keyBytes.length === 0) {
      return red({}, "RESEND_WEBHOOK_SECRET decoded to zero bytes");
    }

    const svixId = `audit-probe-${Date.now()}`;
    const svixTimestamp = Math.floor(Date.now() / 1000).toString();
    const probeProviderId = `audit-probe-${Date.now()}-no-such-id`;
    const body = JSON.stringify({
      type: "email.sent",
      data: { email_id: probeProviderId, to: ["audit-probe@gat-bos.local"], subject: "audit probe" },
    });
    const signedPayload = `${svixId}.${svixTimestamp}.${body}`;
    const sig = createHmac("sha256", keyBytes).update(signedPayload).digest("base64");

    try {
      const res = await timedFetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "svix-id": svixId,
          "svix-timestamp": svixTimestamp,
          "svix-signature": `v1,${sig}`,
        },
        body,
      });
      if (res.status === 200) {
        const json = await res.json().catch(() => null);
        return ok(
          { url, status: 200, response: json, probeProviderId },
          "webhook auth ok, signed probe accepted (no messages_log match -> no insert)",
        );
      }
      if (res.status === 401) {
        return red(
          { url, status: 401, probeProviderId },
          "signed probe rejected (401) -- RESEND_WEBHOOK_SECRET drift between local + Vercel",
        );
      }
      return red({ url, status: res.status }, `unexpected status ${res.status}`);
    } catch (err) {
      return red({ url, error: (err as Error).message }, `fetch failed: ${(err as Error).message}`);
    }
  },
};

// 4. Latest production GitHub deployment is success state.
const surfaceVercelDeployment: Check = {
  id: "surface.vercel-deployment",
  layer: "surface",
  title: "Latest production deployment on GitHub is in success state",
  run: async () => {
    try {
      const raw = execSync(
        `gh api 'repos/alexhollien-alt/gat-bos/deployments?environment=Production&per_page=1'`,
        { encoding: "utf8", timeout: 15000 },
      );
      const deployments = JSON.parse(raw);
      if (!Array.isArray(deployments) || deployments.length === 0) {
        return yellow({}, "no production deployments found via gh api");
      }
      const latest = deployments[0];
      const statusRaw = execSync(
        `gh api 'repos/alexhollien-alt/gat-bos/deployments/${latest.id}/statuses?per_page=5'`,
        { encoding: "utf8", timeout: 15000 },
      );
      const statuses = JSON.parse(statusRaw);
      const top = Array.isArray(statuses) && statuses.length > 0 ? statuses[0] : null;
      if (!top) return yellow({ deploymentId: latest.id }, "deployment has no status entries yet");
      if (top.state === "success") {
        return ok(
          { deploymentId: latest.id, sha: latest.sha, state: top.state, environment: latest.environment },
          `latest production deployment ${latest.sha?.slice(0, 7)} success`,
        );
      }
      if (top.state === "in_progress" || top.state === "queued" || top.state === "pending") {
        return yellow(
          { deploymentId: latest.id, sha: latest.sha, state: top.state },
          `latest production deployment in ${top.state}`,
        );
      }
      return red(
        { deploymentId: latest.id, sha: latest.sha, state: top.state, target_url: top.target_url },
        `latest production deployment state=${top.state}`,
      );
    } catch (err) {
      return red({ error: (err as Error).message }, `gh api failed: ${(err as Error).message}`);
    }
  },
};

// 5. Dashboard root reachable. Auth-gated route, so 200 (already-signed-in
// pre-render) or 307/302 to /login is the alive shape. Body inspection on
// the redirect target confirms the login page is rendering.
const surfaceDashboardRender: Check = {
  id: "surface.dashboard-render",
  layer: "surface",
  title: "Dashboard root reachable (200 or auth redirect)",
  run: async () => {
    const url = `${baseUrl()}/dashboard`;
    try {
      const res = await timedFetch(url, { redirect: "manual" });
      if (res.status === 200) {
        const body = await res.text();
        const hasMask = /headshot-mask/.test(body);
        const hasError = /Application error|next-error|<pre[^>]*>Error/i.test(body);
        if (hasError) return red({ url, status: 200 }, "200 but body contains application error markers");
        return ok(
          { url, status: 200, headshotMaskPresent: hasMask, bodyLength: body.length },
          hasMask ? "200, headshot-mask class present" : "200 but headshot-mask not in initial HTML (SSR-deferred?)",
        );
      }
      if (res.status === 302 || res.status === 307) {
        const loc = res.headers.get("location") ?? "";
        if (/\/login/.test(loc)) {
          return ok({ url, status: res.status, location: loc }, `auth redirect to ${loc}`);
        }
        return yellow({ url, status: res.status, location: loc }, `redirect to non-login: ${loc}`);
      }
      return red({ url, status: res.status }, `unexpected status ${res.status}`);
    } catch (err) {
      return red({ url, error: (err as Error).message }, `fetch failed: ${(err as Error).message}`);
    }
  },
};

export const surfaceChecks: Check[] = [
  surfaceMorningLatest,
  surfaceCronMorningBrief,
  surfaceResendWebhookProbe,
  surfaceVercelDeployment,
  surfaceDashboardRender,
];

if (require.main === module) {
  (async () => {
    const { runAll } = await import("../lib/invariants");
    const { writeMarkdown, writeJSON, todayDate } = await import("../lib/report");
    const date = todayDate();
    const records = await runAll(surfaceChecks);
    const md = writeMarkdown({ date, checks: records });
    const json = writeJSON({ date, checks: records });
    console.log(`AUDIT ${date} (surface-only)`);
    console.log(`  markdown: ${md}`);
    console.log(`  json:     ${json}`);
    console.log(`  checks:   ${records.length}`);
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
