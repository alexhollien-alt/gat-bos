/**
 * Berneil broker-open blast sender.
 *
 * Run:  pnpm tsx scripts/send-berneil-blast.ts [--dry-run | --test]
 *
 * Modes:
 *   --dry-run  Print the recipient list + count and exit. Sends nothing.
 *   --test     Send ONLY to the two test inboxes (bypasses the contacts query).
 *              This is the exact send path the real blast uses.
 *   --recipients-from-csv <path>
 *              Send only to the emails in <path> (a CSV with a recipient_email
 *              column). Bypasses the BerneilBlast tag query. Gate phrase is
 *              "SEND TO UNDELIVERED" (distinct from the full-blast phrase).
 *   (none)     Real blast. Queries the 184 BerneilBlast contacts, shows a
 *              confirmation gate, and only proceeds on literal "SEND TO ALL".
 *
 * Reads production credentials from .env.production.local at repo root
 * (pull first with: vercel env pull .env.production.local --environment=production).
 *
 * TODO (future enhancement, deferred 2026-05-24): pre-flight quota check at the
 * start of every real send -- query Resend usage and HALT if
 * audience_size + today_sent > remaining_quota. Deferred because the Pro tier
 * (50k/mo, no daily cap) makes it low-urgency. Note: Resend's API sits behind
 * Cloudflare, which 403s the default Node/urllib User-Agent -- set a browser
 * User-Agent on any direct fetch.
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
const SUBJECT = "Broker Open at 4901 East Berneil Drive";
const HTML_PATH = join(REPO_ROOT, "public/email-drafts/berneil-broker-open.html");
const EXPECTED_COUNT = 184;
const THROTTLE_MS = 500; // 2/sec, Resend default rate limit
const TEST_RECIPIENTS = ["ahollien@azgat.com", "yourcoll2347@gmail.com"];

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
  brokerage: string | null;
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

// Minimal CSV parser: handles double-quoted fields with embedded commas/quotes.
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

function loadCsvRecipients(path: string): Recipient[] {
  if (!existsSync(path)) throw new Error(`CSV not found at ${path}`);
  const records = parseCsv(readFileSync(path, "utf8"));
  const out: Recipient[] = [];
  for (const rec of records) {
    const email = (rec.recipient_email || "").trim();
    if (!email) continue;
    out.push({
      email,
      name: (rec.recipient_name || "").trim(),
      brokerage: (rec.brokerage || "").trim() || null,
    });
  }
  if (out.length === 0) throw new Error(`No recipient_email values found in ${path}`);
  return out;
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
    .select("first_name, last_name, email, brokerage")
    .contains("tags", ["BerneilBlast"])
    .not("email", "is", null);
  if (error) throw new Error(`Supabase query failed: ${error.message}`);
  return (data ?? []).map((c) => ({
    email: c.email as string,
    name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
    brokerage: (c.brokerage as string) ?? null,
  }));
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
  const csvIdx = args.indexOf("--recipients-from-csv");
  const csvPath = csvIdx !== -1 ? args[csvIdx + 1] : null;
  if (csvIdx !== -1 && !csvPath) throw new Error("--recipients-from-csv requires a path argument");

  if (!existsSync(HTML_PATH)) throw new Error(`HTML not found at ${HTML_PATH}`);

  // Guard: a stray RESEND_SAFE_RECIPIENT would silently redirect/garble the blast.
  const safe = process.env.RESEND_SAFE_RECIPIENT?.trim();
  if (safe && !dryRun) {
    throw new Error(`RESEND_SAFE_RECIPIENT is set (${safe}). Unset it before any real send; this script sends to real recipients directly.`);
  }

  // --test: hardcoded inboxes, bypass the contacts query entirely.
  if (testMode) {
    const recipients: Recipient[] = TEST_RECIPIENTS.map((e) => ({ email: e, name: "Test Recipient", brokerage: null }));
    const logDir = join(__dirname, "logs");
    mkdirSync(logDir, { recursive: true });
    const logPath = join(logDir, `berneil-blast-TEST-${timestampSlug(new Date())}.jsonl`);
    console.log(`TEST MODE -- sending to ${TEST_RECIPIENTS.join(", ")} via the real send path.`);
    await runSend(recipients, logPath);
    return;
  }

  // Recipient source: CSV (resend to a specific list) or the BerneilBlast tag query (full blast).
  let recipients: Recipient[];
  let gatePhrase: string;
  if (csvPath) {
    recipients = loadCsvRecipients(csvPath);
    gatePhrase = "SEND TO UNDELIVERED";
    console.log(`Loaded ${recipients.length} recipients from CSV: ${csvPath}`);
  } else {
    recipients = await fetchAudience();
    gatePhrase = "SEND TO ALL";
    console.log(`Audience query returned ${recipients.length} recipients (expected ${EXPECTED_COUNT}).`);
    if (recipients.length !== EXPECTED_COUNT) {
      throw new Error(`HALT: audience count ${recipients.length} != expected ${EXPECTED_COUNT}. Investigate before sending.`);
    }
  }

  if (dryRun) {
    console.log("\n--dry-run -- the following would be sent (nothing sent):\n");
    recipients.forEach((r, i) => console.log(`  [${i + 1}] ${r.name} <${r.email}> -- ${r.brokerage ?? "(no brokerage)"}`));
    console.log(`\nDRY RUN. ${recipients.length} recipients. From: ${FROM}. Subject: ${SUBJECT}. Sent: 0.`);
    return;
  }

  const ok = await confirmGate(recipients.length, gatePhrase);
  if (!ok) {
    console.log("Aborted -- confirmation phrase not matched. Nothing sent.");
    return;
  }
  const logDir = join(__dirname, "logs");
  mkdirSync(logDir, { recursive: true });
  const logPath = join(logDir, `berneil-blast-${timestampSlug(new Date())}.jsonl`);
  await runSend(recipients, logPath);
}

main().catch((e) => {
  console.error(`\nERROR: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
