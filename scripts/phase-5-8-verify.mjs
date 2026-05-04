// Phase 5.8 verification + synthetic 401 repro for error_logs.user_id NULLABLE
// Steps:
//   1. Verify column nullability via information_schema
//   2. Synthetic 401 on /api/webhooks/resend (no svix headers -> missing-secret OR invalid-signature)
//   3. Synthetic 401 on /api/campaigns/drafts (no auth cookie -> tenant_resolution_error or tenant_not_user)
//   4. Read back error_logs rows for both endpoints, assert user_id IS NULL
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE = process.env.PROD_SITE_URL ?? "https://gat-bos.vercel.app";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(2);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const startedAt = new Date().toISOString();
console.log(`# Phase 5.8 verification (started ${startedAt})\n`);

// --- Step 1: column nullability via PostgREST ---------------------------------
// Easier path: insert a synthetic row with user_id explicitly NULL via
// admin client (bypasses RLS) -- if it succeeds, the NOT NULL constraint is gone.
console.log("## Step 1: column nullability sanity check");
const probeMarker = `phase-5-8-probe-${Date.now()}`;
const { data: probeRow, error: probeErr } = await admin
  .from("error_logs")
  .insert({
    endpoint: "phase-5-8-verify",
    error_message: probeMarker,
    context: { probe: true },
    user_id: null,
  })
  .select("id, user_id, error_message")
  .single();

if (probeErr) {
  console.log(`  FAIL: insert with user_id=NULL rejected: ${probeErr.message}`);
  process.exit(1);
}
console.log(`  PASS: row id=${probeRow.id}, user_id=${probeRow.user_id ?? "NULL"}`);

// --- Step 2: synthetic 401 on /api/webhooks/resend ----------------------------
console.log("\n## Step 2: synthetic 401 on /api/webhooks/resend");
const webhookMarker = `phase-5-8-webhook-${Date.now()}`;
const webhookRes = await fetch(`${SITE}/api/webhooks/resend`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ marker: webhookMarker, type: "test" }),
});
console.log(`  POST -> HTTP ${webhookRes.status}`);
const webhookBody = await webhookRes.text();
console.log(`  body: ${webhookBody.slice(0, 200)}`);

// --- Step 3: synthetic 401 on /api/campaigns/drafts ---------------------------
console.log("\n## Step 3: synthetic 401 on /api/campaigns/drafts");
const draftsMarker = `phase-5-8-drafts-${Date.now()}`;
const draftsRes = await fetch(`${SITE}/api/campaigns/drafts`, {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ id: "00000000-0000-0000-0000-000000000000", action: "approve", marker: draftsMarker }),
});
console.log(`  PATCH -> HTTP ${draftsRes.status}`);
const draftsBody = await draftsRes.text();
console.log(`  body: ${draftsBody.slice(0, 200)}`);

// --- Step 4: confirm breadcrumb rows landed with user_id=NULL -----------------
console.log("\n## Step 4: read back error_logs rows");
// Sleep 2s to let async logError() finish (fire-and-forget)
await new Promise((r) => setTimeout(r, 2000));

const since = startedAt;
const { data: rows, error: readErr } = await admin
  .from("error_logs")
  .select("id, endpoint, error_code, error_message, context, user_id, created_at")
  .gte("created_at", since)
  .in("endpoint", ["/api/webhooks/resend", "/api/campaigns/drafts"])
  .order("created_at", { ascending: false });

if (readErr) {
  console.log(`  FAIL: ${readErr.message}`);
  process.exit(1);
}

console.log(`  found ${rows.length} row(s) since ${since}`);
let webhookRowSeen = false;
let draftsRowSeen = false;
for (const row of rows) {
  console.log(
    `  - id=${row.id} endpoint=${row.endpoint} code=${row.error_code} user_id=${row.user_id ?? "NULL"} reason=${row.context?.reason ?? "(none)"} msg="${row.error_message?.slice(0, 80)}"`,
  );
  if (row.endpoint === "/api/webhooks/resend") webhookRowSeen = true;
  if (row.endpoint === "/api/campaigns/drafts") draftsRowSeen = true;
}

console.log("\n## Summary");
console.log(`  Step 1 (column nullable):       ${probeRow ? "PASS" : "FAIL"}`);
console.log(`  Step 2 (webhook returned 401):  ${webhookRes.status === 401 ? "PASS" : "WARN code=" + webhookRes.status}`);
console.log(`  Step 3 (drafts returned 401):   ${draftsRes.status === 401 ? "PASS" : "WARN code=" + draftsRes.status}`);
console.log(`  Step 4a (webhook row written):  ${webhookRowSeen ? "PASS" : "FAIL"}`);
console.log(`  Step 4b (drafts row written):   ${draftsRowSeen ? "PASS" : "FAIL"}`);
console.log(`  Step 4c (rows have user_id NULL): ${rows.every((r) => r.user_id === null) ? "PASS" : "FAIL"}`);

// Soft-delete the synthetic probe row (rule 3) -- not delete; mark via deleted_at
// error_logs has no deleted_at column, so leave probe row with marker for visibility
console.log(`\n  Probe row (id=${probeRow.id}) left in place with marker=${probeMarker}.`);
console.log(`  error_logs has no deleted_at column; admin client can purge if desired.`);

const allPass =
  probeRow &&
  webhookRes.status === 401 &&
  draftsRes.status === 401 &&
  webhookRowSeen &&
  draftsRowSeen &&
  rows.every((r) => r.user_id === null);

process.exit(allPass ? 0 : 1);
