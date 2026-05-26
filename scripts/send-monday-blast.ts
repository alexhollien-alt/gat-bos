/**
 * Monday Morning Blast sender.
 *
 * Run:  pnpm tsx scripts/send-monday-blast.ts [--dry-run | --test]
 *
 * Modes:
 *   --dry-run  Print the recipient list + count and exit. Sends nothing.
 *   --test     Send ONLY to the test inbox (bypasses the contacts query).
 *              This is the exact send path the real blast uses.
 *   (none)     Real blast. Queries every contact with an email (excluding the
 *              two opt-outs), shows a confirmation gate, and only proceeds on
 *              literal "SEND TO ALL".
 *
 * Audience: all contacts with deleted_at IS NULL and a non-empty email,
 * EXCEPT Denise van den Bossche and Norm Hampton (excluded by id, with an
 * email-match belt-and-suspenders pass after fetch).
 *
 * Reads production credentials from .env.production.local at repo root
 * (pull first with: vercel env pull .env.production.local --environment=production).
 *
 * Note: Resend's API sits behind Cloudflare, which 403s the default Node
 * User-Agent -- the resend SDK sets its own UA, so direct fetch is not used here.
 */
import { readFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

const FROM = "Alex Hollien <alex@alexhollienco.com>";
const SUBJECT = "Two invitations this week";
const HTML_PATH = join(REPO_ROOT, "public/email-drafts/monday-morning-blast.html");
const THROTTLE_MS = 500; // 2/sec, Resend default rate limit
const MIN_AUDIENCE = 10; // sanity floor; a smaller result means the query is wrong
const TEST_RECIPIENTS = ["ahollien@azgat.com"];

// Excluded contacts (Denise van den Bossche, Norm Hampton).
const EXCLUDE_IDS = [
  "3710eaeb-bb2d-4813-bfb7-44ee00c1d60e",
  "0a4039e2-9041-4edb-b52b-d9b39c3ad27b",
];
const EXCLUDE_EMAILS = ["denisevdb@exec-elite.com", "normh@exec-elite.com"];

// --- minimal env loader (no dotenv dependency) ---
function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

interface Recipient {
  email: string;
  name: string;
}

interface SendRecord {
  timestamp: string;
  recipient_email: string;
  recipient_name: string;
  resend_message_id: string | null;
  http_status: number | null;
  error_message: string | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function timestampSlug(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function fetchAudience(): Promise<Recipient[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
  if (url.includes("127.0.0.1") || url.includes("localhost")) {
    throw new Error(`Supabase URL points local (${url}). Pull production env first: vercel env pull .env.production.local --environment=production`);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from("contacts")
    .select("first_name, last_name, email")
    .is("deleted_at", null)
    .not("email", "is", null)
    .not("id", "in", `(${EXCLUDE_IDS.join(",")})`)
    .order("last_name", { ascending: true });
  if (error) throw new Error(`Supabase query failed: ${error.message}`);

  const excludeSet = new Set(EXCLUDE_EMAILS.map((e) => e.toLowerCase()));
  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const c of data ?? []) {
    const email = String(c.email ?? "").trim();
    if (!email) continue; // drop empty-string emails
    const lower = email.toLowerCase();
    if (lower.endsWith(".local")) continue; // drop seed/smoke-test records (e.g. *.test.local, *.gat-smoke.local)
    if (excludeSet.has(lower)) continue; // belt-and-suspenders id->email exclusion
    if (seen.has(lower)) continue; // dedupe
    seen.add(lower);
    out.push({ email, name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() });
  }
  return out;
}

async function confirmGate(count: number, phrase: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log(
    `\nAbout to send ${count} emails from ${FROM}.\n` +
      `Subject: ${SUBJECT}\n` +
      `Type ${phrase} to proceed, anything else aborts.`
  );
  const answer = await rl.question("> ");
  rl.close();
  return answer === phrase;
}

async function runSend(recipients: Recipient[], logPath: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  const resend = new Resend(apiKey);
  const html = readFileSync(HTML_PATH, "utf8");

  const start = Date.now();
  let success = 0;
  let failed = 0;
  const total = recipients.length;

  for (let i = 0; i < total; i++) {
    const r = recipients[i];
    process.stdout.write(`[${i + 1}/${total}] sending to ${r.email}... `);
    const rec: SendRecord = {
      timestamp: new Date().toISOString(),
      recipient_email: r.email,
      recipient_name: r.name,
      resend_message_id: null,
      http_status: null,
      error_message: null,
    };
    try {
      const { data, error } = await resend.emails.send({
        from: FROM,
        to: [r.email],
        subject: SUBJECT,
        html,
        replyTo: FROM,
      });
      if (error) throw new Error(`${error.name}: ${error.message}`);
      if (!data?.id) throw new Error("Resend returned no message id");
      rec.resend_message_id = data.id;
      rec.http_status = 200;
      success++;
      console.log(`OK msg_id=${data.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const statusMatch = /statusCode["']?\s*[:=]\s*(\d+)/.exec(msg);
      rec.http_status = statusMatch ? Number(statusMatch[1]) : null;
      rec.error_message = msg;
      failed++;
      console.log(`FAIL ${msg}`);
    }
    appendFileSync(logPath, JSON.stringify(rec) + "\n");
    if (i < total - 1) await sleep(THROTTLE_MS);
  }

  const duration = ((Date.now() - start) / 1000).toFixed(1);
  console.log(
    `\nDONE. Total: ${total}. Success: ${success}. Failed: ${failed}. Duration: ${duration}s. Log: ${logPath}`
  );
}

async function main() {
  loadEnvFile(join(REPO_ROOT, ".env.production.local"));

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const testMode = args.includes("--test");

  if (!existsSync(HTML_PATH)) throw new Error(`HTML not found at ${HTML_PATH}`);

  // Guard: a stray RESEND_SAFE_RECIPIENT would silently redirect/garble the blast.
  const safe = process.env.RESEND_SAFE_RECIPIENT?.trim();
  if (safe && !dryRun) {
    throw new Error(`RESEND_SAFE_RECIPIENT is set (${safe}). Unset it before any real send; this script sends to real recipients directly.`);
  }

  // --test: hardcoded inbox, bypass the contacts query entirely.
  if (testMode) {
    const recipients: Recipient[] = TEST_RECIPIENTS.map((e) => ({ email: e, name: "Test Recipient" }));
    const logDir = join(__dirname, "logs");
    mkdirSync(logDir, { recursive: true });
    const logPath = join(logDir, `monday-blast-TEST-${timestampSlug(new Date())}.jsonl`);
    console.log(`TEST MODE -- sending to ${TEST_RECIPIENTS.join(", ")} via the real send path.`);
    await runSend(recipients, logPath);
    return;
  }

  const recipients = await fetchAudience();
  console.log(`Audience query returned ${recipients.length} recipients (excludes Denise + Norm).`);
  if (recipients.length < MIN_AUDIENCE) {
    throw new Error(`HALT: audience count ${recipients.length} is below the sanity floor (${MIN_AUDIENCE}). Investigate the query before sending.`);
  }

  if (dryRun) {
    console.log("\n--dry-run -- the following would be sent (nothing sent):\n");
    recipients.forEach((r, i) => console.log(`  [${i + 1}] ${r.name || "(no name)"} <${r.email}>`));
    console.log(`\nDRY RUN. ${recipients.length} recipients. From: ${FROM}. Subject: ${SUBJECT}. Sent: 0.`);
    return;
  }

  const ok = await confirmGate(recipients.length, "SEND TO ALL");
  if (!ok) {
    console.log("Aborted -- confirmation phrase not matched. Nothing sent.");
    return;
  }
  const logDir = join(__dirname, "logs");
  mkdirSync(logDir, { recursive: true });
  const logPath = join(logDir, `monday-blast-${timestampSlug(new Date())}.jsonl`);
  await runSend(recipients, logPath);
}

main().catch((e) => {
  console.error(`\nERROR: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
