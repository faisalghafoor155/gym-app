import type { Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../db.js';
import { audit } from '../services/audit.js';
import { gymDay } from '../services/dates.js';
import { sum, toNumber, withMoney } from '../services/money.js';
import type { AuthedRequest } from '../types.js';
import type {
  CreateSalaryAdjustmentBody, CreateStaffMemberBody, IdParam, PaySalaryBody,
  SalaryMonthQuery, StaffMemberQuery, UpdateStaffMemberBody,
} from '../schemas.js';

/**
 * Staff salaries: who the gym pays, what each month comes to, and paying it.
 *
 * Money leaves the gym twice at most in a month — an advance mid-month and the
 * rest on payday — and each time it is booked as a "salaries" expense, so the
 * profit report sees salaries without anyone typing them in twice. Those
 * expenses belong to this page: the Expenses page will not edit or delete them.
 */

// --- months --------------------------------------------------------------

/** "2026-11" → 2026-11-01 as UTC midnight, the form a `@db.Date` holds. */
const monthStart = (ym: string): Date => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, 1));
};

const monthKey = (d: Date): string => d.toISOString().slice(0, 7);

const currentMonth = (): string => monthKey(gymDay(new Date()));

const daysIn = (month: Date): number =>
  new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();

const monthLabel = (month: Date): string =>
  month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * The salary a month owes before adjustments.
 *
 * Somebody who joined on the 21st of a 30-day month is owed ten days, not
 * thirty — rounded to the rupee, since nobody hands over paisa.
 */
const baseFor = (salary: Prisma.Decimal, joinedOn: Date | null, month: Date): number => {
  const full = salary.toNumber();
  if (!joinedOn || monthKey(joinedOn) !== monthKey(month)) return full;
  const total = daysIn(month);
  const worked = total - joinedOn.getUTCDate() + 1;
  return Math.round((full * worked) / total);
};

// --- shared --------------------------------------------------------------

const staffSelect = {
  id: true, name: true, phone: true, role: true, monthlySalary: true, joinedOn: true,
  isActive: true, notes: true, userId: true,
  user: { select: { id: true, name: true, email: true } },
} as const;

type AdjustmentRow = { kind: string; amount: Prisma.Decimal };

/** Bonuses, advances and deductions of a month, and the net they leave. */
const figures = (base: number, adjustments: readonly AdjustmentRow[]) => {
  const of = (kind: string) => sum(adjustments.filter((a) => a.kind === kind).map((a) => a.amount));
  const bonuses = of('bonus');
  const advances = of('advance');
  const deductions = of('deduction');
  const net = Math.max(0, Math.round((base + bonuses - advances - deductions) * 100) / 100);
  return { baseSalary: base, bonuses, advances, deductions, netPay: net };
};

const isUniqueViolation = (err: unknown): boolean =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

/** The login a profile is linked to must be one of this gym's staff or its owner. */
const checkUser = async (gymId: string, userId: string | null | undefined): Promise<string | null> => {
  if (!userId) return null;
  const user = await prisma.user.findFirst({
    where: { id: userId, gymId, role: { in: ['staff', 'owner'] } },
    select: { id: true },
  });
  return user ? null : 'Login account not found';
};

// --- staff profiles --------------------------------------------------------

