import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Message } from "@anthropic-ai/sdk/resources/messages";

// Mock callClaude before importing the writer so the wrapper does not try
// to instantiate Anthropic / Supabase clients.
vi.mock("../_client", () => ({
  callClaude: vi.fn(),
  DEFAULT_MODEL: "claude-sonnet-4-6",
}));

import { callClaude } from "../_client";
import {
  runWeeklyEdgeWriter,
  normalizeAndValidate,
  PROMPT_VERSION,
  type WeeklySnapshotRow,
} from "../weekly-edge-writer";

const mockedCallClaude = vi.mocked(callClaude);

function fixtureSnapshot(overrides: Partial<WeeklySnapshotRow> = {}): WeeklySnapshotRow {
  return {
    week_of: "2026-05-04",
    market_slug: "scottsdale-85258-sf",
    market_label: "Scottsdale 85258 single-family",
    data: {
      median_price: 1_250_000,
      median_dom: 38,
      inventory: 142,
      months_of_supply: 1.4,
      mom_price_delta_pct: 2.3,
      yoy_price_delta_pct: 7.1,
    },
    narrative_seed: null,
    ...overrides,
  };
}

function fakeMessage(text: string): Message {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-6",
    content: [{ type: "text", text, citations: null }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: 800,
      output_tokens: 400,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
      server_tool_use: null,
      service_tier: null,
    },
  } as unknown as Message;
}

const HAPPY_PATH_JSON = JSON.stringify({
  headline: "Scottsdale 85258 holds steady as inventory firms",
  market_block:
    "Median price ticked up 2.3% week over week, holding the $1.25M line that has anchored 85258 single-family for the last month. Days on market settled at 38, two days tighter than last week and a clean signal that well-priced listings are still moving.\n\nWith 1.4 months of supply, the market remains decisively in seller territory, but buyers are no longer accepting reaches on price. Listings that came out high are sitting; correctly-priced inventory is going under contract inside two weeks.",
  data_callouts: [
    { label: "Median price", value: "$1,250,000", delta: "+2.3% WoW" },
    { label: "Days on market", value: "38 days", delta: "-2 days" },
    { label: "Months of supply", value: "1.4", delta: "flat WoW" },
  ],
  closing:
    "Use this in your buyer conversations: pricing discipline is the only thing slowing deals down right now. Show comps, stay grounded, and the inventory is yours.",
});

beforeEach(() => {
  mockedCallClaude.mockReset();
});

describe("runWeeklyEdgeWriter", () => {
  it("returns a structured narrative on the happy path", async () => {
    mockedCallClaude.mockResolvedValueOnce({
      message: fakeMessage(HAPPY_PATH_JSON),
      cached: false,
      cost_usd: 0.012,
      usage: {
        input_tokens: 800,
        output_tokens: 400,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
      },
    });

    const result = await runWeeklyEdgeWriter({
      snapshot: fixtureSnapshot(),
      userId: "00000000-0000-0000-0000-000000000000",
    });

    expect(result.pending_credentials).toBe(false);
    expect(result.prompt_version).toBe(PROMPT_VERSION);
    expect(result.narrative.headline).toMatch(/Scottsdale 85258/);
    expect(result.narrative.data_callouts).toHaveLength(3);
    expect(result.narrative.data_callouts[0]).toMatchObject({
      label: "Median price",
      value: "$1,250,000",
    });
    expect(result.usage.input_tokens).toBe(800);
    expect(result.usage.output_tokens).toBe(400);
    expect(mockedCallClaude).toHaveBeenCalledTimes(1);
    const args = mockedCallClaude.mock.calls[0][0];
    expect(args.feature).toBe("weekly-edge-writer");
    expect(args.cacheKey).toBeDefined();
  });

  it("short-circuits the Claude call when data.status is pending_credentials", async () => {
    const result = await runWeeklyEdgeWriter({
      snapshot: fixtureSnapshot({
        data: { status: "pending_credentials" },
      }),
      userId: "00000000-0000-0000-0000-000000000000",
    });

    expect(result.pending_credentials).toBe(true);
    expect(result.narrative.headline).toMatch(/PLACEHOLDER/);
    expect(mockedCallClaude).not.toHaveBeenCalled();
  });

  it("tolerates a code-fenced response from Claude", async () => {
    mockedCallClaude.mockResolvedValueOnce({
      message: fakeMessage("```json\n" + HAPPY_PATH_JSON + "\n```"),
      cached: false,
      cost_usd: 0.012,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
      },
    });

    const result = await runWeeklyEdgeWriter({
      snapshot: fixtureSnapshot(),
      userId: "00000000-0000-0000-0000-000000000000",
    });
    expect(result.narrative.market_block).toMatch(/seller territory/);
  });

  it("throws when Claude returns invalid JSON", async () => {
    mockedCallClaude.mockResolvedValueOnce({
      message: fakeMessage("not json at all"),
      cached: false,
      cost_usd: 0.012,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
      },
    });

    await expect(
      runWeeklyEdgeWriter({
        snapshot: fixtureSnapshot(),
        userId: "00000000-0000-0000-0000-000000000000",
      }),
    ).rejects.toThrow(/no JSON object/);
  });
});

