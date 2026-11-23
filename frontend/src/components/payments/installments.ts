import type { InstallmentDraft } from '../../types';

/** Days between parts when the schedule is first laid out. */
const GAP_DAYS = 30;

const ymd = (d: Date): string => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

export const round = (n: number): number => Math.round(n * 100) / 100;

/**
 * `owed` split into `count` parts a month apart, the first a month from today.
 * Whole rupees each, with the odd rupees on the last part, so the parts always
 * add up to exactly what is owed.
 */
export const splitEvenly = (owed: number, count: number, from: Date = new Date()): InstallmentDraft[] => {
  const each = Math.floor(owed / count);
  return Array.from({ length: count }, (_, i) => {
    const due = new Date(from);
    due.setDate(due.getDate() + GAP_DAYS * (i + 1));
    return {
      amount: i === count - 1 ? round(owed - each * (count - 1)) : each,
      dueDate: ymd(due),
    };
  });
};

/** Whether the parts add up to what is owed, to the paisa — the server
 *  refuses anything else. */
export const partsMatch = (parts: InstallmentDraft[], owed: number): boolean =>
  round(parts.reduce((t, p) => t + (Number(p.amount) || 0), 0)) === round(owed);
