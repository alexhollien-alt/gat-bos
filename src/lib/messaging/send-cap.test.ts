import { describe, it, expect } from "vitest";
import { evaluateSendCap } from "./send-cap";

describe("evaluateSendCap", () => {
  it("allows a batch that stays under the cap and reports remaining", () => {
    const d = evaluateSendCap({ sentToday: 100, requested: 50, cap: 5000 });
    expect(d.allowed).toBe(true);
    expect(d.remaining).toBe(4900);
    expect(d.wouldExceedBy).toBe(0);
  });

  it("allows a batch that lands exactly on the cap", () => {
    const d = evaluateSendCap({ sentToday: 4950, requested: 50, cap: 5000 });
    expect(d.allowed).toBe(true);
    expect(d.remaining).toBe(50);
  });

  it("blocks a batch that would exceed the cap and reports the overage", () => {
    const d = evaluateSendCap({ sentToday: 4900, requested: 200, cap: 5000 });
    expect(d.allowed).toBe(false);
    expect(d.wouldExceedBy).toBe(100);
    expect(d.remaining).toBe(100);
  });

  it("clamps remaining at zero when the day is already over cap", () => {
    const d = evaluateSendCap({ sentToday: 5200, requested: 1, cap: 5000 });
    expect(d.allowed).toBe(false);
    expect(d.remaining).toBe(0);
  });
});
