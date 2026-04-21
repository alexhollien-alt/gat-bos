// Phase 1.3.2-A acceptance gate.
// Seeds 1 Marlene-keyword email + 1 agent-followup email, drives the real
// generate-draft and approve-and-send routes, verifies escalation_flag +
// escalation_surfaced + escalation_acknowledged / escalation_cleared events.
//
// Modes:
//   seed       -- insert 2 emails, generate 2 drafts via route, print ids
//   act        -- run revise on Marlene draft, discard on BD draft
//   verify     -- query audit_log.event_sequence, assert event presence
//   cleanup    -- soft-delete seeded drafts (status='discarded'); emails stay
//                 since `emails` has no deleted_at column in 1.3.1 schema
//
// Usage:
//   node scripts/phase-1.3.2-a-gate.mjs seed
//   node scripts/phase-1.3.2-a-gate.mjs act
//   node scripts/phase-1.3.2-a-gate.mjs verify
//   node scripts/phase-1.3.2-a-gate.mjs cleanup

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";

const envPath = resolve(homedir(), "crm", ".env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const SITE = process.env.SITE ?? "http://localhost:3000";
const CRON = env.CRON_SECRET;
const STATE_PATH = resolve(homedir(), "crm", "scripts", ".phase-1.3.2-a-state.json");
const TAG = "phase-1.3.2-a";

function loadState() {
  if (!existsSync(STATE_PATH)) return {};
  return JSON.parse(readFileSync(STATE_PATH, "utf8"));
}
function saveState(s) {
  writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
}

const FIXTURES = [
  {
    key: "marlene",
    expectFlag: "marlene",
    gmail_id: `${TAG}-marlene-${Date.now()}`,
    from_email: "fiona.bigbee@example-brokerage.test",
    from_name: "Fiona Bigbee (GATE FIXTURE)",
    subject: "Escrow update -- 4821 Palo Verde closing date",
    body_plain:
      "Hi Alex, wanted to check in on the escrow for 4821 Palo Verde. The title issue we flagged last week is resolved and underwriting cleared the appraisal this morning. Can you confirm the wire instructions before the final walkthrough tomorrow? Buyer is ready to sign at 2pm.",
  },
  {
    key: "followup",
    expectFlag: "agent_followup",
    gmail_id: `${TAG}-followup-${Date.now() + 1}`,
    from_email: "newbie.agent@example-valley.test",
    from_name: "Jordan Newbie (GATE FIXTURE)",
    subject: "New agent looking for a title partner in Phoenix",
    body_plain:
      "Hi Alex -- I am a new agent just getting started in the Phoenix valley and I am looking for a title partner I can build a partnership opportunity with. Would love to chat about how you support new agents and whether you might be open to a referral partner relationship. Thanks!",
  },
];

async function seed() {
  const state = loadState();
  state.created_at = new Date().toISOString();
  state.drafts = {};

  for (const f of FIXTURES) {
    const { data: email, error: emailErr } = await admin
      .from("emails")
      .insert({
        gmail_id: f.gmail_id,
        from_email: f.from_email,
        from_name: f.from_name,
        subject: f.subject,
        body_plain: f.body_plain,
        snippet: f.body_plain.slice(0, 140),
        is_unread: true,
        is_contact_match: false,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (emailErr) {
      console.error(`[${f.key}] email insert failed:`, emailErr.message);
      process.exit(1);
    }
    console.log(`[${f.key}] email inserted id=${email.id}`);

    const res = await fetch(`${SITE}/api/email/generate-draft`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${CRON}`,
      },
      body: JSON.stringify({ email_id: email.id }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`[${f.key}] generate-draft HTTP ${res.status}:`, json);
      process.exit(1);
    }
    console.log(
      `[${f.key}] draft generated id=${json.draft_id} flag=${json.escalation_flag ?? "null"}`,
    );
    if (json.escalation_flag !== f.expectFlag) {
      console.error(
        `[${f.key}] WRONG FLAG -- expected ${f.expectFlag}, got ${json.escalation_flag}`,
      );
      process.exit(2);
    }
    state.drafts[f.key] = {
      email_id: email.id,
      draft_id: json.draft_id,
      expected_flag: f.expectFlag,
    };
  }

  saveState(state);
  console.log("\nSEED OK. state:", STATE_PATH);
}

async function act() {
  const state = loadState();
  if (!state.drafts) {
    console.error("no seed state; run `seed` first");
    process.exit(1);
  }

  // Marlene -> revise  (expect escalation_acknowledged)
  const marlene = state.drafts.marlene;
  const rev = await fetch(`${SITE}/api/email/approve-and-send`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${CRON}`,
    },
    body: JSON.stringify({
      draft_id: marlene.draft_id,
      action: "revise",
      revised_body:
        "Thanks Fiona -- confirming escrow status for 4821 Palo Verde. Wire instructions will come from our operations desk separately; please verify the domain matches great-american-title.com before releasing funds. Walk-through looks good for tomorrow 2pm.\n\nBest,\nAlex",
      revised_subject: "Re: Escrow update -- 4821 Palo Verde closing date",
    }),
  });
  const revJson = await rev.json().catch(() => ({}));
  if (!rev.ok) {
    console.error(`marlene revise HTTP ${rev.status}:`, revJson);
    process.exit(1);
  }
  console.log(`marlene revise OK draft=${marlene.draft_id}`);

  // BD prospect -> discard  (expect escalation_cleared)
  const followup = state.drafts.followup;
  const dsc = await fetch(`${SITE}/api/email/approve-and-send`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${CRON}`,
    },
    body: JSON.stringify({
      draft_id: followup.draft_id,
      action: "discard",
    }),
  });
  const dscJson = await dsc.json().catch(() => ({}));
  if (!dsc.ok) {
    console.error(`followup discard HTTP ${dsc.status}:`, dscJson);
    process.exit(1);
  }
  console.log(`followup discard OK draft=${followup.draft_id}`);
}

async function verify() {
  const state = loadState();
  if (!state.drafts) {
    console.error("no seed state; run `seed` first");
    process.exit(1);
  }

  let fails = 0;

  const expectations = {
    marlene: {
      flag: "marlene",
      terminal_event: "escalation_acknowledged",
      status: "revised",
    },
    followup: {
      flag: "agent_followup",
      terminal_event: "escalation_cleared",
      status: "discarded",
    },
  };

  for (const [key, exp] of Object.entries(expectations)) {
    const d = state.drafts[key];
    const { data: row, error } = await admin
      .from("email_drafts")
      .select("id, escalation_flag, escalation_reason, status, audit_log")
      .eq("id", d.draft_id)
      .maybeSingle();
    if (error || !row) {
      console.error(`[${key}] fetch failed:`, error?.message ?? "no row");
      fails++;
      continue;
    }

    const seq = row.audit_log?.event_sequence ?? [];
    const events = seq.map((e) => e.event);

    const ok =
      row.escalation_flag === exp.flag &&
      row.status === exp.status &&
      events.includes("escalation_surfaced") &&
      events.includes(exp.terminal_event);

    console.log(
      `[${key}] draft=${d.draft_id} flag=${row.escalation_flag} status=${row.status} events=${JSON.stringify(events)} -> ${ok ? "PASS" : "FAIL"}`,
    );
    if (!ok) {
      console.log(`  expected flag=${exp.flag} status=${exp.status} events include escalation_surfaced + ${exp.terminal_event}`);
      console.log(`  reason=${row.escalation_reason}`);
      fails++;
    }
  }

  if (fails) {
    console.error(`\nVERIFY FAIL: ${fails} check(s) failed`);
    process.exit(3);
  }
  console.log("\nVERIFY OK");
}

async function cleanup() {
  const state = loadState();
  if (!state.drafts) {
    console.log("nothing to clean");
    return;
  }
  for (const [key, d] of Object.entries(state.drafts)) {
    // Soft-delete: set status='discarded' (per Rule 3 + Phase 1.3.1 fixture pattern).
    const { error } = await admin
      .from("email_drafts")
      .update({ status: "discarded" })
      .eq("id", d.draft_id);
    if (error) {
      console.error(`[${key}] cleanup failed:`, error.message);
      continue;
    }
    console.log(`[${key}] draft ${d.draft_id} status=discarded`);
  }
}

const mode = process.argv[2];
if (mode === "seed") await seed();
else if (mode === "act") await act();
else if (mode === "verify") await verify();
else if (mode === "cleanup") await cleanup();
else {
  console.error("usage: node scripts/phase-1.3.2-a-gate.mjs [seed|act|verify|cleanup]");
  process.exit(1);
}
