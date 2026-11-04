import type { Response } from 'express';
import prisma from '../db.js';
import type { AuthedRequest } from '../types.js';
import { PLAN_LABELS } from '../services/subscription.js';
import { PENDING_APPROVAL_REASON } from './authController.js';

/**
 * The operator's view of every gym on the platform: who signed up, whether
 * they are being let in, how many people use them, and where their own
 * subscription to us stands.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_WINDOW_DAYS = 7;
const EXPIRING_SOON_DAYS = 7;

/** "monthly" / "yearly" for the lengths that are, the raw days otherwise. */
const billingCycle = (periodDays: number): string => {
  if (periodDays >= 28 && periodDays <= 31) return 'monthly';
  if (periodDays >= 88 && periodDays <= 93) return 'quarterly';
  if (periodDays >= 180 && periodDays <= 186) return '6 months';
  if (periodDays >= 360 && periodDays <= 366) return 'yearly';
  return `${periodDays} days`;
};

export const listGyms = async (_req: AuthedRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const activeSince = new Date(now.getTime() - ACTIVE_WINDOW_DAYS * DAY_MS);

    const [gyms, logins, recent, openInvoices, owners] = await Promise.all([
      prisma.gym.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          subscription: true,
          _count: { select: { members: true } },
        },
      }),
      prisma.user.groupBy({
        by: ['gymId'],
        where: { role: { in: ['owner', 'staff'] } },
        _count: { _all: true },
        _max: { lastLoginAt: true },
      }),
      prisma.user.groupBy({
        by: ['gymId'],
        where: { lastLoginAt: { gte: activeSince } },
        _count: { _all: true },
      }),
      prisma.subscriptionInvoice.findMany({
        where: { status: 'open' },
        orderBy: { dueDate: 'asc' },
        select: { gymId: true, amount: true, dueDate: true },
      }),
      prisma.user.findMany({
        where: { role: 'owner' },
        orderBy: { createdAt: 'asc' },
        select: { gymId: true, email: true },
      }),
    ]);

    const loginByGym = new Map(logins.map(l => [l.gymId, l]));
    const recentByGym = new Map(recent.map(r => [r.gymId, r._count._all]));
    const invoiceByGym = new Map<string, { amount: number; dueDate: Date }>();
    for (const inv of openInvoices) {
      // Ordered by due date, so the first one seen is the one most overdue.
      if (!invoiceByGym.has(inv.gymId)) {
        invoiceByGym.set(inv.gymId, { amount: Number(inv.amount), dueDate: inv.dueDate });
      }
    }
    const emailByGym = new Map<string, string>();
    for (const o of owners) if (!emailByGym.has(o.gymId)) emailByGym.set(o.gymId, o.email);

    const rows = gyms.map(g => {
      const login = loginByGym.get(g.id);
      const sub = g.subscription;

      const status = !g.suspendedAt
        ? 'active'
        : g.suspendedReason === PENDING_APPROVAL_REASON
          ? 'pending'
          : 'suspended';

      let subscription: null | {
        plan: string; amount: number; cycle: string; periodDays: number;
        paidThrough: Date | null; daysLeft: number | null;
        state: 'unpaid' | 'expired' | 'expiring' | 'paid' | 'stopped';
      } = null;
      if (sub) {
        const daysLeft = sub.paidThrough
          ? Math.ceil((sub.paidThrough.getTime() - now.getTime()) / DAY_MS)
          : null;
        subscription = {
          plan: PLAN_LABELS[sub.plan],
          amount: Number(sub.amount),
          cycle: billingCycle(sub.periodDays),
          periodDays: sub.periodDays,
          paidThrough: sub.paidThrough,
          daysLeft,
          state: !sub.active
            ? 'stopped'
            : daysLeft === null
              ? 'unpaid'
              : daysLeft < 0
                ? 'expired'
                : daysLeft <= EXPIRING_SOON_DAYS
                  ? 'expiring'
                  : 'paid',
        };
      }

      return {
        id: g.id,
        name: g.name,
        ownerName: g.ownerName,
        ownerEmail: emailByGym.get(g.id) ?? null,
        phone: g.phone,
        plan: PLAN_LABELS[g.plan],
        status,
        suspendedReason: g.suspendedReason,
        createdAt: g.createdAt,
        staffAccounts: login?._count._all ?? 0,
        members: g._count.members,
        activeUsers7d: recentByGym.get(g.id) ?? 0,
        lastLoginAt: login?._max.lastLoginAt ?? null,
        subscription,
        openInvoice: invoiceByGym.get(g.id) ?? null,
      };
    });

    // What the paying gyms add up to in a month, whatever their cycle — a
    // yearly price is scaled down to 30 days so the figures can be compared.
    const monthlyRevenue = rows.reduce((sum, r) => {
      const s = r.subscription;
      return s && s.state !== 'stopped' ? sum + (s.amount / s.periodDays) * 30 : sum;
    }, 0);

    res.json({
      summary: {
        gyms: rows.length,
        active: rows.filter(r => r.status === 'active').length,
        pending: rows.filter(r => r.status === 'pending').length,
        suspended: rows.filter(r => r.status === 'suspended').length,
        members: rows.reduce((n, r) => n + r.members, 0),
        activeUsers7d: rows.reduce((n, r) => n + r.activeUsers7d, 0),
        expiringSoon: rows.filter(r => r.subscription?.state === 'expiring').length,
        expired: rows.filter(r => r.subscription?.state === 'expired').length,
        monthlyRevenue: Math.round(monthlyRevenue),
      },
      gyms: rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/** Loads the gym an action is aimed at, or answers 404. */
const findGym = async (id: string, res: Response) => {
  const gym = await prisma.gym.findUnique({
    where: { id },
    select: { id: true, name: true, suspendedAt: true, suspendedReason: true },
  });
  if (!gym) res.status(404).json({ error: 'Gym not found' });
  return gym;
};

/** Lets a gym waiting for approval in. */
export const approveGym = async (
  req: AuthedRequest<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    const gym = await findGym(req.params.id, res);
    if (!gym) return;
    if (gym.suspendedReason !== PENDING_APPROVAL_REASON) {
      res.status(409).json({ error: 'This gym is not waiting for approval' });
      return;
    }
    await prisma.gym.update({
      where: { id: gym.id },
      data: { suspendedAt: null, suspendedReason: null },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/** Lifts any suspension. The data was never touched, so nothing is restored. */
export const resumeGym = async (
  req: AuthedRequest<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    const gym = await findGym(req.params.id, res);
    if (!gym) return;
    await prisma.gym.update({
      where: { id: gym.id },
      data: { suspendedAt: null, suspendedReason: null },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/** Stops a gym at the door with a reason its owner will read. */
export const suspendGym = async (
  req: AuthedRequest<{ id: string }, unknown, { reason?: string }>,
  res: Response,
): Promise<void> => {
  try {
    const gym = await findGym(req.params.id, res);
    if (!gym) return;
    // The operator's own gym is the one thing they could lock themselves out
    // of this page with.
    if (gym.id === req.gymId) {
      res.status(400).json({ error: 'You cannot suspend your own gym' });
      return;
    }
    await prisma.gym.update({
      where: { id: gym.id },
      data: {
        suspendedAt: gym.suspendedAt ?? new Date(),
        suspendedReason:
          req.body.reason?.trim() ||
          "This gym's access has been suspended. Please contact support.",
      },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Erases a gym and everything that belongs to it. Unlike suspending, this
 * cannot be undone, so the gym's own name must be typed back as confirmation.
 *
 * The relations to a gym carry no cascade, so the rows are cleared child
 * first, in one transaction: a half-deleted gym would be worse than either end.
 */
export const deleteGym = async (
  req: AuthedRequest<{ id: string }, unknown, { confirmName?: string }>,
  res: Response,
): Promise<void> => {
  try {
    const gym = await findGym(req.params.id, res);
    if (!gym) return;
    if (gym.id === req.gymId) {
      res.status(400).json({ error: 'You cannot delete your own gym' });
      return;
    }
    if (req.body.confirmName?.trim() !== gym.name) {
      res.status(400).json({ error: 'Type the gym name exactly to confirm' });
      return;
    }

    const gymId = gym.id;
    await prisma.$transaction(async (tx) => {
      const memberIds = (await tx.member.findMany({ where: { gymId }, select: { id: true } })).map(m => m.id);
      const membershipIds = (await tx.membership.findMany({ where: { gymId }, select: { id: true } })).map(m => m.id);
      await tx.promoRedemption.deleteMany({ where: { gymId } });
      await tx.promoCode.deleteMany({ where: { gymId } });
      await tx.referralReward.deleteMany({ where: { gymId } });
      await tx.locker.deleteMany({ where: { gymId } });
      await tx.memberMeasurement.deleteMany({ where: { gymId } });
      await tx.membershipFreeze.deleteMany({ where: { gymId } });
      await tx.greetingLog.deleteMany({ where: { gymId } });
      await tx.reminderLog.deleteMany({ where: { gymId } });
      await tx.classBooking.deleteMany({ where: { gymId } });
      await tx.classSchedule.deleteMany({ where: { gymId } });
      await tx.class.deleteMany({ where: { gymId } });
      await tx.ptSession.deleteMany({ where: { gymId } });
      await tx.paymentIntent.deleteMany({ where: { gymId } });
      await tx.supplementSale.deleteMany({ where: { gymId } });
      await tx.payment.deleteMany({ where: { gymId } });
      await tx.expense.deleteMany({ where: { gymId } });
      await tx.supplement.deleteMany({ where: { gymId } });
      await tx.memberPlan.deleteMany({ where: { memberId: { in: memberIds } } });
      await tx.workoutPlan.deleteMany({ where: { gymId } });
      await tx.dietPlan.deleteMany({ where: { gymId } });
      await tx.fingerprintTemplate.deleteMany({ where: { gymId } });
      await tx.attendance.deleteMany({ where: { gymId } });
      await tx.membership.deleteMany({ where: { id: { in: membershipIds } } });
      await tx.user.deleteMany({ where: { gymId } });
      await tx.member.updateMany({ where: { gymId }, data: { referredById: null, trainerId: null } });
      await tx.member.deleteMany({ where: { gymId } });
      await tx.membershipPlan.deleteMany({ where: { gymId } });
      await tx.trainer.deleteMany({ where: { gymId } });
      await tx.auditLog.deleteMany({ where: { gymId } });
      await tx.subscriptionInvoice.deleteMany({ where: { gymId } });
      await tx.gymSubscription.deleteMany({ where: { gymId } });
      await tx.gym.delete({ where: { id: gymId } });
    }, { timeout: 120_000 });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
