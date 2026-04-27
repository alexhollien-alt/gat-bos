// Slice 5B Task 4 -- weeklyWhere helper.
//
// Computes the upper-bound timestamp for "this-week-or-overdue" surfaces.
// The cron query is conceptually `due_at <= end_of_week_phoenix`, which
// covers anything due today, anytime this week, and any prior overdue row
// because no lower bound is applied. Callers add their own
// deleted_at/occurred_at filters on top.
//
// Why a single upper bound and not a UNION:
// "Overdue" is anything with a due_at in the past that has not been
// completed. The cron-side completed check is `occurred_at IS NULL` for
// touchpoints and `status NOT IN ('completed','cancelled')` for tasks.
// Combined with the upper-bound test, that covers the full overdue-or-
// due-this-week set without an OR clause that PostgREST struggles to
// express through the JS client.
//
// Time zone: America/Phoenix is fixed UTC-7 year-round (no DST). For
// safety we still compute via Intl with the explicit IANA name; if Alex
// ever moves to America/Denver, the same code accommodates DST without a
// rewrite.

const PHOENIX_TZ = 'America/Phoenix';

export interface WeeklyWhereResult {
  /** ISO-8601 timestamp marking 23:59:59.999 of the upcoming Sunday in zone. */
  endIso: string;
  /** ISO-8601 timestamp marking the asOf instant (midnight UTC pass-through). */
  asOfIso: string;
  /** Day of week the asOf landed on, in zone (0 = Sunday, 6 = Saturday). */
  asOfDayOfWeek: number;
}

export interface WeeklyWhereInput {
  /** Override the current instant. Tests inject a fixed Date. */
  asOf?: Date;
  /** Override the IANA zone. Defaults to America/Phoenix. */
  timeZone?: string;
}

interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  weekdayIndex: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function getZonedParts(instant: Date, timeZone: string): ZonedDateParts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = dtf.formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));
  const weekdayIndex = WEEKDAYS.indexOf(get('weekday') as (typeof WEEKDAYS)[number]);
  return { year, month, day, weekdayIndex };
}

/**
 * How far ahead UTC is of the supplied zone at the given instant.
 * Returns positive ms for behind-UTC zones (Phoenix UTC-7 -> +25_200_000).
 */
function getOffsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = dtf.formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  let localH = get('hour');
  if (localH === 24) localH = 0;
  const localAsUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    localH,
    get('minute'),
    get('second'),
  );
  // Strip sub-second precision from instant so the diff lands cleanly on a
  // whole-second boundary; fractional ms get added back at the call site.
  const instantSec = Math.floor(instant.getTime() / 1000) * 1000;
  return instantSec - localAsUtc;
}

/**
 * Build a UTC instant that corresponds to a given local date + time-of-day in
 * the supplied IANA zone. Iteratively reconciles the offset (handles DST
 * transitions correctly): a first-pass guess can land on the wrong side of a
 * DST jump, so we re-check the offset at the corrected instant and recompute
 * if it shifted.
 */
function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms: number,
  timeZone: string,
): Date {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  const offsetA = getOffsetMs(new Date(naiveUtc), timeZone);
  const corrected = new Date(naiveUtc + offsetA);
  const offsetB = getOffsetMs(corrected, timeZone);
  if (offsetB !== offsetA) {
    return new Date(naiveUtc + offsetB);
  }
  return corrected;
}

export function weeklyWhere(input: WeeklyWhereInput = {}): WeeklyWhereResult {
  const asOf = input.asOf ?? new Date();
  const timeZone = input.timeZone ?? PHOENIX_TZ;
  const zoned = getZonedParts(asOf, timeZone);

  // Days remaining until upcoming Sunday (inclusive of today if Sunday).
  // Weekday indices go 0 (Sun) .. 6 (Sat). "End of week" is end-of-Sunday.
  // Add days at the calendar level so the end-of-day computation runs in
  // the target Sunday's zone state, not the asOf day's. This matters when
  // a DST transition lives between asOf and Sunday: end-of-Sun MDT is one
  // hour earlier in UTC than end-of-Sun MST, and the user-visible "this
  // Sunday at 11:59 PM" must follow the local clock.
  const daysUntilSunday = zoned.weekdayIndex === 0 ? 0 : 7 - zoned.weekdayIndex;
  const sundayCalendar = new Date(
    Date.UTC(zoned.year, zoned.month - 1, zoned.day + daysUntilSunday),
  );
  const endInstant = zonedDateTimeToUtc(
    sundayCalendar.getUTCFullYear(),
    sundayCalendar.getUTCMonth() + 1,
    sundayCalendar.getUTCDate(),
    23,
    59,
    59,
    999,
    timeZone,
  );

  return {
    endIso: endInstant.toISOString(),
    asOfIso: asOf.toISOString(),
    asOfDayOfWeek: zoned.weekdayIndex,
  };
}
