// Pure evaluator for a blast's deliverability against the WALL ceilings. A spike
// in bounce or complaint rate is the early signal of domain-reputation damage;
// this turns the dashboard-only WALL limits into an actionable alert. The minimum
// volume guard prevents a single bounce during warmup (1/2 = 50%) from firing a
// false alarm.
import { WALL } from "@/lib/open-house/config";

export interface DeliverabilityInput {
  sent: number;
  bounced: number;
  complained: number;
  minVolume?: number;
  wall?: { maxBounceRate: number; maxComplaintRate: number };
}

export interface DeliverabilityHealth {
  bounceRate: number;
  complaintRate: number;
  bounceBreach: boolean;
  complaintBreach: boolean;
  alerts: string[];
}

const DEFAULT_MIN_VOLUME = 20;

export function evaluateDeliverabilityHealth(input: DeliverabilityInput): DeliverabilityHealth {
  const wall = input.wall ?? WALL;
  const minVolume = input.minVolume ?? DEFAULT_MIN_VOLUME;
  const { sent, bounced, complained } = input;

  const bounceRate = sent > 0 ? bounced / sent : 0;
  const complaintRate = sent > 0 ? complained / sent : 0;
  const enoughVolume = sent >= minVolume;
  const bounceBreach = enoughVolume && bounceRate > wall.maxBounceRate;
  const complaintBreach = enoughVolume && complaintRate > wall.maxComplaintRate;

  const alerts: string[] = [];
  if (bounceBreach) {
    alerts.push(
      `Bounce rate ${(bounceRate * 100).toFixed(2)}% exceeds ${(wall.maxBounceRate * 100).toFixed(2)}% ceiling (${bounced}/${sent}).`,
    );
  }
  if (complaintBreach) {
    alerts.push(
      `Complaint rate ${(complaintRate * 100).toFixed(3)}% exceeds ${(wall.maxComplaintRate * 100).toFixed(3)}% ceiling (${complained}/${sent}).`,
    );
  }
  return { bounceRate, complaintRate, bounceBreach, complaintBreach, alerts };
}
