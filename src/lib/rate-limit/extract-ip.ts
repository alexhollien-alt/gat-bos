// Extract a stable per-caller IP key for rate limiting.
//
// Resolution order:
//   1. First hop of x-forwarded-for (Vercel/CDN inbound origin)
//   2. x-real-ip
//   3. literal "unknown"
//
// "unknown" buckets every header-stripped caller into one shared counter.
// That is intentional: we'd rather rate-limit a coordinated header-stripped
// flood as one entity than fail open and let it through.

export function extractIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const firstHop = forwarded.split(",")[0]?.trim();
    if (firstHop) return firstHop;
  }

  const real = headers.get("x-real-ip");
  if (real) {
    const trimmed = real.trim();
    if (trimmed) return trimmed;
  }

  return "unknown";
}
