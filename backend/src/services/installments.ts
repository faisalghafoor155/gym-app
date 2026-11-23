import { Prisma } from '@prisma/client';
import { startOfDay } from './membership.js';

/**
 * Installment plans: the part of a membership's price still owed, split into
 * parts that each fall due on a date.
 *
 * Nothing here records a part as paid. A part is settled when the money paid
 * against the membership reaches it, parts taken in the order they fall due —
 * so recording, editing, refunding or deleting a payment moves the schedule
 * with it, and there is no flag that could be left behind saying otherwise.
 *
 * A schedule covers the *last* part of the price. When the desk sells a Rs.
 * 6,000 plan, takes Rs. 2,000 and splits the rest in two, the schedule is two
 * parts of Rs. 2,000 and the first Rs. 2,000 of payments go to the part that
 * was never on it. The same rule lets a schedule be agreed later, on the Dues
 * page, for whatever is still owed by then.
 */

/** The most parts one membership can be split into. A year paid monthly. */
export const MAX_INSTALLMENTS = 12;

export type InstallmentStatus = 'paid' | 'partly' | 'due' | 'overdue';

export interface InstallmentView {
  seq: number;
  amount: number;
  dueDate: Date;
  /** How much of this part has been covered by payments. */
  paid: number;
  remaining: number;
  status: InstallmentStatus;
}

export interface InstallmentSummary {
  installments: InstallmentView[];
  /** What is owed on parts whose date has already gone by. */
  overdue: number;
  /** The earliest part not yet fully paid, if any is left. */
  nextDue: { dueDate: Date; remaining: number } | null;
}

const round = (n: number): number => Math.round(n * 100) / 100;

/**
 * Where a membership stands against its schedule.
 *
 * `price` is what the membership was sold for and `paid` the total of its
 * settled payments. A part due today is not overdue yet — the member has until
 * the end of the day.
 */
export const installmentSummary = (
  price: number,
  paid: number,
  parts: readonly { seq: number; amount: Prisma.Decimal | number; dueDate: Date }[],
  now: Date = new Date(),
): InstallmentSummary => {
  const today = startOfDay(now);
  const ordered = [...parts].sort((a, b) => a.seq - b.seq);
  const amounts = ordered.map((p) => (typeof p.amount === 'number' ? p.amount : p.amount.toNumber()));
  const scheduled = amounts.reduce((t, a) => t + a, 0);

  // Whatever the price was beyond the schedule was due before it existed, so
  // payments settle that first.
  let left = Math.max(0, round(paid - Math.max(0, price - scheduled)));
  let overdue = 0;
  let nextDue: InstallmentSummary['nextDue'] = null;

  const installments = ordered.map((p, i) => {
    const amount = amounts[i];
    const covered = round(Math.min(amount, left));
    left = round(left - covered);
    const remaining = round(amount - covered);
    const late = p.dueDate < today;
    const status: InstallmentStatus =
      remaining === 0 ? 'paid' : late ? 'overdue' : covered > 0 ? 'partly' : 'due';
    if (remaining > 0 && late) overdue = round(overdue + remaining);
    if (remaining > 0 && !nextDue) nextDue = { dueDate: p.dueDate, remaining };
    return { seq: p.seq, amount, dueDate: p.dueDate, paid: covered, remaining, status };
  });

  return { installments, overdue, nextDue };
};

/** A schedule the request asked for that cannot be accepted. */
export class InstallmentError extends Error {}

/**
 * Writes a membership's schedule, replacing any it had.
 *
 * `owed` is what the parts must add up to: the balance left after today's
 * payment at a sale, or the balance still outstanding when a schedule is
 * agreed or changed later. Not matching it to the paisa is refused rather than
 * patched, since the desk would otherwise promise the member one total and
 * the books would chase another.
 *
 * An empty list removes the schedule; the balance stays owed, as a plain
 * balance again.
 */
export const saveSchedule = async (
  tx: Prisma.TransactionClient,
  membership: { id: string; gymId: string },
  parts: readonly { amount: number; dueDate: Date }[],
  owed: number,
): Promise<void> => {
  if (parts.length > 0) {
    const total = round(parts.reduce((t, p) => t + p.amount, 0));
    if (total !== round(owed)) {
      throw new InstallmentError(
        `The installments add up to Rs. ${total.toLocaleString('en-PK')} but Rs. ${round(owed).toLocaleString('en-PK')} is owed`,
      );
    }
    for (let i = 1; i < parts.length; i++) {
      if (parts[i].dueDate < parts[i - 1].dueDate) {
        throw new InstallmentError('Each installment must fall due on or after the one before it');
      }
    }
  }

  await tx.installment.deleteMany({ where: { membershipId: membership.id } });
  if (parts.length === 0) return;
  await tx.installment.createMany({
    data: parts.map((p, i) => ({
      gymId: membership.gymId,
      membershipId: membership.id,
      seq: i + 1,
      amount: p.amount,
      dueDate: startOfDay(p.dueDate),
    })),
  });
};

/** Include clause for a membership's schedule, in order. */
export const withInstallments = {
  installments: { orderBy: { seq: 'asc' }, select: { seq: true, amount: true, dueDate: true } },
} as const;
