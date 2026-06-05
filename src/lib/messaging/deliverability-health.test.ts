import { describe, it, expect } from "vitest";
import { evaluateDeliverabilityHealth } from "./deliverability-health";

const WALL = { maxBounceRate: 0.04, maxComplaintRate: 0.0008 };

describe("evaluateDeliverabilityHealth", () => {
  it("reports no breach for healthy rates", () => {
    const h = evaluateDeliverabilityHealth({ sent: 100, bounced: 1, complained: 0, wall: WALL });
    expect(h.bounceBreach).toBe(false);
    expect(h.complaintBreach).toBe(false);
    expect(h.alerts).toEqual([]);
  });

  it("flags a bounce-rate breach above 4%", () => {
    const h = evaluateDeliverabilityHealth({ sent: 100, bounced: 5, complained: 0, wall: WALL });
    expect(h.bounceBreach).toBe(true);
    expect(h.alerts.join(" ")).toMatch(/Bounce rate/);
  });

  it("flags a complaint-rate breach above 0.08%", () => {
    const h = evaluateDeliverabilityHealth({ sent: 1000, bounced: 0, complained: 1, wall: WALL });
    expect(h.complaintBreach).toBe(true);
    expect(h.alerts.join(" ")).toMatch(/Complaint rate/);
  });

  it("suppresses false alarms below the minimum volume", () => {
    const h = evaluateDeliverabilityHealth({ sent: 5, bounced: 5, complained: 0, wall: WALL });
    expect(h.bounceBreach).toBe(false);
    expect(h.alerts).toEqual([]);
  });

  it("does not divide by zero at zero volume", () => {
    const h = evaluateDeliverabilityHealth({ sent: 0, bounced: 0, complained: 0, wall: WALL });
    expect(h.bounceRate).toBe(0);
    expect(h.complaintBreach).toBe(false);
  });
});
