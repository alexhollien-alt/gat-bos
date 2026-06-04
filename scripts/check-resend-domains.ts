// scripts/check-resend-domains.ts -- READ ONLY. Lists Resend domains + their
// verification status to determine whether a WALL-compliant sending path
// exists (a verified subdomain that is NOT the root or CRM domain).
// Run: pnpm exec tsx scripts/check-resend-domains.ts
import { readFileSync, existsSync } from "node:fs";
import { Resend } from "resend";

function loadKey(): string | null {
  for (const f of [".env.production.local", ".env.local"]) {
    if (!existsSync(f)) continue;
    const m = readFileSync(f, "utf8").match(/^RESEND_API_KEY=(.+)$/m);
    const k = m?.[1]?.replace(/^["']|["']$/g, "").trim();
    if (k && k.length > 8) return k;
  }
  return null;
}

(async () => {
  const key = loadKey();
  if (!key) {
    console.log("RESULT: NO_KEY (no RESEND_API_KEY in env files)");
    return;
  }
  console.log("KEY: present (prefix " + key.slice(0, 6) + "...)");
  try {
    const resend = new Resend(key);
    const res = await resend.domains.list();
    if (res.error) {
      console.log("DOMAINS_LIST_ERROR:", JSON.stringify(res.error));
      console.log("(A send-only restricted key cannot list domains -- expected per memory.)");
      return;
    }
    const data = res.data?.data ?? res.data ?? [];
    console.log("DOMAINS:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.log("EXCEPTION:", e instanceof Error ? e.message : String(e));
  }
})();
