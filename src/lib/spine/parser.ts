// src/lib/spine/parser.ts
// Background parser. Reads unparsed spine_inbox rows and turns them
// into structured commitments, signals, and focus_queue rows using
// Claude API. Writes back parsed_* arrays and marks parsed=true.

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// Output schema we ask Claude to produce.
const ParserOutput = z.object({
  contacts_mentioned: z.array(z.object({
    guess_first_name: z.string().optional(),
    guess_last_name: z.string().optional(),
    guess_brokerage: z.string().optional(),
    matched_contact_id: z.string().uuid().nullable(),
    confidence: z.enum(["high","medium","low"]),
  })),
  commitments: z.array(z.object({
    title: z.string(),
    kind: z.enum(["flyer","email","intro","data","call","meeting","gift","other"]).nullable(),
    due_at_relative: z.string().nullable(), // "by Friday", "end of week"
    target_contact_id: z.string().uuid().nullable(),
    description: z.string().nullable(),
  })),
  signals: z.array(z.object({
    kind: z.enum(["stale","closing_soon","birthday","listing_dom","market_shift","custom"]),
    severity: z.enum(["low","normal","high","urgent"]),
    title: z.string(),
    detail: z.string().nullable(),
    target_contact_id: z.string().uuid().nullable(),
  })),
  focus_adds: z.array(z.object({
    contact_id: z.string().uuid(),
    reason_detail: z.string(),
  })),
  warnings: z.array(z.string()),
});

export type ParseResult =
  | { ok: true; data: { id: string; parsed: boolean; parsed_commitment_ids: string[]; parsed_signal_ids: string[]; parsed_focus_ids: string[] } }
  | { ok: false; error: string };

const SYSTEM_PROMPT = `You are the Spine parser for a real estate title sales executive's CRM. You turn raw text captures into structured database writes.

Given a raw_text capture and a contacts index, extract:
1. Contacts mentioned (match to contacts index where possible)
2. Commitments made ("I'll send her the flyer by Friday" -> commitment with kind=flyer)
3. Signals observed ("she's closing Friday" -> closing_soon signal)
4. Focus intent ("make sure I call Kevin this week" -> focus_queue add)

Rules:
- Return JSON matching the provided schema exactly.
- Use "matched_contact_id": null if you cannot confidently match a named person.
- For "due_at_relative", return human phrases like "by Friday", "end of week" -- do NOT compute dates.
- For commitment kind: flyer, email, intro, data, call, meeting, gift, other.
- Severity defaults to "normal" unless the text explicitly suggests urgency.
- Return empty arrays for categories with nothing to extract.
- If lender separation rules are violated (Christine McConnell mentioned without Julie Jarmiolowski + Optima context), add a warning string.
- Return only the JSON object. No prose, no markdown fences.`;

/**
 * Parses a single spine_inbox entry. Uses service-role Supabase client.
 * Call with the inbox row id. Reads the row, runs Claude, writes results.
 */
export async function parseInboxEntry(inboxId: string): Promise<ParseResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!url || !serviceKey || !apiKey) {
    return { ok: false, error: "Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or ANTHROPIC_API_KEY" };
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const anthropic = new Anthropic({ apiKey });

  // Fetch the inbox row.
  const { data: row, error: fetchErr } = await supabase
    .from("spine_inbox")
    .select("*")
    .eq("id", inboxId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!row) return { ok: false, error: "inbox row not found" };
  if (row.parsed) return { ok: false, error: "already parsed" };

  // Build contacts index for the user. Inlined (vs helper function) to avoid
  // SupabaseClient generic-type friction across function boundaries.
  const { data: contactRows } = await supabase
    .from("contacts")
    .select("id,first_name,last_name,brokerage,email,phone,tier")
    .eq("user_id", row.user_id)
    .is("deleted_at", null)
    .order("first_name")
    .limit(500);
  const contactsIndex = (contactRows ?? []).map((c: Record<string, unknown>) => ({
    id: c.id,
    name: `${c.first_name} ${c.last_name}`,
    brokerage: c.brokerage,
    tier: c.tier,
  }));

  // Call Claude.
  const userMessage = `CONTACTS INDEX (up to 500):\n${JSON.stringify(contactsIndex)}\n\nRAW TEXT TO PARSE:\n${row.raw_text}\n\nReturn the JSON object now.`;

  let parsedJson: z.infer<typeof ParserOutput>;
  try {
    // max_tokens: 16000 per claude-api skill default (gives room for adaptive
    // thinking blocks before the JSON output). thinking: adaptive per skill
    // default for "anything remotely complicated" -- freeform-text-to-structured
    // extraction qualifies. No budget_tokens (deprecated on Opus 4.6).
    const response = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map(b => b.text)
      .join("");

    parsedJson = ParserOutput.parse(JSON.parse(text));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown parser error";
    await supabase
      .from("spine_inbox")
      .update({ parse_notes: `parse failed: ${msg}` })
      .eq("id", inboxId);
    return { ok: false, error: `parse failed: ${msg}` };
  }

  // Write commitments
  const commitmentIds: string[] = [];
  for (const c of parsedJson.commitments) {
    const { data: inserted, error } = await supabase
      .from("commitments")
      .insert({
        user_id: row.user_id,
        contact_id: c.target_contact_id,
        title: c.title,
        description: c.description,
        kind: c.kind,
        source: row.source === "dashboard_bar" ? "dashboard_bar" : "manual",
        source_ref: row.id,
      })
      .select("id")
      .single();
    if (!error && inserted) commitmentIds.push(inserted.id as string);
  }

  // Write signals
  const signalIds: string[] = [];
  for (const s of parsedJson.signals) {
    const { data: inserted, error } = await supabase
      .from("signals")
      .insert({
        user_id: row.user_id,
        contact_id: s.target_contact_id,
        kind: s.kind,
        severity: s.severity,
        title: s.title,
        detail: s.detail,
      })
      .select("id")
      .single();
    if (!error && inserted) signalIds.push(inserted.id as string);
  }

  // Write focus_adds
  const focusIds: string[] = [];
  for (const f of parsedJson.focus_adds) {
    const { data: inserted, error } = await supabase
      .from("focus_queue")
      .insert({
        user_id: row.user_id,
        contact_id: f.contact_id,
        week_of: new Date().toISOString().split("T")[0], // caller computes Monday
        reason: "manual",
        reason_detail: f.reason_detail,
      })
      .select("id")
      .single();
    if (!error && inserted) focusIds.push(inserted.id as string);
  }

  // Collect contact refs
  const contactRefs = parsedJson.contacts_mentioned
    .map(c => c.matched_contact_id)
    .filter((x): x is string => x !== null);

  // Mark inbox row parsed
  const warnings = parsedJson.warnings.length > 0 ? parsedJson.warnings.join(" | ") : null;
  const { data: updated, error: updateErr } = await supabase
    .from("spine_inbox")
    .update({
      parsed: true,
      parsed_at: new Date().toISOString(),
      parsed_commitment_ids: commitmentIds,
      parsed_signal_ids: signalIds,
      parsed_focus_ids: focusIds,
      parsed_contact_refs: contactRefs,
      parse_notes: warnings,
    })
    .eq("id", inboxId)
    .select()
    .single();

  if (updateErr) return { ok: false, error: updateErr.message };

  return {
    ok: true,
    data: {
      id: (updated as { id: string }).id,
      parsed: (updated as { parsed: boolean }).parsed,
      parsed_commitment_ids: commitmentIds,
      parsed_signal_ids: signalIds,
      parsed_focus_ids: focusIds,
    },
  };
}
