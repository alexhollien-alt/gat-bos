// 2026-05-04 -- Render the event-invite template against the live row in
// public.templates and write the HTML preview to /tmp so Alex can eyeball
// before any real send. Pulls subject + body_html via direct PostgREST.

import { createClient } from "@supabase/supabase-js";
import { writeFile } from "node:fs/promises";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const { data: tpl, error } = await admin
  .from("templates")
  .select("subject, body_html, body_text, version")
  .eq("slug", "event-invite")
  .is("deleted_at", null)
  .order("version", { ascending: false })
  .limit(1)
  .single();
if (error) throw error;

const variables = {
  test_prefix: "[TEST] ",
  first_name: "Alex",
  event_name: "Content Creation Day",
  event_date: "Thursday, May 7",
  event_time: "11 AM to 12 PM",
  event_address: "8220 E Appaloosa Trl, Scottsdale, AZ 85258",
  slots_remaining: "21",
  slots_total: "25",
  hero_image_url:
    "https://rndnxhvibbqqjrzapdxs.supabase.co/storage/v1/object/public/event-assets/content-creation-day-2026-05-07.png",
  rsvp_instruction: "Reply or text 480.204.2983 to lock your slot.",
};

const TOKEN_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
function render(template) {
  const unresolved = [];
  const out = template.replace(TOKEN_RE, (m, key) => {
    if (Object.prototype.hasOwnProperty.call(variables, key)) return variables[key];
    unresolved.push(key);
    return m;
  });
  return { out, unresolved };
}

const subj = render(tpl.subject);
const html = render(tpl.body_html);
const text = render(tpl.body_text);

await writeFile("/tmp/event-invite-preview.html", html.out);
await writeFile("/tmp/event-invite-preview.txt", text.out);

console.log(`Subject: ${subj.out}`);
console.log(`Template version: ${tpl.version}`);
console.log(`HTML preview: /tmp/event-invite-preview.html`);
console.log(`Text preview: /tmp/event-invite-preview.txt`);
const allUnresolved = [...new Set([...subj.unresolved, ...html.unresolved, ...text.unresolved])];
if (allUnresolved.length) console.log(`Unresolved variables: ${allUnresolved.join(", ")}`);
