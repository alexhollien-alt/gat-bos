import { describe, it, expect } from "vitest";
import { score, CADENCE, SCORED_TIERS, type Tier } from "./temperature";

const NOW = new Date("2026-06-04T12:00:00Z");

// A contact whose last touch was exactly `days` ago, no deliverable, no transaction.
function touchedDaysAgo(tier: Tier, days: number) {
  const last = new Date(NOW.getTime() - days * 86_400_000).toISOString();
  return score({
    tier,
    last_touchpoint_at: last,
    last_deliverable_at: null,
    active_transaction_stage: null,
    expected_close_date: null,
    now: NOW,
  });
}

describe("cadence thresholds are locked (Scope 2 decision 2026-06-04)", () => {
  it("CADENCE is exactly A:5 / B:10 / C:14", () => {
    expect(CADENCE).toEqual({ A: 5, B: 10, C: 14 });
  });

  it("tier_target equals the tier's cadence floor", () => {
    expect(touchedDaysAgo("A", 0).tier_target).toBe(5);
    expect(touchedDaysAgo("B", 0).tier_target).toBe(10);
    expect(touchedDaysAgo("C", 0).tier_target).toBe(14);
  });

  it("a contact is overdue (drift > 0) exactly past its tier floor", () => {
    expect(touchedDaysAgo("A", 5).drift).toBe(0);
    expect(touchedDaysAgo("A", 6).drift).toBe(1); // overdue
    expect(touchedDaysAgo("C", 14).drift).toBe(0);
    expect(touchedDaysAgo("C", 15).drift).toBe(1);
  });

  it("excludes Tier P from the scored population", () => {
    expect(SCORED_TIERS).toEqual(["A", "B", "C"]);
    expect((SCORED_TIERS as readonly string[]).includes("P")).toBe(false);
  });
});
