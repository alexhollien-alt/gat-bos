import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
const env = Object.fromEntries(readFileSync(resolve(homedir(),"crm",".env.local"),"utf8").split("\n").filter(l=>l&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,"")]}));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: email } = await admin.from("emails").insert({
  gmail_id: `phase-1.3.2-a-bd-extra-${Date.now()}`,
  from_email: "prospect.agent@example-valley.test",
  from_name: "Casey Prospect (GATE FIXTURE)",
  subject: "New agent seeking referral partner",
  body_plain: "Hi Alex, I'm a new agent in the Phoenix valley looking for a referral partner to pair with on my first transactions. Heard great things about you and would love to explore a partnership opportunity.",
  snippet: "new agent referral partner partnership opportunity",
  is_unread: true, is_contact_match: false, created_at: new Date().toISOString(),
}).select("id").single();
console.log("email_id", email.id);
const r = await fetch("http://localhost:3000/api/email/generate-draft", {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${env.CRON_SECRET}` },
  body: JSON.stringify({ email_id: email.id }),
});
const j = await r.json();
console.log("draft", j.draft_id, "flag", j.escalation_flag);
const state = JSON.parse(readFileSync(resolve(homedir(),"crm","scripts",".phase-1.3.2-a-state.json"),"utf8"));
state.drafts.followup_extra = { email_id: email.id, draft_id: j.draft_id, expected_flag: j.escalation_flag };
writeFileSync(resolve(homedir(),"crm","scripts",".phase-1.3.2-a-state.json"), JSON.stringify(state, null, 2));
