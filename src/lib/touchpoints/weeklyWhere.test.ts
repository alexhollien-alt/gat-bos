// Slice 5B Task 4 -- weeklyWhere unit tests.

import { describe, it, expect } from 'vitest';
import { weeklyWhere } from './weeklyWhere';

describe('weeklyWhere', () => {
  it('returns end-of-Sunday for a mid-week Phoenix timestamp', () => {
    // Wednesday 2026-04-15 noon Phoenix == 19:00 UTC (UTC-7, no DST).
    const asOf = new Date('2026-04-15T19:00:00Z');
    const { endIso, asOfDayOfWeek } = weeklyWhere({ asOf });
    expect(asOfDayOfWeek).toBe(3); // Wed
    // End of Sunday 2026-04-19 23:59:59.999 Phoenix == 2026-04-20 06:59:59.999 UTC.
    expect(endIso).toBe('2026-04-20T06:59:59.999Z');
  });

  it('handles the Sunday-night straddle without rolling to next week', () => {
    // Sunday 2026-04-19 22:30 Phoenix == 2026-04-20 05:30 UTC.
    const asOf = new Date('2026-04-20T05:30:00Z');
    const { endIso, asOfDayOfWeek } = weeklyWhere({ asOf });
    expect(asOfDayOfWeek).toBe(0); // Sun
    // Same Sunday end-of-day, not the following Sunday.
    expect(endIso).toBe('2026-04-20T06:59:59.999Z');
  });

  it('handles spring-forward DST under America/Denver', () => {
    // Saturday 2026-03-07 noon Denver == 19:00 UTC (still MST = UTC-7).
    const asOf = new Date('2026-03-07T19:00:00Z');
    const { endIso, asOfDayOfWeek } = weeklyWhere({
      asOf,
      timeZone: 'America/Denver',
    });
    expect(asOfDayOfWeek).toBe(6); // Sat
    // End of Sunday 2026-03-08 23:59:59.999 Denver. After 02:00 local on 03-08,
    // Denver becomes MDT (UTC-6), so 23:59:59.999 local = 05:59:59.999 UTC of
    // the next day.
    expect(endIso).toBe('2026-03-09T05:59:59.999Z');
  });

  it('handles fall-back DST under America/Denver', () => {
    // Saturday 2026-10-31 noon Denver == 18:00 UTC (still MDT = UTC-6).
    const asOf = new Date('2026-10-31T18:00:00Z');
    const { endIso, asOfDayOfWeek } = weeklyWhere({
      asOf,
      timeZone: 'America/Denver',
    });
    expect(asOfDayOfWeek).toBe(6); // Sat
    // End of Sunday 2026-11-01 23:59:59.999 Denver. After 02:00 local on 11-01,
    // Denver becomes MST (UTC-7), so 23:59:59.999 local = 06:59:59.999 UTC of
    // the next day.
    expect(endIso).toBe('2026-11-02T06:59:59.999Z');
  });

  it('returns a valid ISO timestamp for default (no asOf override)', () => {
    const { endIso } = weeklyWhere();
    expect(typeof endIso).toBe('string');
    // Round-trip should parse without producing NaN.
    expect(Number.isNaN(new Date(endIso).getTime())).toBe(false);
  });

  it('produces deterministic output independent of caller-side timezone', () => {
    // Same UTC instant evaluated at America/Phoenix vs America/New_York
    // should produce different end-of-week boundaries: Phoenix is 3 hours
    // behind New York, so a Friday 11pm Phoenix is Saturday 2am New York,
    // crossing the day boundary.
    const asOf = new Date('2026-04-18T06:00:00Z'); // Fri 23:00 Phoenix, Sat 02:00 NY
    const phx = weeklyWhere({ asOf, timeZone: 'America/Phoenix' });
    const ny = weeklyWhere({ asOf, timeZone: 'America/New_York' });
    expect(phx.asOfDayOfWeek).toBe(5); // Fri
    expect(ny.asOfDayOfWeek).toBe(6); // Sat
    expect(phx.endIso).not.toBe(ny.endIso);
  });
});
