/** @format */

/**
 * Turning the days a caller names into the instants a query needs.
 *
 * A `?to=2026-08-31` means "up to the end of the 31st", not "up to the moment
 * the 31st began" — without stretching it, a payment taken at 2pm on the
 * closing day falls outside a range that ends on its own date.
 */

/**
 * The time zone a gym's day is counted in, wherever the server runs.
 *
 * Vercel runs in UTC and the desktop app runs in whatever the PC is set to, so
 * "today" read from the server clock meant a different day on each. Pakistan
 * keeps no daylight saving, so the offset is fixed and needs no zone database;
 * the attendance table's generated `checkedInOn` column uses the same zone.
 */
export const GYM_TIME_ZONE = 'Asia/Karachi';
const GYM_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The gym's calendar day that `at` falls on, as UTC midnight — the form a
 * `@db.Date` column is read and compared in.
 */
export const gymDay = (at: Date): Date => {
  const d = new Date(at.getTime() + GYM_OFFSET_MS);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

/** The first and last instants of the gym's day that `at` falls on. */
export const gymDayBounds = (at: Date): { start: Date; end: Date } => {
  const start = new Date(gymDay(at).getTime() - GYM_OFFSET_MS);
  return { start, end: new Date(start.getTime() + DAY_MS - 1) };
};

/**
 * The last instant of the day a date-only filter names.
 *
 * `setUTCHours`, not `setHours`, and the distinction is the whole reason this
 * lives in one place. Zod's `z.coerce.date()` parses `2026-08-31` as UTC
 * midnight; moving that to *local* end-of-day lands short of the real one by
 * the server's offset. In Pakistan (UTC+5) the range quietly ended at 18:59
 * UTC, so everything recorded after 7pm on the closing day vanished from
 * reports — the kind of gap that reads as "we took less this month" rather
 * than as a bug.
 *
 * Only for dates that arrived as a date-only string. A timestamp built from
 * `new Date()` is already local and must not be passed through here.
 */
export const endOfDayUtc = (d: Date): Date => {
  const end = new Date(d);
  end.setUTCHours(23, 59, 59, 999);
  return end;
};
