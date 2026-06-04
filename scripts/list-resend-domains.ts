import { readFileSync } from "node:fs";
import { Resend } from "resend";
const env = readFileSync("/tmp/oh-vercel-env.txt", "utf8");
const key = env.match(/^RESEND_READ_API_KEY=(.+)$/m)?.[1]?.replace(/^["']|["']$/g, "").trim();
if (!key) { console.log("NO_READ_KEY"); process.exit(0); }
console.log("read key prefix:", key.slice(0, 8));
(async () => {
  const r = await new Resend(key).domains.list();
  if (r.error) { console.log("ERR:", JSON.stringify(r.error)); return; }
  const data = (r.data as { data?: unknown[] })?.data ?? r.data ?? [];
  for (const d of data as Array<{ name: string; status: string; region?: string }>) {
    console.log(`DOMAIN: ${d.name} :: ${d.status} :: ${d.region ?? ""}`);
  }
})();
