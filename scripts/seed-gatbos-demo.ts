// scripts/seed-gatbos-demo.ts -- LOCAL DEV ONLY demo seed for the /new/*
// redesign screens. Inserts tasks/projects/captures/events/materials wired to
// existing local contacts so every redesign component renders.
// Run: node --env-file=.env.local -r tsx/cjs scripts/seed-gatbos-demo.ts
//   or: pnpm exec tsx --env-file=.env.local scripts/seed-gatbos-demo.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!/127\.0\.0\.1|localhost/.test(url)) {
  console.error("Refusing to seed: not a local Supabase URL:", url);
  process.exit(1);
}
const svc = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const user_id = process.env.OWNER_USER_ID!;

const day = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
};

(async () => {
  const { data: accts } = await svc.from("accounts").select("id").limit(1);
  const account_id = accts![0].id as string;
  const { data: contacts } = await svc
    .from("contacts")
    .select("id, first_name, last_name")
    .eq("user_id", user_id)
    .is("deleted_at", null)
    .limit(6);
  const c = contacts ?? [];
  if (c.length < 3) {
    console.error("Not enough contacts to wire demo data");
    process.exit(1);
  }
  const log = (label: string) => (res: { error: { message: string } | null }) =>
    console.log(label, res.error ? "ERR: " + res.error.message : "ok");

  // freshen a few contacts so warmth buckets spread (hot/warm/needs)
  await svc.from("interactions_legacy").insert([
    { user_id, contact_id: c[0].id, type: "call", summary: "Demo: campaign check-in call", occurred_at: day(-1) },
    { user_id, contact_id: c[1].id, type: "meeting", summary: "Demo: escrow kickoff coffee", occurred_at: day(-2) },
    { user_id, contact_id: c[2].id, type: "email", summary: "Demo: brochure proof sent", occurred_at: day(-9) },
  ]).then(log("interactions"));
  await svc.from("contacts").update({ health_score: 85, tier: "A", next_action: "Drop off the postcard proof for approval" }).eq("id", c[0].id).then(log("contact0"));
  await svc.from("contacts").update({ health_score: 80, tier: "A", next_action: "Send welcome packet + confirm earnest money timeline" }).eq("id", c[1].id).then(log("contact1"));

  const { data: projects } = await svc
    .from("projects")
    .insert([
      { user_id, title: "Q3 Farm Postcard Campaign", type: "campaign", status: "active", owner_contact_id: c[0].id, metadata: {} },
      { user_id, title: "Just Listed Mailer -- 88 Linden", type: "listing", status: "active", owner_contact_id: c[1].id, metadata: {} },
      { user_id, title: "Summer Agent Mixer", type: "happy_hour", status: "active", owner_contact_id: null, metadata: {} },
    ])
    .select("id, title");
  console.log("projects", projects?.length ?? "ERR");
  const pr = projects ?? [];

  await svc.from("tasks").insert([
    { account_id, user_id, title: "Drop off 250-piece postcard proof for approval", status: "open", priority: "high", type: "todo", due_date: day(0), due_reason: "Promised proof by end of week; mail date depends on it", action_hint: "Print proof, schedule drop-off", contact_id: c[0].id, project_id: pr[0]?.id },
    { account_id, user_id, title: "Send welcome packet + earnest money timeline", status: "open", priority: "high", type: "todo", due_date: day(0), due_reason: "First escrow together; set the tone", action_hint: "Pull packet, confirm dates", contact_id: c[1].id, project_id: pr[1]?.id },
    { account_id, user_id, title: "Call to reintroduce the new escrow officer", status: "open", priority: "high", type: "todo", due_date: day(-1), due_reason: "High-value partner at risk for 3 months", action_hint: "Block 15 min, no pitch", contact_id: c[2].id },
    { account_id, user_id, title: "Send brochure design proof v2", status: "open", priority: "medium", type: "todo", due_date: day(2), due_reason: "v1 had photo crop notes", action_hint: "Apply crop notes, export PDF", contact_id: c[2].id, project_id: pr[1]?.id },
    { account_id, user_id, title: "Follow up on mailer list count", status: "snoozed", priority: "medium", type: "todo", due_date: day(-2), snoozed_until: day(1), due_reason: "Cannot lock print run without it", action_hint: "Text reminder", contact_id: c[0].id, project_id: pr[0]?.id },
    { account_id, user_id, title: "Confirm venue + catering for Summer Mixer", status: "snoozed", priority: "medium", type: "todo", due_date: day(5), snoozed_until: day(3), due_reason: "Locks the date for invites", action_hint: "Email venue with est. 40 guests", project_id: pr[2]?.id },
    { account_id, user_id, title: "Order event flyers for Summer Mixer", status: "open", priority: "low", type: "todo", due_date: day(7), due_reason: "Need printed before invite push", action_hint: "Approve flyer art, send to print", project_id: pr[2]?.id },
    { account_id, user_id, title: "Draft co-branded buyer guide outline", status: "open", priority: "low", type: "todo", due_date: day(21), due_reason: "Partner splits cost; easy win", action_hint: "Rough 6-page outline", contact_id: c[3]?.id },
    { account_id, user_id, title: "Approve final postcard art with print vendor", status: "done", priority: "high", type: "todo", due_date: day(-1), completed_at: day(0), contact_id: c[0].id, project_id: pr[0]?.id },
  ]).then(log("tasks"));

  await svc.from("captures").insert([
    { account_id, user_id, raw_text: "Client wants a just-sold mailer next; new project?", parsed_payload: {}, source: "manual", status: "pending", processed: false },
    { account_id, user_id, raw_text: "Idea: quarterly market-minute video clip agents can repost", parsed_payload: {}, source: "manual", status: "pending", processed: false },
    { account_id, user_id, raw_text: "Ask escrow about the Linden Ct closing timeline", parsed_payload: {}, source: "manual", status: "pending", processed: false },
  ]).then(log("captures"));

  await svc.from("events").insert([
    { account_id, user_id, title: "Coffee: escrow kickoff", start_at: day(0).replace(/T.*/, "T17:30:00Z"), end_at: day(0).replace(/T.*/, "T18:30:00Z"), location: "Cafe Lola", contact_id: c[1].id, attendees: [], source: "dashboard_create", occurrence_status: "scheduled" },
    { account_id, user_id, title: "Office marketing sync", start_at: day(0).replace(/T.*/, "T21:00:00Z"), end_at: day(0).replace(/T.*/, "T22:00:00Z"), location: "Conference Rm B", attendees: [], source: "dashboard_create", occurrence_status: "scheduled" },
    { account_id, user_id, title: "Oak Hill farm strategy call", start_at: day(2).replace(/T.*/, "T18:00:00Z"), end_at: day(2).replace(/T.*/, "T18:30:00Z"), location: "Phone", contact_id: c[3]?.id, attendees: [], source: "dashboard_create", occurrence_status: "scheduled" },
  ]).then(log("events"));

  await svc.from("material_requests").insert([
    { user_id, title: "Q3 Farm Postcard (250 pc)", request_type: "print_ready", status: "in_production", priority: "rush", source: "dashboard", contact_id: c[0].id, submitted_at: day(-3) },
    { user_id, title: "88 Linden Just Listed Mailer", request_type: "design_help", status: "in_production", priority: "standard", source: "dashboard", contact_id: c[1].id, submitted_at: day(-2) },
    { user_id, title: "Listing Brochure: 123 Maple", request_type: "design_help", status: "submitted", priority: "standard", source: "dashboard", contact_id: c[2].id, submitted_at: day(-1) },
    { user_id, title: "Summer Mixer Event Flyer", request_type: "print_ready", status: "complete", priority: "standard", source: "dashboard", submitted_at: day(-8), completed_at: day(-1) },
    { user_id, title: "Co-branded Buyer Guide", request_type: "template_request", status: "draft", priority: "standard", source: "dashboard", contact_id: c[3]?.id },
  ]).then(log("material_requests"));

  await svc.from("design_assets").insert([
    { user_id, contact_id: c[0].id, name: "Spring Just-Sold Social Set", asset_type: "social", url: "https://example.com/demo-social.png" },
    { user_id, contact_id: c[2].id, name: "Open House Flyer: 123 Maple", asset_type: "flyer", url: "https://example.com/demo-flyer.pdf" },
  ]).then(log("design_assets"));

  const { data: camps } = await svc.from("campaigns").select("id, step_count").limit(2);
  for (const [i, cp] of (camps ?? []).entries()) {
    await svc.from("campaign_enrollments").insert({
      account_id, user_id, campaign_id: cp.id, contact_id: c[i].id,
      current_step: Math.min(2 + i, cp.step_count || 2), status: "active",
      next_action_at: day(3 + i),
    }).then(log("enrollment" + i));
  }

  console.log("seed complete");
})();
