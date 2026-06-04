// scripts/seed-prod-mailtest.ts -- seed a __mailtest__ blast + controlled
// recipients into PROD Supabase for the live deliverability test.
// Run: pnpm exec tsx scripts/seed-prod-mailtest.ts <mailtester_address>
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const f of [".env.production.local"]) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const mailtester = process.argv[2];
if (!mailtester) {
  console.error("Usage: pnpm exec tsx scripts/seed-prod-mailtest.ts <mailtester_addr>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
console.log("PROD Supabase:", url);
const db = createClient(url, key);

const ACCOUNT = "d2c8793f-f0b8-4b24-a47d-7b2387f8e7f0";
const USER = "b735d691-4d86-4e31-9fd3-c2257822dca3";

(async () => {
  // Confirm the account is owned by USER on prod.
  const { data: acct } = await db.from("accounts").select("id, owner_user_id").eq("id", ACCOUNT).maybeSingle();
  console.log("account owner matches:", acct?.owner_user_id === USER, acct?.owner_user_id);

  // Pick an existing realtor in this account as the hosting agent.
  const { data: agent } = await db
    .from("contacts")
    .select("id, full_name")
    .eq("account_id", ACCOUNT)
    .eq("type", "realtor")
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (!agent) {
    console.error("No realtor contact found in account; cannot set hosting agent.");
    process.exit(1);
  }
  console.log("agent:", agent.full_name, agent.id);

  // Seed controlled recipients in city __mailtest__.
  const recips = [
    { first_name: "Mailtester", last_name: "Probe", email: mailtester },
    { first_name: "Alex", last_name: "Gmail Seed", email: "yourcoll2347@gmail.com" },
    { first_name: "Alex", last_name: "AZGAT Seed", email: "ahollien@azgat.com" },
  ];
  for (const r of recips) {
    const { data: exists } = await db
      .from("contacts")
      .select("id")
      .ilike("email", r.email)
      .is("deleted_at", null)
      .maybeSingle();
    if (exists) {
      await db.from("contacts").update({ city: "__mailtest__", email_status: "active", type: "realtor" }).eq("id", exists.id);
      console.log("updated existing contact ->", r.email);
    } else {
      await db.from("contacts").insert({
        first_name: r.first_name, last_name: r.last_name, email: r.email, type: "realtor",
        city: "__mailtest__", email_status: "active", tags: ["open-house-pool", "seed"],
        source: "open-house-live-test", user_id: USER, account_id: ACCOUNT,
      });
      console.log("inserted contact ->", r.email);
    }
  }

  // Create (or reuse) the __mailtest__ blast.
  const slug = "mailtest-live-probe";
  const { data: existingBlast } = await db.from("open_house_blasts").select("id").eq("slug", slug).maybeSingle();
  let blastId = existingBlast?.id as string | undefined;
  if (!blastId) {
    const { data: blast, error } = await db.from("open_house_blasts").insert({
      account_id: ACCOUNT, user_id: USER, agent_contact_id: agent.id, slug,
      address: "7012 E Berneil Lane", city: "__mailtest__", state: "AZ", price: "$2,395,000",
      open_house_date: "2026-06-14", open_house_start: "13:00", open_house_end: "16:00",
      details: "Single-level Paradise Valley contemporary with a resort backyard and chef's kitchen. Broker lunch provided, easy to show.",
      beds: 4, baths: 4.5, sqft: 4180,
      photos: ["https://gat-bos.vercel.app/email-assets/berneil/hero-photo.jpg"],
      hero_image_url: "https://gat-bos.vercel.app/email-assets/berneil/hero-photo.jpg",
      status: "preview", recipient_count: 3, email_subject: "Sunday open house in Scottsdale",
    }).select("id").single();
    if (error) { console.error("blast insert error:", error.message); process.exit(1); }
    blastId = blast.id;
    console.log("created blast:", blastId);
  } else {
    console.log("reusing blast:", blastId);
  }

  const { count } = await db
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("account_id", ACCOUNT).eq("type", "realtor").eq("city", "__mailtest__").eq("email_status", "active").is("deleted_at", null);
  console.log("MAILTEST_RECIPIENTS:", count);
  console.log("BLAST_ID:", blastId);
})();
