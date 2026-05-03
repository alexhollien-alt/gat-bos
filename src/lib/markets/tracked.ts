// src/lib/markets/tracked.ts
// Single source of truth for the Weekly Edge tracked-market list.
// Adding a new market is one entry below; the Altos pull cron and the
// assembly cron both iterate this list.
//
// slug -- stable identifier (matches weekly_snapshot.market_slug)
// label -- human-readable, surfaces in the rendered email
// altos -- Altos query parameters; consumed by src/lib/altos/client.ts
//
// Slice 8 Phase 2.

export interface TrackedMarket {
  slug: string;
  label: string;
  altos: {
    zip: string;
    propertyType: "sf" | "condo" | "all";
  };
}

export const TRACKED_MARKETS: TrackedMarket[] = [
  {
    slug: "scottsdale-85258-sf",
    label: "Scottsdale 85258 single-family",
    altos: { zip: "85258", propertyType: "sf" },
  },
];
