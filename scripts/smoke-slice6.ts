// Slice 6 Task 9 smoke tests: capture-parse AI path + cache hit, draft-revise.
// Run from ~/crm with:
//   node --env-file=.env.local --import tsx scripts/smoke-slice6.ts
// Budget-block smoke is invoked separately via the same script with
// AI_DAILY_BUDGET_USD=0.01 in env.

import { adminClient } from "@/lib/supabase/admin";
import { parseCaptureWithAI } from "@/lib/ai/capture-parse";
import { reviseDraft } from "@/lib/ai/draft-revise";
import { BudgetExceededError } from "@/lib/ai/_client";

type LogRow = {
  id: string;
  feature: string;
  cost_usd: string | number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  context: Record<string, unknown> | null;
  occurred_at: string;
};

async function readRecentLog(feature: string, since: string): Promise<LogRow[]> {
  const { data, error } = await adminClient
    .from("ai_usage_log")
    .select("id, feature, cost_usd, cache_read_tokens, cache_creation_tokens, context, occurred_at")
    .eq("feature", feature)
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: true });
  if (error) throw new Error(`ai_usage_log read failed: ${error.message}`);
  return (data ?? []) as LogRow[];
}

async function readActivityEvents(verb: string, since: string) {
  const { data, error } = await adminClient
    .from("activity_events")
    .select("id, verb, context, created_at")
    .eq("verb", verb)
    .gte("created_at", since);
  if (error) throw new Error(`activity_events read failed: ${error.message}`);
  return data ?? [];
}

async function readCacheRow(feature: string) {
  const { data, error } = await adminClient
    .from("ai_cache")
    .select("feature, cache_key, accessed_at")
    .eq("feature", feature)
    .is("deleted_at", null)
    .order("accessed_at", { ascending: false })
    .limit(5);
  if (error) throw new Error(`ai_cache read failed: ${error.message}`);
  return data ?? [];
}

async function main() {
  const mode = process.argv[2] ?? "default";
  const startedAt = new Date().toISOString();
  console.log(`[smoke-slice6] mode=${mode} started=${startedAt}`);
  console.log(`[smoke-slice6] AI_DAILY_BUDGET_USD=${process.env.AI_DAILY_BUDGET_USD ?? "(unset, default 5.00)"}`);

  if (mode === "budget-block") {
    console.log("\n=== Smoke 3: BudgetExceededError + graceful fallback ===");
    // parseCaptureWithAI catches BudgetExceededError internally and falls back
    // to the rule parser -- that's the graceful surface the spec requires
    // (no 500 to the API caller). We verify behavior via activity_events.
    const result = await parseCaptureWithAI({
      rawText: `Budget block test ${Date.now()} -- met with Sam to discuss listing strategy`,
      contactsIndex: [],
    });
    console.log("parseCaptureWithAI returned (rule fallback expected):", result);
    // Wait briefly for the fire-and-forget activity_events insert.
    await new Promise((r) => setTimeout(r, 1000));
    const blocked = await readActivityEvents("ai.budget_blocked", startedAt);
    console.log(`activity_events ai.budget_blocked rows since smoke start: ${blocked.length}`);
    if (blocked.length === 0) {
      console.error("FAIL: expected at least one ai.budget_blocked activity_events row");
      process.exit(1);
    }
    for (const r of blocked) {
      console.log(`  ${r.created_at} verb=${r.verb} ctx=${JSON.stringify(r.context)}`);
    }

    // Now exercise a path that does NOT swallow the throw: call callClaude
    // directly so the BudgetExceededError surfaces.
    console.log("\nDirect callClaude (should throw BudgetExceededError)…");
    const { callClaude } = await import("@/lib/ai/_client");
    try {
      await callClaude({
        feature: "capture-parse",
        system: [{ type: "text", text: "noop" }],
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 10,
      });
      console.error("FAIL: expected BudgetExceededError to surface from callClaude");
      process.exit(1);
    } catch (err) {
      if (err instanceof BudgetExceededError) {
        console.log(`PASS: BudgetExceededError surfaced (feature=${err.feature}, budget=$${err.budget_usd}, remaining=$${err.remaining_usd})`);
        process.exit(0);
      }
      console.error("FAIL: unexpected error type:", err);
      process.exit(1);
    }
  }

  // Smoke 1: capture-parse with AI, twice. Same input → cache hit on 2nd.
  console.log("\n=== Smoke 1: parseCaptureWithAI duplicate-input cache hit ===");
  const sharedRaw = `Slice6 smoke ${startedAt} -- met with Sam at coffee, follow up next week`;
  const contactsIndex: { id: string; first_name: string; last_name: string }[] = [];

  console.log("Call A (cold)…");
  const a = await parseCaptureWithAI({ rawText: sharedRaw, contactsIndex });
  console.log("Call A result:", a);

  console.log("Call B (should cache-hit)…");
  const b = await parseCaptureWithAI({ rawText: sharedRaw, contactsIndex });
  console.log("Call B result:", b);

  // Verify ai_usage_log rows
  const logRows = await readRecentLog("capture-parse", startedAt);
  console.log(`\nai_usage_log capture-parse rows since smoke start: ${logRows.length}`);
  for (const r of logRows) {
    console.log(
      `  ${r.occurred_at} cost=$${r.cost_usd} cache_hit=${(r.context as Record<string, unknown>)?.cache_hit ?? false} read_toks=${r.cache_read_tokens} create_toks=${r.cache_creation_tokens}`,
    );
  }

  const cacheRows = await readCacheRow("capture-parse");
  console.log(`\nai_cache capture-parse rows: ${cacheRows.length}`);

  const cachedHit = logRows.find(
    (r) => Boolean((r.context as Record<string, unknown>)?.cache_hit) && Number(r.cost_usd) === 0,
  );
  if (!cachedHit) {
    console.error("FAIL: no cache_hit row in ai_usage_log for second call");
    process.exit(1);
  }
  console.log("PASS: cache hit observed");

  // Smoke 4: draft-revise (generateDraft alias).
  console.log("\n=== Smoke 4: reviseDraft post-refactor ===");
  const draft = await reviseDraft(
    {
      from_email: "smoke@example.com",
      from_name: "Smoke Tester",
      subject: "Quick question on the Camelview listing",
      body_plain: "Hi Alex, can you confirm the closing date and the lender we're using?",
      body_html: null,
      snippet: null,
    },
    {
      senderTier: "C",
      contactName: null,
      contactRelationship: null,
      matchReason: "unknown",
    },
  );
  console.log("draft.subject:", draft.subject);
  console.log("draft.body (first 240 chars):", draft.body.slice(0, 240));
  console.log(`tokens in=${draft.input_tokens} out=${draft.output_tokens} cache_read=${draft.cache_read_tokens}`);
  if (!draft.body || !draft.subject) {
    console.error("FAIL: reviseDraft returned empty subject or body");
    process.exit(1);
  }
  console.log("PASS: reviseDraft returned non-empty subject + body");

  // Final spend snapshot.
  const { data: spend } = await adminClient.rpc("current_day_ai_spend_usd");
  console.log(`\ncurrent_day_ai_spend_usd RPC = ${spend}`);

  console.log("\n[smoke-slice6] all smokes passed.");
}

main().catch((err) => {
  console.error("[smoke-slice6] FAIL:", err);
  process.exit(1);
});
