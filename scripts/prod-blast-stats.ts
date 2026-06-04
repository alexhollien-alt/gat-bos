import { readFileSync, existsSync } from "node:fs";
for (const f of [".env.production.local"]) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
(async () => {
  const { getBlastStats } = await import("../src/lib/open-house/queries");
  const s = await getBlastStats("f9b7aeb5-2ecb-4888-bca4-f034bbd1b660");
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  console.log("DASHBOARD (prod blast f9b7aeb5):");
  console.log(`  Recipients/total: ${s.total}  (queued ${s.queued}, failed ${s.failed})`);
  console.log(`  Delivered: ${s.delivered} (${pct(s.deliveredRate)} of dispatched ${s.dispatched})`);
  console.log(`  Opens: ${s.opened} (${pct(s.openRate)} of delivered)`);
  console.log(`  Clicks: ${s.clicked} (${pct(s.clickRate)} of delivered)`);
  console.log(`  Bounce rate: ${pct(s.bounceRate)}  Complaint rate: ${pct(s.complaintRate)}`);
})();