export const listStaff = async (
  req: AuthedRequest<Record<string, string>, unknown, unknown, StaffMemberQuery>,
  res: Response,
): Promise<void> => {
  try {
    const staff = await prisma.staffMember.findMany({
      where: { gymId: req.gymId, ...(!req.query.includeInactive && { isActive: true }) },
      select: staffSelect,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
    res.json(staff.map((s) => withMoney(s, 'monthlySalary')));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const createStaff = async (
  req: AuthedRequest<Record<string, string>, unknown, CreateStaffMemberBody>,
  res: Response,
): Promise<void> => {
  const { name, phone, role, monthlySalary, joinedOn, userId, notes } = req.body;
  try {
    const bad = await checkUser(req.gymId, userId);
    if (bad) {
      res.status(404).json({ error: bad });
      return;
    }

    const staff = await prisma.staffMember.create({
      data: {
        gymId: req.gymId, name, phone, role, monthlySalary,
        joinedOn: joinedOn ?? null, userId: userId ?? null, notes,
      },
      select: staffSelect,
    });

    await audit(req, {
      action: 'staffMember.create',
      entity: 'staffMember',
      entityId: staff.id,
      entityLabel: name,
      after: { name, role, monthlySalary, joinedOn },
    });

    res.status(201).json(withMoney(staff, 'monthlySalary'));
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: 'That login is already linked to another staff profile' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const updateStaff = async (
  req: AuthedRequest<IdParam, unknown, UpdateStaffMemberBody>,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const { name, phone, role, monthlySalary, joinedOn, userId, notes, isActive } = req.body;
  try {
    const existing = await prisma.staffMember.findFirst({ where: { id, gymId: req.gymId } });
    if (!existing) {
      res.status(404).json({ error: 'Staff member not found' });
      return;
    }
    const bad = await checkUser(req.gymId, userId);
    if (bad) {
      res.status(404).json({ error: bad });
      return;
    }

    const updated = await prisma.staffMember.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(role !== undefined && { role }),
        ...(monthlySalary !== undefined && { monthlySalary }),
        ...(joinedOn !== undefined && { joinedOn }),
        ...(userId !== undefined && { userId }),
        ...(notes !== undefined && { notes }),
        ...(isActive !== undefined && { isActive }),
      },
      select: staffSelect,
    });

    await audit(req, {
      action: 'staffMember.update',
      entity: 'staffMember',
      entityId: id,
      entityLabel: updated.name,
      before: { name: existing.name, role: existing.role, monthlySalary: existing.monthlySalary, isActive: existing.isActive },
      after: { name: updated.name, role: updated.role, monthlySalary: updated.monthlySalary, isActive: updated.isActive },
    });

    res.json(withMoney(updated, 'monthlySalary'));
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: 'That login is already linked to another staff profile' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Only for a profile added by mistake. Anyone who has been paid or advanced
 * money stays on the books; they are marked as left instead.
 */
export const removeStaff = async (
  req: AuthedRequest<IdParam>,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  try {
    const existing = await prisma.staffMember.findFirst({
      where: { id, gymId: req.gymId },
      include: { _count: { select: { payments: true, adjustments: true } } },
    });
    if (!existing) {
      res.status(404).json({ error: 'Staff member not found' });
      return;
    }
    if (existing._count.payments > 0 || existing._count.adjustments > 0) {
      res.status(409).json({ error: 'This person has salary records. Mark them as left instead.' });
      return;
    }

    await prisma.staffMember.delete({ where: { id } });

    await audit(req, {
      action: 'staffMember.delete',
      entity: 'staffMember',
      entityId: id,
      entityLabel: existing.name,
      before: { name: existing.name, role: existing.role, monthlySalary: existing.monthlySalary },
    });

    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// --- the month's sheet -------------------------------------------------------

const paymentSelect = {
  id: true, month: true, baseSalary: true, bonuses: true, advances: true, deductions: true,
  netPay: true, method: true, channel: true, reference: true, paidAt: true, notes: true,
  recordedBy: { select: { id: true, name: true } },
} as const;

const PAYMENT_MONEY = ['baseSalary', 'bonuses', 'advances', 'deductions', 'netPay'] as const;

/**
 * One line per person for a month: what they are owed, what has been taken
 * off or added, and whether it has been paid.
 *
 * A paid line reads from its payment, not from today's salary and
 * adjustments, so a raise given in December does not rewrite November.
 */
export const getSheet = async (
  req: AuthedRequest<Record<string, string>, unknown, unknown, SalaryMonthQuery>,
  res: Response,
): Promise<void> => {
  const key = req.query.month ?? currentMonth();
  const month = monthStart(key);
  const monthEnd = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), daysIn(month)));
  try {
    const staff = await prisma.staffMember.findMany({
      where: {
        gymId: req.gymId,
        // Nobody who had not joined yet; anyone who has left, only if they
        // were paid or given something this month.
        AND: [
          { OR: [{ joinedOn: null }, { joinedOn: { lte: monthEnd } }] },
          {
            OR: [
              { isActive: true },
              { payments: { some: { month } } },
              { adjustments: { some: { month } } },
            ],
          },
        ],
      },
      select: {
        ...staffSelect,
        adjustments: {
          where: { month },
          select: { id: true, kind: true, amount: true, notes: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
        payments: { where: { month }, select: paymentSelect },
      },
      orderBy: { name: 'asc' },
    });

    const rows = staff.map(({ adjustments, payments, ...person }) => {
      const payment = payments[0] ?? null;
      const owed = payment
        ? {
          baseSalary: toNumber(payment.baseSalary),
          bonuses: toNumber(payment.bonuses),
          advances: toNumber(payment.advances),
          deductions: toNumber(payment.deductions),
          netPay: toNumber(payment.netPay),
        }
        : figures(baseFor(person.monthlySalary, person.joinedOn, month), adjustments);
      return {
        staffMember: withMoney(person, 'monthlySalary'),
        ...owed,
        adjustments: adjustments.map((a) => withMoney(a, 'amount')),
        payment: payment && withMoney(payment, ...PAYMENT_MONEY),
      };
    });

    const paid = rows.filter((r) => r.payment);
    res.json({
      month: key,
      rows,
      totals: {
        staff: rows.length,
        payroll: Math.round(rows.reduce((t, r) => t + r.baseSalary + r.bonuses - r.deductions, 0) * 100) / 100,
        advances: Math.round(rows.reduce((t, r) => t + r.advances, 0) * 100) / 100,
        paid: Math.round(paid.reduce((t, r) => t + r.netPay, 0) * 100) / 100,
        unpaid: Math.round(rows.filter((r) => !r.payment).reduce((t, r) => t + r.netPay, 0) * 100) / 100,
        paidCount: paid.length,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// --- advances, deductions, bonuses ---------------------------------------------

const paidMonthError = 'This month is already paid. Undo the payment first to change it.';

export const createAdjustment = async (
  req: AuthedRequest<Record<string, string>, unknown, CreateSalaryAdjustmentBody>,
  res: Response,
): Promise<void> => {
  const { staffMemberId, kind, amount, notes } = req.body;
  const month = monthStart(req.body.month);
  try {
    const person = await prisma.staffMember.findFirst({ where: { id: staffMemberId, gymId: req.gymId } });
    if (!person) {
      res.status(404).json({ error: 'Staff member not found' });
      return;
    }
    const paid = await prisma.salaryPayment.findUnique({
      where: { staffMemberId_month: { staffMemberId, month } },
      select: { id: true },
    });
    if (paid) {
      res.status(409).json({ error: paidMonthError });
      return;
    }

    const adjustment = await prisma.$transaction(async (tx) => {
      // An advance is cash out of the drawer today, so it is an expense today.
      const expense = kind === 'advance'
        ? await tx.expense.create({
          data: {
            gymId: req.gymId,
            category: 'salaries',
            amount,
            spentOn: new Date(),
            vendor: person.name,
            notes: `Salary advance — ${monthLabel(month)}`,
            recordedById: req.userId,
          },
        })
        : null;
      return tx.salaryAdjustment.create({
        data: {
          gymId: req.gymId, staffMemberId, kind, amount, month, notes,
          expenseId: expense?.id ?? null, recordedById: req.userId,
        },
      });
    });

    await audit(req, {
      action: 'salaryAdjustment.create',
      entity: 'salaryAdjustment',
      entityId: adjustment.id,
      entityLabel: `${person.name} · ${kind} · ${monthLabel(month)}`,
      after: { kind, amount, month: monthKey(month), notes },
    });

    res.status(201).json(withMoney(adjustment, 'amount'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const removeAdjustment = async (
  req: AuthedRequest<IdParam>,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  try {
    const existing = await prisma.salaryAdjustment.findFirst({
      where: { id, gymId: req.gymId },
      include: { staffMember: { select: { name: true } } },
    });
    if (!existing) {
      res.status(404).json({ error: 'Adjustment not found' });
      return;
    }
    const paid = await prisma.salaryPayment.findUnique({
      where: { staffMemberId_month: { staffMemberId: existing.staffMemberId, month: existing.month } },
      select: { id: true },
    });
    if (paid) {
      res.status(409).json({ error: paidMonthError });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.salaryAdjustment.delete({ where: { id } });
      if (existing.expenseId) await tx.expense.delete({ where: { id: existing.expenseId } });
    });

    await audit(req, {
      action: 'salaryAdjustment.delete',
      entity: 'salaryAdjustment',
      entityId: id,
      entityLabel: `${existing.staffMember.name} · ${existing.kind} · ${monthLabel(existing.month)}`,
      before: { kind: existing.kind, amount: existing.amount, month: monthKey(existing.month), notes: existing.notes },
    });

    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// --- payday -------------------------------------------------------------------

export const pay = async (
  req: AuthedRequest<Record<string, string>, unknown, PaySalaryBody>,
  res: Response,
): Promise<void> => {
  const { staffMemberId, method, channel, reference, notes } = req.body;
  const month = monthStart(req.body.month);
  try {
    const person = await prisma.staffMember.findFirst({
      where: { id: staffMemberId, gymId: req.gymId },
      include: { adjustments: { where: { month }, select: { kind: true, amount: true } } },
    });
    if (!person) {
      res.status(404).json({ error: 'Staff member not found' });
      return;
    }
    if (monthKey(month) > currentMonth()) {
      res.status(400).json({ error: 'A month that has not started yet cannot be paid' });
      return;
    }

    const f = figures(baseFor(person.monthlySalary, person.joinedOn, month), person.adjustments);

    const payment = await prisma.$transaction(async (tx) => {
      const expense = f.netPay > 0
        ? await tx.expense.create({
          data: {
            gymId: req.gymId,
            category: 'salaries',
            amount: f.netPay,
            spentOn: new Date(),
            vendor: person.name,
            notes: `Salary — ${monthLabel(month)}`,
            recordedById: req.userId,
          },
        })
        : null;
      return tx.salaryPayment.create({
        data: {
          gymId: req.gymId,
          staffMemberId,
          month,
          ...f,
          method,
          channel: method === 'online' ? channel : null,
          reference: method === 'online' ? reference : null,
          notes,
          expenseId: expense?.id ?? null,
          recordedById: req.userId,
        },
        select: paymentSelect,
      });
    });

    await audit(req, {
      action: 'salary.pay',
      entity: 'salaryPayment',
      entityId: payment.id,
      entityLabel: `${person.name} · ${monthLabel(month)} · Rs. ${f.netPay}`,
      after: { month: monthKey(month), ...f, method },
    });

    res.status(201).json(withMoney(payment, ...PAYMENT_MONEY));
  } catch (err) {
    // Two clicks, or two people, paying the same month: the unique key keeps
    // one and the other is told so rather than paying twice.
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: 'This month is already paid' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/** Everything a printed salary slip shows. */
export const getPayment = async (
  req: AuthedRequest<IdParam>,
  res: Response,
): Promise<void> => {
  try {
    const payment = await prisma.salaryPayment.findFirst({
      where: { id: req.params.id, gymId: req.gymId },
      select: {
        ...paymentSelect,
        staffMember: { select: { id: true, name: true, phone: true, role: true, joinedOn: true } },
      },
    });
    if (!payment) {
      res.status(404).json({ error: 'Salary payment not found' });
      return;
    }
    const adjustments = await prisma.salaryAdjustment.findMany({
      where: { staffMemberId: payment.staffMember.id, month: payment.month },
      select: { id: true, kind: true, amount: true, notes: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json({
      ...withMoney(payment, ...PAYMENT_MONEY),
      month: monthKey(payment.month),
      adjustments: adjustments.map((a) => withMoney(a, 'amount')),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/** Undoes a payday entered by mistake, taking its expense with it. */
export const removePayment = async (
  req: AuthedRequest<IdParam>,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  try {
    const existing = await prisma.salaryPayment.findFirst({
      where: { id, gymId: req.gymId },
      include: { staffMember: { select: { name: true } } },
    });
    if (!existing) {
      res.status(404).json({ error: 'Salary payment not found' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.salaryPayment.delete({ where: { id } });
      if (existing.expenseId) await tx.expense.delete({ where: { id: existing.expenseId } });
    });

    await audit(req, {
      action: 'salary.undo',
      entity: 'salaryPayment',
      entityId: id,
      entityLabel: `${existing.staffMember.name} · ${monthLabel(existing.month)}`,
      before: {
        month: monthKey(existing.month),
        netPay: existing.netPay,
        method: existing.method,
        paidAt: existing.paidAt,
      },
    });

    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
