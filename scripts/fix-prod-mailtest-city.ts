// One-off: give the 3 controlled test contacts + the blast a clean display city.
// Safe: every other prod contact has NULL city, so only these 3 match.
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
for (const f of [".env.production.local"]) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const emails = ["test-ur6lcenob@srv1.mail-tester.com", "yourcoll2347@gmail.com", "ahollien@azgat.com"];
(async () => {
  for (const e of emails) {
    await db.from("contacts").update({ city: "Scottsdale" }).ilike("email", e);
  }
  await db.from("open_house_blasts").update({ city: "Scottsdale" }).eq("slug", "mailtest-live-probe");
  const { count } = await db
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("type", "realtor").eq("city", "Scottsdale").eq("email_status", "active").is("deleted_at", null);
  console.log("Scottsdale active realtors (should be 3):", count);
})();
