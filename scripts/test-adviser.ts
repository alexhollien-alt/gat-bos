#!/usr/bin/env npx tsx
// scripts/test-adviser.ts
// Runnable test/demo for the Adviser Strategy utility.
// Usage: npx tsx scripts/test-adviser.ts
//
// Requires ANTHROPIC_API_KEY in the environment (reads from .env.local).
// Does NOT require the dev server or Supabase to be running (usage logging
// will silently fail without Supabase, which is fine for testing).

// Load .env.local for ANTHROPIC_API_KEY
import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
try {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.error("Could not read .env.local -- run from ~/crm");
  process.exit(1);
}

import { createAdvisedCompletion, stripAdviserFromHistory } from "../src/lib/ai/adviser";
import { MODEL_ROUTING } from "../src/config/model-routing";
import type { FeatureKey } from "../src/lib/ai/types";
import type Anthropic from "@anthropic-ai/sdk";

const TEST_PROMPT =
  "Summarize the following text in 2 sentences: The quick brown fox jumps over the lazy dog near the riverbank on a warm summer afternoon.";

async function testFeatureKey(key: FeatureKey): Promise<{
  key: string;
  executor: string;
  adviserMaxUses: number;
  adviserCalled: boolean;
  adviserCallCount: number;
  inputTokens: number;
  outputTokens: number;
  costCents: string;
  durationMs: number;
  contentPreview: string;
}> {
  const routeConfig = MODEL_ROUTING[key];
  const start = Date.now();

  try {
    const result = await createAdvisedCompletion({
      featureKey: key,
      system: "You are a helpful assistant. Be concise.",
      messages: [{ role: "user", content: TEST_PROMPT }],
    });
    const durationMs = Date.now() - start;

    return {
      key,
      executor: routeConfig.executor,
      adviserMaxUses: routeConfig.adviserMaxUses,
      adviserCalled: result.adviserCalled,
      adviserCallCount: result.adviserCallCount,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      costCents: result.costEstimateCents.toFixed(4),
      durationMs,
      contentPreview: result.content.slice(0, 80),
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    return {
      key,
      executor: routeConfig.executor,
      adviserMaxUses: routeConfig.adviserMaxUses,
      adviserCalled: false,
      adviserCallCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      costCents: "0",
      durationMs,
      contentPreview: `ERROR: ${err instanceof Error ? err.message : "unknown"}`,
    };
  }
}

function testStripAdviserFromHistory(): boolean {
  console.log("\n--- Test: stripAdviserFromHistory ---\n");

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: "Hello" },
    {
      role: "assistant",
      content: [
        { type: "text", text: "Let me think about that." } as Anthropic.TextBlock,
        // Simulate adviser blocks (these types come from the beta API)
        { type: "advisor_tool_use" as "text", id: "adv_1", name: "advisor", input: {} } as unknown as Anthropic.TextBlock,
        { type: "advisor_tool_result" as "text", content: "adviser says yes" } as unknown as Anthropic.TextBlock,
        { type: "text", text: "The answer is yes." } as Anthropic.TextBlock,
      ],
    },
    { role: "user", content: "Thanks" },
  ];

  const stripped = stripAdviserFromHistory(messages);

  // Should have 3 messages (user, assistant, user)
  if (stripped.length !== 3) {
    console.log(`FAIL: expected 3 messages, got ${stripped.length}`);
    return false;
  }

  // Assistant message should have only 2 text blocks (adviser blocks removed)
  const assistantContent = stripped[1].content;
  if (!Array.isArray(assistantContent) || assistantContent.length !== 2) {
    console.log(
      `FAIL: expected 2 content blocks in assistant message, got ${
        Array.isArray(assistantContent) ? assistantContent.length : "non-array"
      }`
    );
    return false;
  }

  console.log("PASS: adviser blocks correctly stripped from history");
  return true;
}

function testContactClassificationNoAdviser(): boolean {
  console.log("\n--- Test: contactClassification has adviserMaxUses=0 ---\n");

  const config = MODEL_ROUTING.contactClassification;
  if (config.adviserMaxUses !== 0) {
    console.log(
      `FAIL: expected adviserMaxUses=0, got ${config.adviserMaxUses}`
    );
    return false;
  }

  console.log("PASS: contactClassification correctly configured with no adviser");
  return true;
}

async function main() {
  console.log("=== Adviser Strategy Test Suite ===\n");

  // Test 1: stripAdviserFromHistory (no API call needed)
  const stripPass = testStripAdviserFromHistory();

  // Test 2: contactClassification config check
  const configPass = testContactClassificationNoAdviser();

  // Test 3: Live API calls for each feature key
  console.log("\n--- Test: Live API calls per feature key ---\n");
  console.log("Running a simple completion for each feature key...\n");

  const featureKeys = Object.keys(MODEL_ROUTING) as FeatureKey[];
  const results = [];

  for (const key of featureKeys) {
    process.stdout.write(`  ${key}... `);
    const result = await testFeatureKey(key);
    console.log(
      `${result.durationMs}ms | ${result.inputTokens}/${result.outputTokens} tokens | ${result.costCents}c`
    );
    results.push(result);
  }

  // Print results table
  console.log("\n--- Results Table ---\n");
  console.log(
    "| Feature Key | Executor | Max Adviser | Adviser Called | Calls | In Tokens | Out Tokens | Cost (cents) | Duration |"
  );
  console.log(
    "|---|---|---|---|---|---|---|---|---|"
  );
  for (const r of results) {
    console.log(
      `| ${r.key} | ${r.executor} | ${r.adviserMaxUses} | ${r.adviserCalled} | ${r.adviserCallCount} | ${r.inputTokens} | ${r.outputTokens} | ${r.costCents} | ${r.durationMs}ms |`
    );
  }

  // Summary
  const totalCost = results.reduce(
    (sum, r) => sum + parseFloat(r.costCents),
    0
  );
  console.log(`\nTotal estimated cost: ${totalCost.toFixed(4)} cents`);

  const allPass = stripPass && configPass;
  console.log(`\nUnit tests: ${allPass ? "ALL PASS" : "SOME FAILED"}`);
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
