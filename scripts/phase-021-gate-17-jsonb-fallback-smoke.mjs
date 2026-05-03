#!/usr/bin/env node
/**
 * Phase 5.7 smoke test -- Resend webhook JSONB fallback path.
 *
 * Purpose: exercise the exact .contains() call shape used by
 * src/app/api/webhooks/resend/route.ts (post-Phase-5.7 fix) against the
 * existing Phase 5 dry-run row, and assert that the JSONB fallback resolves
 * messages_log.id from a Resend-side fallback_message_id.
 *
 * The Phase 5.6 ship raised PostgREST 22P02 because supabase-js serialized
 * the array argument as a Postgres array literal `cs.{...}`. Phase 5.7
 * wraps the argument in JSON.stringify so the wire format becomes
 * `cs.[{...}]` -- a JSON literal PostgREST accepts.
 *
 * Halt on:
 *   - Postgres 22P02 (the original bug surface). Means the fix did not land.
 *   - Zero rows returned. Means the row was soft-deleted or the
 *     fallback_message_id moved.
 *   - Any non-null .error on the supabase call.
 *
 * Pass:
 *   - One row resolved, id matches the known dry-run messages_log row.
 *
 * Reads ~/crm/.env.local for SUPABASE creds. Service-role only.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";

const KNOWN_MESSAGE_LOG_ID = "bbd25ec5-e656-46fe-8262-25820940c13e";
const KNOWN_RESEND_FALLBACK_ID = "08309aa6-55d2-4986-ac7a-5dc23534fd54";

const envPath = resolve(homedir(), "crm", ".env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [
        l.slice(0, i).trim(),
        l
          .slice(i + 1)
          .trim()
          .replace(/^["']|["']$/g, ""),
      ];
    }),
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}
const admin = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function log(label, payload) {
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(payload, null, 2));
}

// 1. Verify the known row still exists with the expected fallback ID inside
//    event_sequence. If it doesn't, the smoke test premise is invalid.
const { data: source, error: sourceErr } = await admin
  .from("messages_log")
  .select("id, send_mode, provider_message_id, event_sequence, deleted_at")
  .eq("id", KNOWN_MESSAGE_LOG_ID)
  .maybeSingle();

if (sourceErr) {
  log("source row query ERROR", sourceErr);
  process.exit(1);
}
if (!source) {
  log("source row MISSING", {
    expected_id: KNOWN_MESSAGE_LOG_ID,
    note: "Dry-run row gone. Either soft-deleted or new dry-run needed before re-running this smoke.",
  });
  process.exit(1);
}
const fallback = Array.isArray(source.event_sequence)
  ? source.event_sequence.find((e) => e?.event === "sent")?.payload?.fallback_message_id
  : null;
log("source row located", {
  id: source.id,
  send_mode: source.send_mode,
  primary_provider_message_id: source.provider_message_id,
  fallback_message_id_in_event_sequence: fallback,
  deleted_at: source.deleted_at,
});
if (fallback !== KNOWN_RESEND_FALLBACK_ID) {
  log("fallback ID drift", {
    expected: KNOWN_RESEND_FALLBACK_ID,
    actual: fallback,
    note: "Source row's event_sequence no longer contains the expected Resend ID. Smoke test cannot validate the production webhook code path against this row.",
  });
  process.exit(1);
}

// 2. Replay the exact webhook lookup with the Phase 5.7 fix shape.
const containsArg = JSON.stringify([
  { event: "sent", payload: { fallback_message_id: KNOWN_RESEND_FALLBACK_ID } },
]);
log("invoking .contains() with JSON.stringify wrapper", {
  column: "event_sequence",
  arg: containsArg,
});

const { data: jsonbLog, error: jsonbErr } = await admin
  .from("messages_log")
  .select("id")
  .contains("event_sequence", containsArg)
  .is("deleted_at", null)
  .maybeSingle();

if (jsonbErr) {
  log("JSONB fallback FAILED", {
    code: jsonbErr.code,
    message: jsonbErr.message,
    details: jsonbErr.details,
    hint: jsonbErr.hint,
    note:
      jsonbErr.code === "22P02"
        ? "Phase 5.6 bug regressed -- supabase-js serialized as PG array literal again. Verify route.ts wraps the arg in JSON.stringify."
        : "Unexpected error shape -- inspect against PostgREST docs.",
  });
  process.exit(1);
}

if (!jsonbLog?.id) {
  log("JSONB fallback NO MATCH", {
    expected_id: KNOWN_MESSAGE_LOG_ID,
    note: "Fix shipped (no error) but the row didn't match. Investigate jsonb containment semantics or whether deleted_at was set.",
  });
  process.exit(1);
}

if (jsonbLog.id !== KNOWN_MESSAGE_LOG_ID) {
  log("JSONB fallback WRONG ROW", {
    expected_id: KNOWN_MESSAGE_LOG_ID,
    matched_id: jsonbLog.id,
    note: "Containment matched a different row than expected. Likely benign (multiple sends with same fallback would be unusual) but flag for inspection.",
  });
  process.exit(1);
}

log("Phase 5.7 JSONB fallback smoke RESULT", {
  status: "PASS",
  matched_id: jsonbLog.id,
  note:
    "JSON.stringify wrapper produces a wire-compatible JSON literal; PostgREST accepts the containment query and returns the expected row.",
});
process.exit(0);
