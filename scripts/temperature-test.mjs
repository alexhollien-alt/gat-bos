// Step 2 verification harness for Morning Brief Phase 1.
// Loads ~/crm/.env.local, runs scoreContacts() against live Supabase,
// prints top 10 (coldest) and bottom 10 (warmest) ranked rows.
//
// Usage:  node scripts/temperature-test.mjs
//
// Inlined scoring logic (mirror of src/lib/scoring/temperature.ts).
// scripts/ is excluded from tsconfig, so we cannot import the .ts module
// directly without a build step. Logic must stay in sync with the .ts file.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";

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

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const CADENCE = { A: 5, B: 10, C: 14 };
const NEVER_TOUCHED_DRIFT = 1000;
const ESCROW_WARMTH_DAYS = 3;

async function scoreContacts() {
  const { data: contacts, error: cErr } = await admin
    .from("contacts")
    .select("id, full_name, brokerage, tier")
    .in("tier", ["A", "B", "C"])
    .is("deleted_at", null);
  if (cErr) throw cErr;
  if (!contacts.length) return [];

  const ids = contacts.map((c) => c.id);

  const [eventsRes, oppsRes] = await Promise.all([
    admin
      .from("interactions")
      .select("contact_id, occurred_at, type")
      .in("contact_id", ids)
      .order("occurred_at", { ascending: false })
      .limit(50000),
    admin
      .from("opportunities")
      .select("contact_id, stage")
      .in("contact_id", ids)
      .in("stage", ["under_contract", "in_escrow"])
      .is("deleted_at", null),
  ]);
  if (eventsRes.error) throw eventsRes.error;
  if (oppsRes.error) throw oppsRes.error;

  const latest = new Map();
  for (const e of eventsRes.data) {
    if (!latest.has(e.contact_id)) {
      latest.set(e.contact_id, { occurred_at: e.occurred_at, type: e.type ?? "interaction" });
    }
  }
  const escrowCounts = new Map();
  for (const o of oppsRes.data) {
    escrowCounts.set(o.contact_id, (escrowCounts.get(o.contact_id) ?? 0) + 1);
  }

  const now = Date.now();
  const rows = contacts.map((c) => {
    const tier_target = CADENCE[c.tier];
    const evt = latest.get(c.id);
    let days = null;
    let verb = null;
    let drift;
    if (evt) {
      days = Math.max(
        0,
        Math.floor((now - new Date(evt.occurred_at).getTime()) / 86_400_000),
      );
      verb = evt.type;
      drift = days - tier_target;
    } else {
      drift = NEVER_TOUCHED_DRIFT;
    }
    const active_escrows = escrowCounts.get(c.id) ?? 0;
    return {
      contact_id: c.id,
      full_name: (c.full_name ?? "").trim(),
      brokerage: c.brokerage ?? null,
      tier: c.tier,
      days_since_last_touchpoint: days,
      last_touchpoint_type: verb,
      tier_target,
      drift,
      active_escrows,
      effective_drift: drift - active_escrows * ESCROW_WARMTH_DAYS,
    };
  });

  rows.sort((a, b) => b.effective_drift - a.effective_drift);
  return rows;
}

function fmt(rows, label) {
  console.log(`\n=== ${label} (${rows.length}) ===`);
  if (!rows.length) {
    console.log("(none)");
    return;
  }
  const pad = (s, n) => String(s ?? "").padEnd(n).slice(0, n);
  console.log(
    pad("name", 28),
    pad("brk", 22),
    pad("tier", 4),
    pad("days", 6),
    pad("verb", 18),
    pad("tgt", 4),
    pad("drift", 6),
    pad("esc", 4),
    pad("eff", 6),
  );
  for (const r of rows) {
    console.log(
      pad(r.full_name, 28),
      pad(r.brokerage, 22),
      pad(r.tier, 4),
      pad(r.days_since_last_touchpoint ?? "n/a", 6),
      pad(r.last_touchpoint_type, 18),
      pad(r.tier_target, 4),
      pad(r.drift === NEVER_TOUCHED_DRIFT ? "never" : r.drift, 6),
      pad(r.active_escrows, 4),
      pad(
        r.drift === NEVER_TOUCHED_DRIFT
          ? "never"
          : r.effective_drift,
        6,
      ),
    );
  }
}

const all = await scoreContacts();
console.log(`Total scored: ${all.length}`);
fmt(all.slice(0, 10), "Top 10 coldest (highest effective_drift first)");
fmt(all.slice(-10).reverse(), "Bottom 10 warmest (lowest effective_drift)");

const withEscrow = all.filter((r) => r.active_escrows > 0);
fmt(withEscrow, "All contacts with active escrows");
