// Phase 4 of idempotent-toasting-tome: drift formula fixtures.
// Pure score() unit tests. The async data-fetching wrapper scoreContacts is
// covered by integration smoke runs against linked prod, not by these tests.

import { describe, it, expect } from "vitest";
import { score, CADENCE } from "./temperature";

const NOW = new Date("2026-05-12T12:00:00Z");
const isoDaysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 86_400_000).toISOString();
const dateInDays = (n: number) => {
  const d = new Date(NOW.getTime() + n * 86_400_000);
  return d.toISOString().slice(0, 10);
};

describe("score()", () => {
  it("never touched and never delivered: drift = 1000 sentinel", () => {
    const out = score({
      tier: "B",
      last_touchpoint_at: null,
      last_deliverable_at: null,
      active_transaction_stage: null,
      expected_close_date: null,
      now: NOW,
    });
    expect(out.drift).toBe(1000);
    expect(out.effective_drift).toBe(1000);
    expect(out.active_escrows).toBe(0);
  });

  it("fresh deliverable, no touchpoint: deliverable wins effective_age", () => {
    const out = score({
      tier: "B", // cadence 10
      last_touchpoint_at: null,
      last_deliverable_at: isoDaysAgo(2),
      active_transaction_stage: null,
      expected_close_date: null,
      now: NOW,
    });
    // effective_age = 2, drift = 2 - 10 = -8
    expect(out.days_since_last_deliverable).toBe(2);
    expect(out.drift).toBe(-8);
    expect(out.effective_drift).toBe(-8);
  });

  it("stale deliverable but recent touchpoint: touchpoint dominates", () => {
    const out = score({
      tier: "A", // cadence 5
      last_touchpoint_at: isoDaysAgo(3),
      last_deliverable_at: isoDaysAgo(60),
      active_transaction_stage: null,
      expected_close_date: null,
      now: NOW,
    });
    // min(3, 60) = 3, drift = 3 - 5 = -2
    expect(out.drift).toBe(-2);
    expect(out.effective_drift).toBe(-2);
  });

  it("under_contract: subtracts 3-day escrow bonus", () => {
    const out = score({
      tier: "C", // cadence 14
      last_touchpoint_at: isoDaysAgo(20),
      last_deliverable_at: null,
      active_transaction_stage: "under_contract",
      expected_close_date: null,
      now: NOW,
    });
    // drift = 20 - 14 = 6; effective = 6 - 3 = 3
    expect(out.drift).toBe(6);
    expect(out.effective_drift).toBe(3);
    expect(out.active_escrows).toBe(1);
  });

  it("in_escrow with no expected_close_date: -3 only, no imminent bonus", () => {
    const out = score({
      tier: "B", // cadence 10
      last_touchpoint_at: isoDaysAgo(15),
      last_deliverable_at: null,
      active_transaction_stage: "in_escrow",
      expected_close_date: null,
      now: NOW,
    });
    // drift = 15 - 10 = 5; effective = 5 - 3 = 2
    expect(out.drift).toBe(5);
    expect(out.effective_drift).toBe(2);
  });

  it("in_escrow closing within 7 days: -3 escrow + -5 imminent = -8", () => {
    const out = score({
      tier: "A", // cadence 5
      last_touchpoint_at: isoDaysAgo(10),
      last_deliverable_at: null,
      active_transaction_stage: "in_escrow",
      expected_close_date: dateInDays(5),
      now: NOW,
    });
    // drift = 10 - 5 = 5; effective = 5 - 3 - 5 = -3
    expect(out.drift).toBe(5);
    expect(out.effective_drift).toBe(-3);
  });

  it("in_escrow closing in 14 days: only -3 escrow, no imminent bonus", () => {
    const out = score({
      tier: "A",
      last_touchpoint_at: isoDaysAgo(10),
      last_deliverable_at: null,
      active_transaction_stage: "in_escrow",
      expected_close_date: dateInDays(14),
      now: NOW,
    });
    // drift = 5; effective = 5 - 3 = 2
    expect(out.effective_drift).toBe(2);
  });

  it("transaction.opened (prospect): no escrow bonus, no imminent bonus", () => {
    const out = score({
      tier: "B",
      last_touchpoint_at: isoDaysAgo(15),
      last_deliverable_at: null,
      active_transaction_stage: "opened",
      expected_close_date: null,
      now: NOW,
    });
    // drift = 5; effective = 5 (opened is not in active stages)
    expect(out.drift).toBe(5);
    expect(out.effective_drift).toBe(5);
    expect(out.active_escrows).toBe(0);
  });

  it("CADENCE constants match locked values A=5 B=10 C=14", () => {
    expect(CADENCE.A).toBe(5);
    expect(CADENCE.B).toBe(10);
    expect(CADENCE.C).toBe(14);
  });
});
