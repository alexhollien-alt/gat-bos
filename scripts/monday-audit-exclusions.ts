/**
 * Monday blast exclusion audit (read-only).
 * Lists every contact NOT receiving the blast, grouped by reason.
 * Run: pnpm tsx scripts/monday-audit-exclusions.ts
 * Reads .env.production.local (vercel env pull first).
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

const EXCLUDE_IDS = new Set([
  "3710eaeb-bb2d-4813-bfb7-44ee00c1d60e", // Denise van den Bossche
  "0a4039e2-9041-4edb-b52b-d9b39c3ad27b", // Norm Hampton
]);
const EXCLUDE_EMAILS = new Set(["denisevdb@exec-elite.com", "normh@exec-elite.com"]);

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function label(c: { first_name: string | null; last_name: string | null; email: string | null }) {
  const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "(no name)";
  return `${name} <${c.email ?? "(no email)"}>`;
}

async function main() {
  loadEnvFile(join(REPO_ROOT, ".env.production.local"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  if (url.includes("127.0.0.1") || url.includes("localhost")) throw new Error(`URL points local: ${url}`);
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Pull EVERY contact, including soft-deleted, to categorize exclusions.
  const { data, error } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email, deleted_at")
    .order("last_name", { ascending: true });
  if (error) throw new Error(error.message);
  const all = data ?? [];

  const idExcluded: typeof all = [];
  const softDeleted: typeof all = [];
  const noEmail: typeof all = [];
  const testDomain: typeof all = [];
  const emailExcluded: typeof all = [];
  const deduped: { row: (typeof all)[number]; keptFor: string }[] = [];

  const seen = new Map<string, (typeof all)[number]>(); // lowercased email -> first kept row
  let included = 0;

  for (const c of all) {
    if (EXCLUDE_IDS.has(c.id)) { idExcluded.push(c); continue; }
    if (c.deleted_at) { softDeleted.push(c); continue; }
    const email = String(c.email ?? "").trim();
    if (!email) { noEmail.push(c); continue; }
    const lower = email.toLowerCase();
    if (lower.endsWith(".local")) { testDomain.push(c); continue; }
    if (EXCLUDE_EMAILS.has(lower)) { emailExcluded.push(c); continue; }
    if (seen.has(lower)) { deduped.push({ row: c, keptFor: label(seen.get(lower)!) }); continue; }
    seen.set(lower, c);
    included++;
  }

  const section = (title: string, rows: typeof all) => {
    console.log(`\n## ${title} (${rows.length})`);
    rows.forEach((c) => console.log(`  - ${label(c)}`));
  };

  console.log(`\n=== MONDAY BLAST EXCLUSION AUDIT ===`);
  console.log(`Total contact rows: ${all.length}`);
  console.log(`WILL RECEIVE: ${included}`);
  const totalExcluded = idExcluded.length + softDeleted.length + noEmail.length + testDomain.length + emailExcluded.length + deduped.length;
  console.log(`EXCLUDED total: ${totalExcluded}`);

  section("Opt-out, excluded by ID", idExcluded);
  section("Opt-out, excluded by email match", emailExcluded);
  section("Soft-deleted (deleted_at set)", softDeleted);
  section("No email on record", noEmail);
  section("Test/seed domain (.local)", testDomain);
  console.log(`\n## Duplicate email, deduped (${deduped.length})`);
  deduped.forEach((d) => console.log(`  - ${label(d.row)}  [dupe of ${d.keptFor}]`));
}

main().catch((e) => { console.error(`ERROR: ${e instanceof Error ? e.message : String(e)}`); process.exit(1); });
