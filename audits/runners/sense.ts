import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { CheckRecord } from "../lib/invariants";
import { KNOWN_ISSUES } from "../lib/known-issues";
import { SenseOutput } from "../lib/report";
import { loadEnv } from "../lib/env";

const HOME = process.env.HOME ?? "/Users/alex";

const STANDING_RULES_SUMMARY = `
Alex's GAT-BOS standing rules (summary, for grounding interpretation):
1. Fill-and-flag: never stop on missing input; emit [PLACEHOLDER: ...] and continue.
2. No em dashes in any output; commas / periods / "--" only.
3. No hard deletes; soft-delete via deleted_at.
4. Web access full except MLS.com and ARMLS.com; client-facing claims need 2-3 corroborating sources.
5. Production-write actions (push, PR open/merge, prod deploy, send) require explicit approval. Local edits autonomous.
6. Three-draft design protocol (Layout / Content / Polish) with approval gates per draft.
7. Copy standards: no exclamation marks; banned words "stunning, breathtaking, amazing"; no lorem ipsum.
8. GAT co-brand: print compliance row only; never volunteer system-wide.
9. Lender partner scoping: Christine McConnell only on Julie/Optima Camelview; Stephanie Reid only on her own pieces; never co-present.
10. Referral handle locked verbatim.
11. Web output minimum: title, meta, H1, JSON-LD, OG, alt text.
13. Three-pass design polish (Structure / Brand+Token / Apply).
17. CRM dev server probe 3000 then 3001 before assuming.
18. Auto-open completed visual output.
19. Obsidian vault sync for durable knowledge files.
20. External-tool handoff via ~/Desktop/PASTE-INTO-<TOOL>; SQL excluded.
21. sed limited to single-line single-file reversible.
23. Supabase CLI exclusive; MCP retired; paste-files retired.
`.trim();

const KNOWN_ISSUES_BLOCK = `
Known Issues currently in effect (do not re-flag these as new findings):
${KNOWN_ISSUES.map(
  (k) => `- ${k.id} (${k.status}, since ${k.since}): ${k.description} -- pointer: ${k.pointer}`,
).join("\n")}
`.trim();

const SENSE_PROMPT = `
You are the Sense Layer of Alex Hollien's GAT-BOS audit system. You receive a JSON document containing the results of three mechanical audit layers (Truth, Surface, Skills/Rules/Hygiene). Your job is to interpret the findings.

Output strict JSON matching this shape:
{
  "broken": [{"item": string, "cite": string, "why": string}],
  "drifting": [{"item": string, "cite": string, "why": string}],
  "surprising": [{"item": string, "cite": string, "why": string}],
  "top3": [{"item": string, "cite": string, "why": string}]
}

Rules:
- "broken" = items that are actively failing or producing wrong behavior right now.
- "drifting" = items trending bad, partially degraded, or stale. Use yellow-severity findings as raw material; classify carefully.
- "surprising" = patterns that stand out beyond the obvious red/yellow checks. Cross-reference smells. Look for second-order signals (e.g., a Tier-A contact aging past cadence WHILE messaging telemetry is broken).
- "top3" = the three findings Alex should fix this week, ranked by blast radius and reversibility.

Each item:
- "item": short label (one phrase).
- "cite": the check id, file path, or table name the finding rests on.
- "why": one sentence, plain English. No em dashes (use "--" or commas).

Constraints:
- Do NOT flag items that match a Known Issue id. Treat those as already-tracked state.
- Do NOT editorialize beyond the data. If the JSON is clean, return empty arrays.
- Maximum 5 items per array; top3 capped at 3.
- No prose outside the JSON. Output JSON only.
`.trim();

function readIfExists(path: string): string | null {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

function buildSystemPrompt(): Anthropic.Messages.TextBlockParam[] {
  const standingRulesPath = resolve(HOME, ".claude/rules/standing-rules.md");
  const fullStandingRules = readIfExists(standingRulesPath) ?? STANDING_RULES_SUMMARY;

  const stable = [
    "You are an audit interpretation layer. Your job is to read structured audit JSON and produce a strict-JSON interpretation. You never add prose outside the JSON envelope.",
    "",
    "STANDING RULES CONTEXT:",
    fullStandingRules,
    "",
    KNOWN_ISSUES_BLOCK,
    "",
    SENSE_PROMPT,
  ].join("\n");

  return [
    {
      type: "text",
      text: stable,
      cache_control: { type: "ephemeral" },
    },
  ];
}

function tryParseJSON(text: string): SenseOutput | null {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end < 0) return null;
  const candidate = trimmed.slice(start, end + 1);
  try {
    const parsed = JSON.parse(candidate);
    return {
      broken: Array.isArray(parsed.broken) ? parsed.broken : [],
      drifting: Array.isArray(parsed.drifting) ? parsed.drifting : [],
      surprising: Array.isArray(parsed.surprising) ? parsed.surprising : [],
      top3: Array.isArray(parsed.top3) ? parsed.top3 : [],
    };
  } catch {
    return null;
  }
}

export type SenseRunResult = {
  sense: SenseOutput;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
  };
  rawText: string;
};

export async function runSense(checks: CheckRecord[]): Promise<SenseRunResult> {
  loadEnv();
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY missing from environment after loadEnv().");
  }

  const client = new Anthropic();

  const auditPayload = {
    checks: checks.map((c) => ({
      id: c.id,
      layer: c.layer,
      title: c.title,
      pass: c.result.pass,
      severity: c.result.severity,
      smell: c.result.smell ?? null,
      knownIssueId: c.result.knownIssueId ?? null,
      payload: c.result.payload,
    })),
  };

  const userMessage = [
    "Audit JSON below. Interpret per the rules in your system prompt. Output strict JSON only.",
    "",
    "```json",
    JSON.stringify(auditPayload, null, 2),
    "```",
  ].join("\n");

  const response = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: buildSystemPrompt(),
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find(
    (b): b is Anthropic.Messages.TextBlock => b.type === "text",
  );
  const rawText = textBlock?.text ?? "";

  const sense = tryParseJSON(rawText) ?? {
    broken: [],
    drifting: [],
    surprising: [
      {
        item: "Sense layer returned unparseable output",
        cite: "audits/runners/sense.ts",
        why: "Model response did not contain valid JSON; downstream interpretation skipped.",
      },
    ],
    top3: [],
  };

  return {
    sense,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
    },
    rawText,
  };
}

// Remaining placeholders: none. Bracket markers above are literal strings used
// inside Sense Layer prompt text describing Rule 1, not unresolved gaps.

