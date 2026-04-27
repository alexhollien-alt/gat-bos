// Daily AI budget guard. Reads AI_DAILY_BUDGET_USD env var (default 5.00).
// Calls current_day_ai_spend_usd RPC to get running spend for today
// (America/Phoenix calendar day) and decides whether the next call should
// proceed or be blocked.
//
// Soft-cap warning at 80% writes one activity_events row per feature per day
// with verb='ai.budget_warning'. Hard-cap (>=100%) throws BudgetExceededError;
// caller writes verb='ai.budget_blocked' with feature in context.

import { adminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/error-log";

const DEFAULT_BUDGET_USD = 5.0;
const SOFT_CAP_FRACTION = 0.8;

const OWNER_USER_ID = process.env.OWNER_USER_ID;

export class BudgetExceededError extends Error {
  readonly remaining_usd: number;
  readonly budget_usd: number;
  readonly feature: string;
  constructor(feature: string, remaining_usd: number, budget_usd: number) {
    super(
      `AI daily budget exceeded for feature='${feature}': remaining=$${remaining_usd.toFixed(4)}, budget=$${budget_usd.toFixed(2)}`,
    );
    this.name = "BudgetExceededError";
    this.feature = feature;
    this.remaining_usd = remaining_usd;
    this.budget_usd = budget_usd;
  }
}

export interface BudgetStatus {
  budget_usd: number;
  spent_usd: number;
  remaining_usd: number;
  default_used: boolean;
  blocked: boolean;
  soft_cap_breached: boolean;
}

function readBudgetEnv(): { value: number; default_used: boolean } {
  const raw = process.env.AI_DAILY_BUDGET_USD;
  if (!raw) return { value: DEFAULT_BUDGET_USD, default_used: true };
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { value: DEFAULT_BUDGET_USD, default_used: true };
  }
  return { value: parsed, default_used: false };
}

export async function checkBudget(feature: string): Promise<BudgetStatus> {
  const { value: budget_usd, default_used } = readBudgetEnv();

  const { data, error } = await adminClient.rpc("current_day_ai_spend_usd");
  // RPC returns numeric; supabase-js gives back a string for numerics.
  const spent_usd = error ? 0 : Number(data ?? 0);

  if (error) {
    await logError("ai/_budget", error.message, { feature });
  }

  const remaining_usd = budget_usd - spent_usd;
  const blocked = remaining_usd <= 0;
  const soft_cap_breached = !blocked && spent_usd >= budget_usd * SOFT_CAP_FRACTION;

  if (default_used && OWNER_USER_ID) {
    // Fire-and-forget: surface that the default was used so Alex can set the
    // env var. Best-effort -- if it fails, don't block the call.
    void adminClient
      .from("activity_events")
      .insert({
        user_id: OWNER_USER_ID,
        actor_id: OWNER_USER_ID,
        verb: "ai.budget_default_used",
        object_table: "ai_usage_log",
        object_id: OWNER_USER_ID,
        context: { feature, budget_usd },
      })
      .then(() => null, () => null);
  }

  return { budget_usd, spent_usd, remaining_usd, default_used, blocked, soft_cap_breached };
}

// Soft-cap warnings should fire at most once per (feature, day). We keep an
// in-memory map keyed by feature + Phoenix calendar day. Process restarts will
// re-fire the warning, which is acceptable -- the alternative is a DB read on
// every call.
const warnedToday = new Map<string, string>();

function phoenixDayKey(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Phoenix",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

export async function maybeWriteSoftCapWarning(
  feature: string,
  status: BudgetStatus,
): Promise<void> {
  if (!status.soft_cap_breached) return;
  if (!OWNER_USER_ID) return;
  const day = phoenixDayKey();
  const key = `${feature}::${day}`;
  if (warnedToday.has(key)) return;
  warnedToday.set(key, day);

  void adminClient
    .from("activity_events")
    .insert({
      user_id: OWNER_USER_ID,
      actor_id: OWNER_USER_ID,
      verb: "ai.budget_warning",
      object_table: "ai_usage_log",
      object_id: OWNER_USER_ID,
      context: {
        feature,
        spent_usd: status.spent_usd,
        budget_usd: status.budget_usd,
        remaining_usd: status.remaining_usd,
      },
    })
    .then(() => null, () => null);
}

export async function writeBudgetBlocked(
  feature: string,
  status: BudgetStatus,
): Promise<void> {
  if (!OWNER_USER_ID) return;
  void adminClient
    .from("activity_events")
    .insert({
      user_id: OWNER_USER_ID,
      actor_id: OWNER_USER_ID,
      verb: "ai.budget_blocked",
      object_table: "ai_usage_log",
      object_id: OWNER_USER_ID,
      context: {
        feature,
        spent_usd: status.spent_usd,
        budget_usd: status.budget_usd,
      },
    })
    .then(() => null, () => null);
}