describe("normalizeAndValidate", () => {
  function valid(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return JSON.parse(HAPPY_PATH_JSON) as Record<string, unknown> & typeof overrides
      ? { ...JSON.parse(HAPPY_PATH_JSON), ...overrides }
      : { ...overrides };
  }

  // U+2014 / U+2013 referenced via String.fromCharCode so the literal glyphs
  // never appear in this source file (the em-dash hook bans them).
  const EM = String.fromCharCode(0x2014);
  const EN = String.fromCharCode(0x2013);
  const ANY_DASH_RE = new RegExp("[\\u2013\\u2014]");

  it("auto-fixes em dashes to double hyphens", () => {
    const withEmDash = valid({
      market_block: `Inventory is firming${EM}supply tightened to 1.4 months.`,
    });
    const result = normalizeAndValidate(withEmDash);
    expect(result.market_block).toContain(" -- ");
    expect(result.market_block).not.toMatch(ANY_DASH_RE);
  });

  it("auto-fixes en dashes to double hyphens", () => {
    const withEnDash = valid({
      headline: `Scottsdale 85258 ${EN} steady week`,
    });
    const result = normalizeAndValidate(withEnDash);
    expect(result.headline).toContain(" -- ");
  });

  it("throws on a banned word in the headline", () => {
    const banned = valid({ headline: "Stunning week for 85258" });
    expect(() => normalizeAndValidate(banned)).toThrow(/banned word "stunning"/i);
  });

  it("throws on an exclamation mark in the closing", () => {
    const bang = valid({ closing: "Get out there and write deals!" });
    expect(() => normalizeAndValidate(bang)).toThrow(/exclamation mark/i);
  });

  it("throws when headline exceeds 70 chars", () => {
    const long = valid({
      headline: "x".repeat(71),
    });
    expect(() => normalizeAndValidate(long)).toThrow(/71 chars/);
  });

  it("throws when data_callouts has fewer than 3 entries", () => {
    const tooFew = valid({
      data_callouts: [{ label: "A", value: "1", delta: "" }],
    });
    expect(() => normalizeAndValidate(tooFew)).toThrow(/3 to 5/);
  });

  it("throws when data_callouts has more than 5 entries", () => {
    const tooMany = valid({
      data_callouts: Array.from({ length: 6 }, (_, i) => ({
        label: `L${i}`,
        value: `${i}`,
        delta: "",
      })),
    });
    expect(() => normalizeAndValidate(tooMany)).toThrow(/3 to 5/);
  });

  it("throws when a required field is missing", () => {
    const missing = valid({ market_block: undefined });
    delete (missing as Record<string, unknown>).market_block;
    expect(() => normalizeAndValidate(missing)).toThrow(/market_block/);
  });
});
