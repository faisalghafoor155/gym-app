import { describe, expect, it } from 'vitest';
import { absenceCost, monthStart, summarise } from '../../src/services/staffAttendance.js';

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe('staff attendance summary', () => {
  // November 2026: 30 days, starting on a Sunday — five Sundays.
  const nov = monthStart('2026-11');
  const afterNov = d('2026-12-15');

  it('counts every unmarked working day as absent, skipping the weekly off', () => {
    const s = summarise(nov, [], { joinedOn: null, weeklyOff: 0, today: afterNov });
    expect(s).toEqual({ workingDays: 25, presentDays: 0, leaveDays: 0, absentDays: 25 });
  });

  it('treats a half day as half present and half absent, and leave as neither', () => {
    const rows = [
      { day: d('2026-11-02'), status: 'present' },
      { day: d('2026-11-03'), status: 'half' },
      { day: d('2026-11-04'), status: 'leave' },
      // Came in on the Sunday off: present, but nothing was owed.
      { day: d('2026-11-08'), status: 'present' },
    ];
    const s = summarise(nov, rows, { joinedOn: null, weeklyOff: 0, today: afterNov });
    expect(s).toEqual({ workingDays: 25, presentDays: 2.5, leaveDays: 1, absentDays: 22.5 });
  });

  it('only counts days that have happened, from the joining date', () => {
    const s = summarise(nov, [], { joinedOn: d('2026-11-10'), weeklyOff: null, today: d('2026-11-12') });
    expect(s.workingDays).toBe(3);
    expect(s.absentDays).toBe(3);
  });

  it("prices an absent day at the month's daily rate", () => {
    expect(absenceCost(30000, nov, 2)).toBe(2000);
    expect(absenceCost(30000, nov, 0.5)).toBe(500);
  });
});
