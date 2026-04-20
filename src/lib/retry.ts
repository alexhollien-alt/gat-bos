// Timeout + exponential-backoff retry helper. Shared across the Gmail, Calendar,
// Resend, and Claude API wrappers so a single helper governs external-API retry
// behavior across the app.
//
// Defaults match the original per-wrapper values: 10s timeout, 2 retries,
// 1s/2s backoff delays.
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [1000, 2000];

export async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`${label} timed out after ${DEFAULT_TIMEOUT_MS}ms`)),
            DEFAULT_TIMEOUT_MS,
          ),
        ),
      ]);
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`${label} failed`);
}
