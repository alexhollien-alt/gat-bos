import { Contact } from "./types";

/**
 * Coalesces rep_pulse (Alex's gut call) and health_score (system-calculated)
 * into a single canonical "Temperature" number.
 *
 * Rule:
 *   - If rep_pulse exists AND was set within the last 14 days → use rep_pulse * 10
 *   - Otherwise → use health_score
 *
 * 14-day freshness window because Alex's gut call goes stale fast.
 * A stale rep_pulse is worse than the system's recency-weighted score.
 */

const REP_PULSE_FRESH_DAYS = 14;
const DIVERGENCE_THRESHOLD = 25;

export type TemperatureSource = "rep_pulse" | "system" | "none";

export interface TemperatureResult {
  /** 0-100 scale, the canonical number to render */
  value: number;
  /** Which source produced the value */
  source: TemperatureSource;
  /** ISO timestamp of when rep_pulse was last updated (if applicable) */
  repPulseUpdatedAt: string | null;
  /** Raw rep_pulse on 1-10 scale, for tooltip display */
  repPulseRaw: number | null;
  /** Raw health_score on 0-100 scale, for tooltip display */
  healthScoreRaw: number;
  /** True if rep_pulse and health_score disagree by more than threshold */
  diverged: boolean;
  /** Tailwind text color class based on temperature bucket */
  colorClass: string;
}

export function calculateTemperature(
  contact: Pick<Contact, "rep_pulse" | "rep_pulse_updated_at" | "health_score">
): TemperatureResult {
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

  const diverged =
    repPulse !== null &&
    Math.abs(repPulse * 10 - healthScore) > DIVERGENCE_THRESHOLD;

  return {
    value,
    source,
    repPulseUpdatedAt,
    repPulseRaw: repPulse,
    healthScoreRaw: healthScore,
    diverged,
    colorClass: temperatureColorClass(value),
  };
}

/**
 * Maps a 0-100 temperature to a tailwind text color class.
 * Hot >= 80, Warm 60-79, Cool 40-59, Cold < 40.
 */
function temperatureColorClass(value: number): string {
  if (value >= 80) return "text-red-400";
  if (value >= 60) return "text-orange-400";
  if (value >= 40) return "text-yellow-400";
  return "text-blue-400";
}

/**
 * Format the rep_pulse_updated_at timestamp for tooltip display.
 * Example: "3d ago", "2h ago", "just now"
 */
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
