import { gymDay } from './dates.js';

/**
 * Months and staff days, shared by the salary sheet and the attendance pages.
 *
 * Every date here is a gym calendar day held as UTC midnight — the form a
 * `@db.Date` column is read and compared in — so day arithmetic is plain UTC.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** "2026-11" → 2026-11-01 as UTC midnight. */
export const monthStart = (ym: string): Date => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, 1));
};

export const monthKey = (d: Date): string => d.toISOString().slice(0, 7);

export const currentMonth = (): string => monthKey(gymDay(new Date()));

export const daysIn = (month: Date): number =>
  new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();

export const monthEnd = (month: Date): Date =>
  new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), daysIn(month)));

export interface AttendanceDay {
  day: Date;
  status: string;
}

export interface AttendanceSummary {
  /** Working days so far: from joining (or the 1st) to today (or month end), less weekly offs. */
  workingDays: number;
  /** A half day counts 0.5. Includes days worked on the weekly off. */
  presentDays: number;
  leaveDays: number;
  /** Working days neither worked nor on leave; a half day leaves 0.5 absent. */
  absentDays: number;
}

/**
 * What a month of attendance rows adds up to for one person.
 *
 * Only days that have happened count: on the 10th, the 11th onwards is not an
 * absence yet. Nor do days before they joined.
 */
export const summarise = (
  month: Date,
  rows: readonly AttendanceDay[],
  opts: { joinedOn: Date | null; weeklyOff: number | null; today?: Date },
): AttendanceSummary => {
  const today = opts.today ?? gymDay(new Date());
  let from = month;
  if (opts.joinedOn && opts.joinedOn > from) from = opts.joinedOn;
  let to = monthEnd(month);
  if (today < to) to = today;

  const byDay = new Map(rows.map((r) => [r.day.getTime(), r.status]));
  let workingDays = 0;
  let presentDays = 0;
  let leaveDays = 0;
  let absentDays = 0;

  for (let t = from.getTime(); t <= to.getTime(); t += DAY_MS) {
    const status = byDay.get(t);
    const off = opts.weeklyOff !== null && new Date(t).getUTCDay() === opts.weeklyOff;
    if (status === 'present') presentDays += 1;
    if (status === 'half') presentDays += 0.5;
    if (off) continue;
    workingDays += 1;
    if (status === 'leave') leaveDays += 1;
    else if (status === 'half') absentDays += 0.5;
    else if (status !== 'present') absentDays += 1;
  }

  return { workingDays, presentDays, leaveDays, absentDays };
};

/** What the absences cost: a day's pay is the salary over the days in the month. */
export const absenceCost = (salary: number, month: Date, absentDays: number): number =>
  Math.round((salary / daysIn(month)) * absentDays);
