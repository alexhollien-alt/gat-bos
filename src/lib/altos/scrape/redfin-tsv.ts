// src/lib/altos/scrape/redfin-tsv.ts
// Streams Redfin's public ZIP-level market tracker TSV from S3, filters to the
// target (zip, property_type), picks the row with the latest PERIOD_END, and
// returns an AltosSnapshotData. Replaces the original Altos HTTP API integration
// (Alex could not procure an Altos key; see ~/.claude/plans/altos-does-not-have-ethereal-lovelace.md).
//
// The TSV is ~1.5GB compressed and contains every US ZIP, every property type,
// going back several years. Stream-decompress with zlib and read line-by-line
// via readline so peak memory stays under a few MB regardless of file size.
//
// Source: https://www.redfin.com/news/data-center/ (downloads section).

import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";
import { createInterface } from "node:readline/promises";
import type { AltosSnapshotData } from "@/lib/altos/client";
import type { TrackedMarket } from "@/lib/markets/tracked";

const REDFIN_TSV_URL =
  "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/zip_code_market_tracker.tsv000.gz";

// Column indices, locked from header inspection 2026-05-22. Redfin has not
// renumbered this schema since the dataset launched; a schema change would
// require a code update here.
const COL = {
  PERIOD_END: 1,
  REGION_TYPE: 3,
  REGION: 7,
  PROPERTY_TYPE: 11,
  MEDIAN_SALE_PRICE: 13,
  MEDIAN_SALE_PRICE_MOM: 14,
  MEDIAN_SALE_PRICE_YOY: 15,
  INVENTORY: 34,
  MONTHS_OF_SUPPLY: 37,
  MEDIAN_DOM: 40,
} as const;

// Redfin's PROPERTY_TYPE string values, mapped from our TrackedMarket enum.
// "All Residential" is the umbrella row Redfin emits when type is rolled up.
const PROPERTY_TYPE_MAP: Record<TrackedMarket["altos"]["propertyType"], string> =
  {
    sf: "Single Family Residential",
    condo: "Condo/Co-op",
    all: "All Residential",
  };

function unquote(cell: string): string {
  return cell.startsWith('"') && cell.endsWith('"') ? cell.slice(1, -1) : cell;
}

function parseNum(cell: string | undefined): number | null {
  if (cell === undefined) return null;
  const raw = unquote(cell);
  if (raw === "" || raw === "NA") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function errorSnapshot(message: string): AltosSnapshotData {
  return {
    status: "error",
    median_price: null,
    dom: null,
    inventory: null,
    absorption: null,
    mom_delta: null,
    yoy_delta: null,
    error_message: message,
  };
}

export async function fetchRedfinSnapshot(
  market: TrackedMarket,
): Promise<AltosSnapshotData> {
  const targetRegion = `Zip Code: ${market.altos.zip}`;
  const targetPropertyType = PROPERTY_TYPE_MAP[market.altos.propertyType];

  let response: Response;
  try {
    response = await fetch(REDFIN_TSV_URL);
  } catch (err) {
    return errorSnapshot(
      `fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!response.ok || !response.body) {
    return errorSnapshot(`fetch returned HTTP ${response.status}`);
  }

  let bestRow: string[] | null = null;
  let bestPeriodEnd = "";

  try {
    const gunzip = createGunzip();
    const decompressed = Readable.fromWeb(
      response.body as unknown as Parameters<typeof Readable.fromWeb>[0],
    ).pipe(gunzip);
    const rl = createInterface({ input: decompressed, crlfDelay: Infinity });

    let lineNum = 0;
    for await (const line of rl) {
      lineNum++;
      if (lineNum === 1) continue; // header

      // Cheap pre-filter: skip lines that don't contain the target zip. Avoids
      // tab-splitting 99.99% of rows.
      if (!line.includes(market.altos.zip)) continue;

      const cells = line.split("\t");
      if (cells.length < 41) continue;

      if (unquote(cells[COL.REGION] ?? "") !== targetRegion) continue;
      if (unquote(cells[COL.PROPERTY_TYPE] ?? "") !== targetPropertyType)
        continue;

      const periodEnd = unquote(cells[COL.PERIOD_END] ?? "");
      if (periodEnd > bestPeriodEnd) {
        bestPeriodEnd = periodEnd;
        bestRow = cells;
      }
    }
  } catch (err) {
    return errorSnapshot(
      `stream error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!bestRow) {
    return errorSnapshot(
      `no Redfin row for zip=${market.altos.zip} property_type=${targetPropertyType}`,
    );
  }

  return {
    status: "ok",
    median_price: parseNum(bestRow[COL.MEDIAN_SALE_PRICE]),
    dom: parseNum(bestRow[COL.MEDIAN_DOM]),
    inventory: parseNum(bestRow[COL.INVENTORY]),
    absorption: parseNum(bestRow[COL.MONTHS_OF_SUPPLY]),
    mom_delta: parseNum(bestRow[COL.MEDIAN_SALE_PRICE_MOM]),
    yoy_delta: parseNum(bestRow[COL.MEDIAN_SALE_PRICE_YOY]),
    raw: {
      period_end: bestPeriodEnd,
      source: "redfin-zip-tsv-s3",
    },
  };
}
