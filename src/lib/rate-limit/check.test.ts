import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// adminClient.rpc is the only Supabase surface checkRateLimit uses for the
// decision; the trailing .from('rate_limits').delete().lt(...).then(...)
// cleanup chain is fire-and-forget. We mock both so tests stay hermetic.

type RpcResult = { data: unknown; error: unknown };
const rpcMock = vi.fn<(fn: string, params: Record<string, unknown>) => Promise<RpcResult>>();
const cleanupThen = vi.fn((onF: () => void) => {
  onF();
  return Promise.resolve();
});
const cleanupLt = vi.fn(() => ({ then: cleanupThen }));
const cleanupDelete = vi.fn(() => ({ lt: cleanupLt }));
const fromMock = vi.fn(() => ({ delete: cleanupDelete }));

vi.mock("@/lib/supabase/admin", () => ({
  adminClient: {
    rpc: (fn: string, params: Record<string, unknown>) => rpcMock(fn, params),
    from: () => fromMock(),
  },
}));

import { checkRateLimit } from "./check";

const FIXED_NOW = new Date("2026-04-25T12:34:56.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
  rpcMock.mockReset();
  cleanupThen.mockClear();
  cleanupLt.mockClear();
  cleanupDelete.mockClear();
  fromMock.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkRateLimit -- window math", () => {
  it("aligns window_start to floor(now / windowSec)", async () => {
    rpcMock.mockResolvedValueOnce({ data: 1, error: null });
    await checkRateLimit("ratelimit:intake:1.2.3.4", 10, 300);

    const args = rpcMock.mock.calls[0][1] as {
      p_key: string;
      p_window_start: string;
    };
    const nowSec = Math.floor(FIXED_NOW.getTime() / 1000);
    const expectedStartSec = Math.floor(nowSec / 300) * 300;
    expect(args.p_key).toBe("ratelimit:intake:1.2.3.4");
    expect(new Date(args.p_window_start).getTime()).toBe(expectedStartSec * 1000);
  });

  it("returns resetAt = window_start + windowSec", async () => {
    rpcMock.mockResolvedValueOnce({ data: 1, error: null });
    const result = await checkRateLimit("ratelimit:intake:ip", 10, 300);

    const nowSec = Math.floor(FIXED_NOW.getTime() / 1000);
    const expectedReset = (Math.floor(nowSec / 300) * 300 + 300) * 1000;
    expect(result.resetAt.getTime()).toBe(expectedReset);
  });
});

describe("checkRateLimit -- increment + allowed/blocked transition", () => {
  it("first call returns count=1, allowed, remaining=limit-1", async () => {
    rpcMock.mockResolvedValueOnce({ data: 1, error: null });
    const result = await checkRateLimit("k", 10, 60);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it("call at limit is allowed, remaining=0", async () => {
    rpcMock.mockResolvedValueOnce({ data: 10, error: null });
    const result = await checkRateLimit("k", 10, 60);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("call past limit is blocked, remaining clamps to 0", async () => {
    rpcMock.mockResolvedValueOnce({ data: 11, error: null });
    const result = await checkRateLimit("k", 10, 60);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("transitions allowed -> blocked at limit+1", async () => {
    rpcMock.mockResolvedValueOnce({ data: 10, error: null });
    const at = await checkRateLimit("k", 10, 60);
    rpcMock.mockResolvedValueOnce({ data: 11, error: null });
    const over = await checkRateLimit("k", 10, 60);
    expect(at.allowed).toBe(true);
    expect(over.allowed).toBe(false);
  });
});

describe("checkRateLimit -- fail open on Supabase error", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("returns allowed=true when RPC returns an error", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "supabase down", code: "PGRST000" },
    });
    const result = await checkRateLimit("k", 10, 60);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(10);
    expect(warnSpy).toHaveBeenCalledWith(
      "[rate-limit] check failed, failing open:",
      expect.objectContaining({ route: "k" }),
    );
  });

  it("returns allowed=true when RPC throws", async () => {
    rpcMock.mockRejectedValueOnce(new Error("network blew up"));
    const result = await checkRateLimit("k", 10, 60);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(10);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("returns allowed=true when RPC returns non-numeric data", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    const result = await checkRateLimit("k", 10, 60);
    expect(result.allowed).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe("extract-ip", () => {
  it("uses first hop of x-forwarded-for", async () => {
    const { extractIp } = await import("./extract-ip");
    const h = new Headers({ "x-forwarded-for": "203.0.113.1, 10.0.0.1, 10.0.0.2" });
    expect(extractIp(h)).toBe("203.0.113.1");
  });

  it("falls back to x-real-ip", async () => {
    const { extractIp } = await import("./extract-ip");
    const h = new Headers({ "x-real-ip": "198.51.100.7" });
    expect(extractIp(h)).toBe("198.51.100.7");
  });

  it("returns 'unknown' when both headers missing", async () => {
    const { extractIp } = await import("./extract-ip");
    expect(extractIp(new Headers())).toBe("unknown");
  });

  it("trims whitespace around the first hop", async () => {
    const { extractIp } = await import("./extract-ip");
    const h = new Headers({ "x-forwarded-for": "  203.0.113.1  , 10.0.0.1" });
    expect(extractIp(h)).toBe("203.0.113.1");
  });
});
