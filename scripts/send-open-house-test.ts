// scripts/send-open-house-test.ts
// Gated test-send runner for an open house blast. Runs the SAME production
// pipeline as the preview Approve button (preflight, batch, throttle, warmup,
// subdomain From, List-Unsubscribe headers, blast_sends ledger).
//
// PRECONDITIONS (all required for a successful send):
//   1. opens.alexhollienco.com verified in Resend (DNS/SPF/DKIM/DMARC added).
//   2. A real RESEND_API_KEY in .env.production.local or .env.local.
//   3. Supabase env pointing at the DB that holds the blast + recipients.
//
// Recommended target: a blast whose city is "__mailtest__" so it goes only to
// the controlled seed inboxes (mail-tester address + your Gmail/Outlook/Yahoo).
//
// Run:  pnpm exec tsx scripts/send-open-house-test.ts <blastId> --confirm
import { readFileSync, existsSync } from "node:fs";

// Load env from prod-first, then local, BEFORE importing the pipeline so the
// adminClient + Resend sender pick up the right credentials.
for (const f of [".env.production.local", ".env.local"]) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const k = m[1];
    if (process.env[k]) continue; // first file wins
    process.env[k] = m[2].replace(/^["']|["']$/g, "");
  }
}

const blastId = process.argv[2];
const confirmed = process.argv.includes("--confirm");

if (!blastId) {
  console.error("Usage: pnpm exec tsx scripts/send-open-house-test.ts <blastId> --confirm");
  process.exit(1);
}
if (!confirmed) {
  console.error("Refusing to send without --confirm. This sends real email through Resend.");
  process.exit(1);
}
if (!process.env.RESEND_API_KEY) {
  console.error("RESEND_API_KEY not found in env files. Aborting.");
  process.exit(1);
}

(async () => {
  // Dynamic import so the env above is set first.
  const { loadBlast, sendBlast } = await import("../src/lib/open-house/sender");
  const blast = await loadBlast(blastId);
  if (!blast) {
    console.error("Blast not found:", blastId);
    process.exit(1);
  }
  console.log(`Sending blast ${blastId} (city=${blast.city}) ...`);
  const summary = await sendBlast({ blastId, actorUserId: blast.user_id });
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok && summary.report) console.log(summary.report);
  process.exit(summary.ok ? 0 : 2);
})();
