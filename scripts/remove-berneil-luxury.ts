// Soft-delete the one-off Berneil broker-open luxury blast list from prod contacts.
// Rule 3: soft delete only (set deleted_at), never hard delete.
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
const SOURCE = "berneil-broker-open-2026-05-29-import";
(async () => {
  const { count: before } = await db.from("contacts").select("id", { count: "exact", head: true })
    .eq("source", SOURCE).is("deleted_at", null);
  console.log("Berneil luxury contacts (active):", before);
  const { error } = await db.from("contacts").update({ deleted_at: new Date().toISOString() })
    .eq("source", SOURCE).is("deleted_at", null);
  if (error) { console.log("err", error.message); return; }
  const { count: after } = await db.from("contacts").select("id", { count: "exact", head: true })
    .eq("source", SOURCE).is("deleted_at", null);
  const { count: total } = await db.from("contacts").select("id", { count: "exact", head: true })
    .in("type", ["realtor", "agent"]).is("deleted_at", null);
  console.log("soft-deleted; remaining active Berneil:", after, "| total active realtors now:", total);
})();
