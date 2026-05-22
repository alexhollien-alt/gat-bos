// src/lib/altos/client.ts
// Market snapshot adapter for the Weekly Edge pipeline.
//
// Original design called for an Altos Research API integration. Altos did not
// issue an obtainable API key, so 2026-05-22 swapped the data source to
// Redfin's public ZIP-level market tracker TSV on S3. The function name
// fetchAltosSnapshot and the AltosSnapshotData type name are preserved as the
// contract the cron, writer, and renderer depend on. See
// ~/.claude/plans/altos-does-not-have-ethereal-lovelace.md for full context.
//
// The AltosSnapshotData shape is the writer/renderer contract; do not rename
// keys without updating ~/crm/src/lib/ai/weekly-edge-writer.ts and
// ~/crm/src/lib/campaigns/render-weekly-edge.ts.

import type { TrackedMarket } from "@/lib/markets/tracked";
import { fetchRedfinSnapshot } from "@/lib/altos/scrape/redfin-tsv";

export interface AltosSnapshotData {
  status: "ok" | "pending_credentials" | "error";
  median_price: number | null;
  dom: number | null;
  inventory: number | null;
  absorption: number | null;
  mom_delta: number | null;
  yoy_delta: number | null;
  raw?: Record<string, unknown>;
  error_message?: string;
}

export async function fetchAltosSnapshot(
  market: TrackedMarket,
): Promise<AltosSnapshotData> {
  return fetchRedfinSnapshot(market);
}
