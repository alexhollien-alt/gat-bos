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
  const { data } = await db
    .from("blast_sends")
    .select("recipient_email, status, provider_message_id, error_message")
    .eq("blast_id", "f9b7aeb5-2ecb-4888-bca4-f034bbd1b660");
  for (const r of data ?? []) {
    console.log(`${r.recipient_email} :: ${r.status} :: msg=${r.provider_message_id ?? "-"} :: ${r.error_message ?? "(none)"}`);
  }
})();
