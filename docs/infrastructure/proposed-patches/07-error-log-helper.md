# Patch 07 -- `withErrorLog()` server-action helper (review-only sketch)

**Target path:** `~/crm/src/lib/with-error-log.ts` (new file)
**Action:** New utility helper. Existing actions migrate on next-touch. NOT autonomously applied.

---

## Why

Server actions in `src/app/(app)/**/actions.ts` `console.error` only; no `logError()` call -> no durable trail. When something breaks in a server action, the only signal is Vercel function logs (ephemeral) and an error tuple returned to the client.

---

## Sketch

```ts
// src/lib/with-error-log.ts
import { logError } from "@/lib/error-log";

type ServerAction<TArgs extends unknown[], TResult> = (...args: TArgs) => Promise<TResult>;

interface WithErrorLogOptions {
  /** Endpoint label for error_logs.endpoint (defaults to action.name). */
  label?: string;
  /** Optional context-builder; runs only if the action throws. */
  contextFor?: (args: unknown[]) => Record<string, unknown>;
}

/**
 * Wrap a server action so any thrown error is written to error_logs before
 * re-throwing. Preserves the action's signature.
 *
 * Usage:
 *   export const createCampaign = withErrorLog(
 *     async (input) => { ... },
 *     { label: "actions/campaigns/createCampaign" }
 *   );
 */
export function withErrorLog<TArgs extends unknown[], TResult>(
  action: ServerAction<TArgs, TResult>,
  options: WithErrorLogOptions = {},
): ServerAction<TArgs, TResult> {
  const label = options.label ?? action.name ?? "unknown_action";
  return async (...args: TArgs): Promise<TResult> => {
    try {
      return await action(...args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const context = options.contextFor ? options.contextFor(args) : {};
      // Fire-and-forget; do not swallow the original error.
      void logError(label, message, context);
      throw err;
    }
  };
}
```

---

## Migration plan

Per-action, on next-touch. Each conversion is one-line additive:

```ts
// before
export async function createCampaign(input: CampaignInput) { /* ... */ }

// after
export const createCampaign = withErrorLog(
  async (input: CampaignInput) => { /* ... */ },
  { label: "actions/campaigns/createCampaign" }
);
```

Don't bulk-convert during the audit window; risk of mis-typing is high and there's no test coverage on most of these paths.

---

## Tradeoff vs. Sentry

If Sentry (Patch A7) lands first, this helper becomes redundant -- Sentry auto-captures uncaught errors in server actions. The helper is the lighter-weight alternative for "I want a row in error_logs without taking a Sentry dependency."

Both are valid. If Alex picks Sentry, archive this patch.
