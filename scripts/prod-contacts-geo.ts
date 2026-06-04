// Read-only: what geographic data exists on prod contacts (to plan city backfill).
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

async function count(label: string, build: (q: any) => any) {
  const { count } = await build(db.from("contacts").select("id", { count: "exact", head: true }).is("deleted_at", null));
  console.log(`${label}: ${count}`);
}

(async () => {
  await count("total active contacts", (q) => q);
  await count("  type realtor/agent", (q) => q.in("type", ["realtor", "agent"]));
  await count("  mailable (active+email)", (q) => q.in("type", ["realtor", "agent"]).eq("email_status", "active").not("email", "is", null));
  await count("  city set", (q) => q.not("city", "is", null));
  await count("  farm_area set", (q) => q.not("farm_area", "is", null));
  await count("  farm_zips set", (q) => q.not("farm_zips", "is", null));
  await count("  brokerage set", (q) => q.not("brokerage", "is", null));
  await count("  BerneilBlast tag", (q) => q.contains("tags", ["BerneilBlast"]));

  const { data: fa } = await db.from("contacts").select("farm_area").is("deleted_at", null).not("farm_area", "is", null).limit(60);
  console.log("sample farm_area values:", JSON.stringify(Array.from(new Set((fa ?? []).map((r: any) => r.farm_area))).slice(0, 30)));

  const { data: bk } = await db.from("contacts").select("brokerage").is("deleted_at", null).in("type", ["realtor", "agent"]).not("brokerage", "is", null).limit(500);
  const counts: Record<string, number> = {};
  for (const r of bk ?? []) counts[(r as any).brokerage] = (counts[(r as any).brokerage] ?? 0) + 1;
  console.log("top brokerages:", JSON.stringify(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12)));
})();
