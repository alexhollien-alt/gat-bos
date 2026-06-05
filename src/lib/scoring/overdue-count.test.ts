import { describe, it, expect } from "vitest";
import { overdueCount, type TemperatureRow } from "./temperature";

function row(tier: "A" | "B" | "C", effective_drift: number): TemperatureRow {
  return {
    contact_id: `${tier}-${effective_drift}`,
    full_name: "Test",
    brokerage: null,
    tier,
    days_since_last_touchpoint: null,
    last_touchpoint_type: null,
    days_since_last_deliverable: null,
    active_transaction_stage: null,
    expected_close_date: null,
    tier_target: 0,
    drift: effective_drift,
    active_escrows: 0,
    effective_drift,
  };
}

describe("overdueCount", () => {
  const rows = [row("A", 3), row("A", -2), row("A", 0), row("B", 1), row("C", 7)];

  it("counts all overdue rows (effective_drift > 0) when no tier filter is given", () => {
    expect(overdueCount(rows)).toBe(3);
  });

  it("counts overdue rows for a single tier when a tier is given", () => {
    expect(overdueCount(rows, "A")).toBe(1);
  });

  it("returns 0 for an empty list", () => {
    expect(overdueCount([])).toBe(0);
  });
});
