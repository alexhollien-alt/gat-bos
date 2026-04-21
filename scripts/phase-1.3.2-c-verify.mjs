// Phase 1.3.2-C verification.
// Confirms email_drafts_observation view exists, returns rows matching
// email_drafts row count, and produces sane action_taken / contact_tier
// distributions. Service-role client per readout helper convention.
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function fmt(label, value) {
  console.log(`  ${label.padEnd(28)} ${value}`);
}

async function main() {
  console.log("Phase 1.3.2-C verification\n");

  // Gate 1: view exists and returns rows
  const { data: viewRows, error: viewErr } = await supabase
    .from("email_drafts_observation")
    .select("*");
  if (viewErr) {
    console.error("FAIL: view query errored:", viewErr.message);
    process.exit(1);
  }
  console.log("Gate 1: view exists and is queryable -- PASS");
  fmt("rows in observation view:", viewRows.length);

  // Gate 2: row count matches email_drafts (LEFT JOIN means 1:1 with d)
  const { count: draftCount, error: draftErr } = await supabase
    .from("email_drafts")
    .select("*", { count: "exact", head: true });
  if (draftErr) {
    console.error("FAIL: email_drafts count errored:", draftErr.message);
    process.exit(1);
  }
  fmt("rows in email_drafts:", draftCount);
  if (viewRows.length !== draftCount) {
    console.error(
      `FAIL: row count mismatch -- view=${viewRows.length}, drafts=${draftCount}`,
    );
    process.exit(1);
  }
  console.log("Gate 2: row count matches email_drafts -- PASS");

  // Gate 3: action_taken distribution makes sense
  const actionCounts = viewRows.reduce(
    (acc, r) => {
      const k = r.action_taken ?? "pending";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    },
    {},
  );
  console.log("\naction_taken distribution:");
  for (const [k, v] of Object.entries(actionCounts).sort()) {
    fmt(k + ":", v);
  }

  const tierCounts = viewRows.reduce(
    (acc, r) => {
      const k = r.contact_tier ?? "none";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    },
    {},
  );
  console.log("\ncontact_tier distribution:");
  for (const [k, v] of Object.entries(tierCounts).sort()) {
    fmt(k + ":", v);
  }

  const escalationCounts = viewRows.reduce(
    (acc, r) => {
      const k = r.escalation_flag ?? "none";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    },
    {},
  );
  console.log("\nescalation_flag distribution:");
  for (const [k, v] of Object.entries(escalationCounts).sort()) {
    fmt(k + ":", v);
  }

  // Spot-check a few rows for shape
  console.log("\nsample rows (up to 3):");
  for (const r of viewRows.slice(0, 3)) {
    console.log("  --");
    fmt("draft_id:", r.draft_id);
    fmt("contact_tier:", r.contact_tier ?? "(null)");
    fmt("escalation_flag:", r.escalation_flag ?? "(null)");
    fmt("action_taken:", r.action_taken ?? "(null)");
    fmt("time_to_action_seconds:", r.time_to_action_seconds ?? "(null)");
    fmt("was_revised:", r.was_revised);
  }

  console.log("\nALL GATES PASS");
}

main().catch((e) => {
  console.error("verification crashed:", e);
  process.exit(1);
});
