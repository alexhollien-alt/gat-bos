import { describe, it, expect } from "vitest";
import { runPreflightGate } from "./preflight-gate";

// A fetch stub that always 200s, for the image-check path.
const ok200: typeof fetch = (async () =>
  ({ status: 200 }) as Response) as unknown as typeof fetch;

describe("runPreflightGate", () => {
  it("passes a clean multi-recipient render", async () => {
    const result = await runPreflightGate(
      {
        subject: "Weekly Edge -- June",
        html: "<p>Hi there, here is the market update.</p>",
        recipients: [
          { email: "a@example.com", name: "A" },
          { email: "b@example.com", name: "B" },
        ],
        filterDescription: "weekly-edge approved list",
      },
      ok200,
    );
    expect(result.pass).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it("blocks a render with unresolved template tokens", async () => {
    const result = await runPreflightGate(
      {
        subject: "Hi {{ first_name }}",
        html: "<p>Your update is ready.</p>",
        recipients: [{ email: "a@example.com", name: "A" }],
        filterDescription: "weekly-edge approved list",
      },
      ok200,
    );
    expect(result.pass).toBe(false);
    expect(result.failures.join(" ")).toMatch(/Unresolved template tokens/);
  });
});
