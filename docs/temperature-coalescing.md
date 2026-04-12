# Temperature Coalescing

## What it does

Merges two separate signals into a single 0-to-100 "temperature" number:

1. **rep_pulse** -- Alex's manual gut call on a 1-10 scale, with a
   timestamp showing when it was last set
2. **health_score** -- system-calculated score from the materialized
   view `agent_relationship_health` (exposed via the `agent_health`
   view)

The rule: a fresh gut call wins. If rep_pulse is null, stale (older than
14 days), or both, fall back to the system score.

## Where it lives

`/Users/alex/crm/src/lib/temperature.ts` (96 lines).

## Key entry points

- `calculateTemperature(contact)` at line 37 -- the coalesce function
- `formatPulseAge(timestamp)` at line 86 -- human-readable "3d ago"
  helper
- `temperatureColorClass(value)` at line 75 -- maps a value to a
  Tailwind text color class

## Rule (lines 37 to 69)

```ts
const healthScore = contact.health_score ?? 0;
const repPulse = contact.rep_pulse;
const repPulseUpdatedAt = contact.rep_pulse_updated_at;

let value = healthScore;
let source: TemperatureSource = healthScore > 0 ? "system" : "none";

if (repPulse !== null && repPulseUpdatedAt) {
  const ageMs = Date.now() - new Date(repPulseUpdatedAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays <= REP_PULSE_FRESH_DAYS) {
    value = repPulse * 10;
    source = "rep_pulse";
  }
}
```

Constants at lines 15 to 16:

- `REP_PULSE_FRESH_DAYS = 14` -- freshness window
- `DIVERGENCE_THRESHOLD = 25` -- flag contacts where gut and system
  disagree by more than 25 points

## Return shape (`TemperatureResult`)

```ts
interface TemperatureResult {
  value: number;                      // 0-100 canonical
  source: "rep_pulse" | "system" | "none";
  repPulseUpdatedAt: string | null;
  repPulseRaw: number | null;         // 1-10 gut call
  healthScoreRaw: number;             // 0-100 system
  diverged: boolean;                  // |gut*10 - system| > 25
  colorClass: string;                 // Tailwind text color
}
```

The `diverged` flag lets the UI show a warning indicator when Alex's gut
and the system disagree sharply. Typical cause: a relationship improved
before the interaction data caught up, or the system is scoring off a
burst of email opens that does not match real relationship depth.

## Color buckets (lines 75 to 80)

```ts
function temperatureColorClass(value: number): string {
  if (value >= 80) return "text-red-400";      // hot
  if (value >= 60) return "text-orange-400";   // warm
  if (value >= 40) return "text-yellow-400";   // cool
  return "text-blue-400";                      // cold
}
```

Uses Tailwind color scales, not brand tokens. These are UI-only status
colors and should not be confused with GAT Red (#b31a35) or Electric
Crimson (#e63550).

## Age formatter (lines 86 to 96)

```ts
export function formatPulseAge(timestamp: string | null): string {
  if (!timestamp) return "never";
  const ageMs = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(ageMs / (1000 * 60));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
```

Used in tooltips to show when Alex last set the gut call. "3d ago" next
to a pulse of 9 is meaningful. "47d ago" is stale and the system score
takes over.

## Why not merge in the DB?

The `agent_health` view (piece 3) already coalesces `contacts.health_score`
with `computed_health_score` from the materialized view. That coalesce is
"manual override wins."

This library does a different coalesce: "fresh manual override wins,
stale falls back." The DB-level coalesce does not know the 14-day
freshness rule. Moving it into the view is possible but would require
reading `rep_pulse_updated_at` and `now()` into the query, and then every
refetch would depend on clock state.

Client-side is cleaner. The library runs on whatever row you have,
produces a deterministic result, and does not require a DB migration to
adjust the freshness window.

## Dependencies

- `./types` -- the `Contact` type
- No external deps; pure TypeScript, safe to unit test

## Known constraints

- `rep_pulse` is 1 to 10. The multiplier `* 10` maps it to 0 to 100.
  A pulse of 5 renders as 50, equal to a system score of 50.
- If both sources are missing (`rep_pulse == null && health_score == 0`),
  source is `"none"` and the value is 0.
- The divergence check uses `Math.abs(repPulse * 10 - healthScore)` even
  when rep_pulse is stale, so the UI can still flag the mismatch as a
  signal to update the gut call.

## Example usage

```ts
import { calculateTemperature, formatPulseAge } from "@/lib/temperature";

const temp = calculateTemperature(contact);

<span className={temp.colorClass}>
  {temp.value}
  {temp.source === "rep_pulse" && (
    <span className="ml-1 text-xs text-muted-foreground">
      (gut, {formatPulseAge(temp.repPulseUpdatedAt)})
    </span>
  )}
  {temp.diverged && (
    <AlertCircle className="inline h-3 w-3 text-yellow-500 ml-1" />
  )}
</span>
```
