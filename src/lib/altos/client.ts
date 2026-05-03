// src/lib/altos/client.ts
// Minimal Altos Research client for the Weekly Edge pipeline.
//
// Phase 2 ships in fill-and-flag mode: ALTOS_API_KEY is not yet provisioned,
// so fetchAltosSnapshot returns { status: "pending_credentials" } and the
// route writes a placeholder weekly_snapshot row. Downstream phases (writer,
// assembler) treat the placeholder shape as a known signal and surface it in
// the rendered draft so a human reviewer catches it before send.
//
// When credentials land, replace the body of fetchAltosSnapshot with the real
// HTTP call and remove the placeholder branch in the cron route. The shape of
// AltosSnapshotData is the contract the writer and template depend on; do not
// rename keys without updating both.
//
// Slice 8 Phase 2.

import type { TrackedMarket } from "@/lib/markets/tracked";

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

export const ALTOS_PENDING_CREDENTIALS: AltosSnapshotData = {
  status: "pending_credentials",
  median_price: null,
  dom: null,
  inventory: null,
  absorption: null,
  mom_delta: null,
  yoy_delta: null,
};

export function altosCredentialsAvailable(): boolean {
  return Boolean(process.env.ALTOS_API_KEY);
}

export async function fetchAltosSnapshot(
  market: TrackedMarket,
): Promise<AltosSnapshotData> {
  if (!altosCredentialsAvailable()) {
    return ALTOS_PENDING_CREDENTIALS;
  }

  // Real Altos call lands here once credentials are provisioned. Logged in
  // BLOCKERS.md as [2026-05-03] until then. Shape per AltosSnapshotData.
  void market;
  return {
    status: "error",
    median_price: null,
    dom: null,
    inventory: null,
    absorption: null,
    mom_delta: null,
    yoy_delta: null,
    error_message: "Altos client not yet implemented; credentials present but no fetcher",
  };
}
