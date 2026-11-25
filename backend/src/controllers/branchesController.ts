import type { Response } from 'express';
import prisma from '../db.js';
import { audit } from '../services/audit.js';
import { mainBranchId, pinned } from '../services/branches.js';
import { gymDayBounds, gymDay } from '../services/dates.js';
import { sum } from '../services/money.js';
import type { AuthedRequest } from '../types.js';
import type { AssignStaffBranchBody, CreateBranchBody, IdParam, UpdateBranchBody } from '../schemas.js';

/**
 * A gym's branches, and which staff work where.
 *
 * Every gym has a main branch — made on first use for a gym that signed up
 * after branches existed — so nothing is ever without one to belong to.
 */

const select = { id: true, name: true, address: true, phone: true, isMain: true, createdAt: true } as const;

/**
 * The gym's branches, and the one this account is working in. Staff placed
 * at a branch get only that one: they have no other to switch to.
 */
export const list = async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    await mainBranchId(req.gymId);
    const [branches, me] = await Promise.all([
      prisma.branch.findMany({
        where: { gymId: req.gymId },
        select: { ...select, _count: { select: { members: true, staff: true } } },
        orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
      }),
      prisma.user.findUnique({ where: { id: req.userId }, select: { branchId: true } }),
    ]);
    const fixed = req.role === 'staff' && me?.branchId ? me.branchId : null;
    res.json({
      branches: (fixed ? branches.filter((b) => b.id === fixed) : branches).map(({ _count, ...b }) => ({
        ...b,
        members: _count.members,
        staff: _count.staff,
      })),
      current: req.branchId ?? null,
      /** True when this account cannot leave its branch. */
      fixed: !!fixed,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const create = async (
  req: AuthedRequest<Record<string, string>, unknown, CreateBranchBody>,
  res: Response,
): Promise<void> => {
  try {
    // The main branch first, so the new one is never mistaken for it.
    await mainBranchId(req.gymId);
    const branch = await prisma.branch.create({ data: { gymId: req.gymId, ...req.body }, select });
    await audit(req, {
      action: 'branch.create', entity: 'branch', entityId: branch.id, entityLabel: branch.name,
      after: req.body,
    });
    res.status(201).json(branch);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const update = async (
  req: AuthedRequest<IdParam, unknown, UpdateBranchBody>,
  res: Response,
): Promise<void> => {
  try {
    const existing = await prisma.branch.findFirst({ where: { id: req.params.id, gymId: req.gymId } });
    if (!existing) {
      res.status(404).json({ error: 'Branch not found' });
      return;
    }
    const data = Object.fromEntries(Object.entries(req.body).filter(([, v]) => v !== undefined));
    const branch = await prisma.branch.update({ where: { id: existing.id }, data, select });
    await audit(req, {
      action: 'branch.update', entity: 'branch', entityId: branch.id, entityLabel: branch.name,
      before: { name: existing.name, address: existing.address, phone: existing.phone },
      after: data,
    });
    res.json(branch);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Only an empty branch: one with members or check-ins would leave them filed
 * nowhere. The main branch stays.
 */
export const remove = async (req: AuthedRequest<IdParam>, res: Response): Promise<void> => {
  try {
    const existing = await prisma.branch.findFirst({
      where: { id: req.params.id, gymId: req.gymId },
      include: { _count: { select: { members: true, attendance: true, staff: true } } },
    });
    if (!existing) {
      res.status(404).json({ error: 'Branch not found' });
      return;
    }
    if (existing.isMain) {
      res.status(409).json({ error: 'The main branch cannot be deleted' });
      return;
    }
    if (existing._count.members || existing._count.attendance || existing._count.staff) {
      res.status(409).json({ error: 'Move this branch’s members and staff to another branch first' });
      return;
    }
    await prisma.branch.delete({ where: { id: existing.id } });
    await audit(req, {
      action: 'branch.delete', entity: 'branch', entityId: existing.id, entityLabel: existing.name,
      before: { name: existing.name },
    });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/** The staff accounts and the branch each works at (null: every branch). */
export const listStaff = async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    const staff = await prisma.user.findMany({
      where: { gymId: req.gymId, role: 'staff' },
      select: { id: true, name: true, email: true, staffPermission: true, branchId: true, isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json(staff);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const assignStaff = async (
  req: AuthedRequest<IdParam, unknown, AssignStaffBranchBody>,
  res: Response,
): Promise<void> => {
  const { branchId } = req.body;
  try {
    const user = await prisma.user.findFirst({ where: { id: req.params.id, gymId: req.gymId, role: 'staff' } });
    if (!user) {
      res.status(404).json({ error: 'Staff account not found' });
      return;
    }
    if (branchId && !(await prisma.branch.findFirst({ where: { id: branchId, gymId: req.gymId }, select: { id: true } }))) {
      res.status(404).json({ error: 'Branch not found' });
      return;
    }
    await prisma.user.update({ where: { id: user.id }, data: { branchId } });
    await audit(req, {
      action: 'staff.branch', entity: 'user', entityId: user.id, entityLabel: user.name,
      before: { branchId: user.branchId }, after: { branchId },
    });
    res.json({ id: user.id, branchId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Every branch side by side, for the owner's combined dashboard: members,
 * today's check-ins, this month's takings and spending.
 */
export const overview = async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    await mainBranchId(req.gymId);
    const now = new Date();
    const today = gymDayBounds(now);
    const d = gymDay(now);
    const monthStart = gymDayBounds(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))).start;

    const [branches, members, checkins, payments, expenses, dayPasses] = await Promise.all([
      prisma.branch.findMany({ where: { gymId: req.gymId }, select: { id: true, name: true, isMain: true }, orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }] }),
      prisma.member.groupBy({ by: ['branchId'], where: { gymId: req.gymId }, _count: true }),
      prisma.attendance.groupBy({ by: ['branchId'], where: { gymId: req.gymId, checkedInAt: { gte: today.start, lte: today.end } }, _count: true }),
      prisma.payment.findMany({
        where: { gymId: req.gymId, status: 'paid', paymentDate: { gte: monthStart } },
        select: { amount: true, member: { select: { branchId: true } } },
      }),
      prisma.expense.groupBy({ by: ['branchId'], where: { gymId: req.gymId, spentOn: { gte: monthStart } }, _sum: { amount: true } }),
      prisma.dayPass.groupBy({ by: ['branchId'], where: { gymId: req.gymId, visitedAt: { gte: monthStart } }, _sum: { amount: true } }),
    ]);
    const countOf = (rows: { branchId: string | null; _count: number }[], id: string | null) =>
      rows.find((r) => r.branchId === id)?._count ?? 0;
    const sumOf = (rows: { branchId: string | null; _sum: { amount: unknown } }[], id: string | null) =>
      sum([rows.find((r) => r.branchId === id)?._sum.amount as never]);

    // Staff placed at one branch get their own branch's line and nothing of
    // the others' members or money.
    const fence = pinned(req).branchId;
    const rows = branches.filter((b) => !fence || b.id === fence).map((b) => ({
      id: b.id,
      name: b.name,
      isMain: b.isMain,
      members: countOf(members, b.id),
      checkinsToday: countOf(checkins, b.id),
      collectedThisMonth:
        sum(payments.filter((p) => p.member.branchId === b.id).map((p) => p.amount)) + sumOf(dayPasses, b.id),
      spentThisMonth: sumOf(expenses, b.id),
    }));
    res.json({
      branches: rows,
      // Spending recorded with every branch selected belongs to none of them.
      sharedSpentThisMonth: fence ? 0 : sumOf(expenses, null),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
