/**
 * Today's date as a `YYYY-MM-DD` input value, in the user's own time zone.
 *
 * `new Date().toISOString().split('T')[0]` is the UTC date, which in Pakistan
 * is still yesterday until five in the morning. A payment or a new member
 * entered after midnight defaulted to the day before: the wrong day's
 * collection, and on the 1st, the wrong month.
 */
export const localToday = (): string => localDateInput(new Date());

/** Any moment as a `YYYY-MM-DD` input value, in the user's own time zone. */
export const localDateInput = (d: Date): string => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().split('T')[0]!;
};
