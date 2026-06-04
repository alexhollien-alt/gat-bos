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
(async () => {
  const { data: agent } = await db.from("contacts").select("id").eq("account_id", "d2c8793f-f0b8-4b24-a47d-7b2387f8e7f0").eq("type", "realtor").limit(1).maybeSingle();
  const { data, error } = await db.from("open_house_blasts").insert({
    account_id: "d2c8793f-f0b8-4b24-a47d-7b2387f8e7f0", user_id: "b735d691-4d86-4e31-9fd3-c2257822dca3",
    agent_contact_id: agent!.id, slug: "capcheck-probe", address: "x", city: "__capcheck__", open_house_date: "2026-06-14", status: "draft",
  }).select("id, daily_send_cap").single();
  if (error) { console.log("err", error.message); return; }
  console.log("NEW BLAST daily_send_cap =", data.daily_send_cap);
  await db.from("open_house_blasts").update({ deleted_at: new Date().toISOString() }).eq("id", data.id);
})();
