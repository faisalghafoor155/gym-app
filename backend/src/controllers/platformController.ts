import type { Request, Response } from 'express';
import prisma from '../db.js';
import type { AuthedRequest } from '../types.js';
import { PLAN_LABELS } from '../services/subscription.js';
import { PENDING_APPROVAL_REASON } from './authController.js';
import { escapeHtml } from '../services/mail.js';
import { verifyGymApprovalToken } from '../services/gymApproval.js';
import {
  addDays, billingCycle, describePackage, issueInvoiceIfDue, settleInvoice, termFor,
  type BillingCycle,
} from '../services/billing.js';
import type { GymPlan } from '@prisma/client';

/**
 * The operator's view of every gym on the platform: who signed up, whether
 * they are being let in, how many people use them, and where their own
 * subscription to us stands.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_WINDOW_DAYS = 7;
const EXPIRING_SOON_DAYS = 7;

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

/**
 * Sets the deal a gym is billed on: the tier, monthly or yearly, and the price
 * agreed with them — which need not be the list price.
 *
 * The price is stored on the gym's subscription and every renewal invoice is
 * cut from it, so a deal stays fixed term after term until the operator
 * changes it here. An invoice already waiting for payment was cut on the old
 * terms and is re-priced to the new ones; a paid term is left alone and the new
 * terms start with the next one.
 *
 * `paymentReceived` is for money that arrived outside the app — cash, a bank
 * transfer: it settles the open invoice, which activates the tier and runs the
 * term for one period from where it starts.
 */
export const setGymPackage = async (
  req: AuthedRequest<{ id: string }, unknown, {
    plan: Exclude<GymPlan, 'free'>; cycle: BillingCycle; amount: number; paymentReceived?: boolean;
  }>,
  res: Response,
): Promise<void> => {
  const { plan, cycle, amount, paymentReceived } = req.body;
  try {
    const gym = await prisma.gym.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!gym) {
      res.status(404).json({ error: 'Gym not found' });
      return;
    }

    const { periodDays } = termFor(plan, cycle);
    const sub = await prisma.gymSubscription.upsert({
      where: { gymId: gym.id },
      create: { gymId: gym.id, plan, amount, periodDays },
      update: { plan, amount, periodDays, active: true },
    });

    const now = new Date();
    const open = await prisma.subscriptionInvoice.findFirst({
      where: { subscriptionId: sub.id, status: 'open' },
    });
    if (open) {
      await prisma.subscriptionInvoice.update({
        where: { id: open.id },
        data: { plan, amount, periodEnd: addDays(open.periodStart, periodDays) },
      });
    } else {
      await issueInvoiceIfDue(sub.id, now);
    }

    if (paymentReceived) {
      const due = await prisma.subscriptionInvoice.findFirst({
        where: { subscriptionId: sub.id, status: 'open' },
      });
      if (!due) {
        res.status(409).json({ error: 'Nothing is due yet — the current term is already paid' });
        return;
      }
      await settleInvoice(due.id, { note: 'Payment received, marked paid by the platform operator' });
    }

    res.json({ package: describePackage(sub) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update the package' });
  }
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

/**
 * The page behind the "Approve" button in the operator's new-gym email.
 *
 * Plain server-rendered HTML rather than a route in the app, so it works on a
 * phone that has never signed in. The GET only shows what is about to happen;
 * the approval itself is a POST from the button on that page. Mail scanners
 * open every link in a message to check it, and if a GET approved, a gym
 * would be let in before anyone had read who it was.
 */
const approvalPage = (res: Response, status: number, heading: string, body: string): void => {
  res
    .status(status)
    .type('html')
    .send(
      `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<meta name="robots" content="noindex">` +
      `<title>${escapeHtml(heading)}</title></head>` +
      `<body style="margin:0;background:#f3f4f6;font-family:system-ui,-apple-system,Segoe UI,sans-serif">` +
      `<main style="max-width:420px;margin:48px auto;padding:24px;background:#fff;border-radius:16px;` +
      `box-shadow:0 1px 3px rgba(0,0,0,.1)">` +
      `<h1 style="margin:0 0 12px;font-size:20px;color:#111827">${escapeHtml(heading)}</h1>` +
      `${body}</main></body></html>`,
    );
};

const para = (text: string): string =>
  `<p style="color:#374151;line-height:1.5;margin:0 0 12px">${text}</p>`;

/** Resolves the link's token to its gym, or answers with a page saying why not. */
const gymForApprovalLink = async (token: string, res: Response) => {
  const gymId = verifyGymApprovalToken(token);
  if (!gymId) {
    approvalPage(res, 410, 'This link no longer works',
      para('It has expired or is not valid. Approve the gym from the Platform page in the app instead.'));
    return null;
  }
  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { id: true, name: true, ownerName: true, suspendedReason: true, suspendedAt: true },
  });
  if (!gym) {
    approvalPage(res, 404, 'Gym not found', para('This gym has been deleted.'));
    return null;
  }
  if (!gym.suspendedAt) {
    approvalPage(res, 200, 'Already approved',
      para(`<strong>${escapeHtml(gym.name)}</strong> can already use the app. Nothing more to do.`));
    return null;
  }
  // A suspension the operator chose is lifted from the Platform page, where its
  // reason is in view — never by an old signup link.
  if (gym.suspendedReason !== PENDING_APPROVAL_REASON) {
    approvalPage(res, 409, 'Not waiting for approval',
      para(`<strong>${escapeHtml(gym.name)}</strong> has been suspended. Resume it from the Platform page if you mean to.`));
    return null;
  }
  return gym;
};

export const approvalLinkPage = async (
  req: Request<{ token: string }>,
  res: Response,
): Promise<void> => {
  try {
    const gym = await gymForApprovalLink(req.params.token, res);
    if (!gym) return;
    // The package they picked is what the operator is really saying yes to.
    const sub = await prisma.gymSubscription.findUnique({ where: { gymId: gym.id } });
    approvalPage(res, 200, `Approve ${gym.name}?`,
      para(`<strong>${escapeHtml(gym.ownerName)}</strong> signed up <strong>${escapeHtml(gym.name)}</strong>. ` +
        `Approving lets them sign in and use the whole app.`) +
      para(`Package: <strong>${escapeHtml(describePackage(sub))}</strong>`) +
      `<form method="post" style="margin:20px 0 0">` +
      `<button type="submit" style="width:100%;background:#16a34a;color:#fff;border:0;padding:14px;` +
      `border-radius:10px;font-size:16px;font-weight:600;cursor:pointer">` +
      `Approve ${escapeHtml(gym.ownerName)}'s gym</button></form>`);
  } catch (err) {
    console.error(err);
    approvalPage(res, 500, 'Something went wrong', para('Please try again, or approve from the Platform page.'));
  }
};

export const approvalLinkConfirm = async (
  req: Request<{ token: string }>,
  res: Response,
): Promise<void> => {
  try {
    const gym = await gymForApprovalLink(req.params.token, res);
    if (!gym) return;
    await prisma.gym.update({
      where: { id: gym.id },
      data: { suspendedAt: null, suspendedReason: null },
    });
    approvalPage(res, 200, 'Approved',
      para(`<strong>${escapeHtml(gym.name)}</strong> is approved. ${escapeHtml(gym.ownerName)} can sign in now.`));
  } catch (err) {
    console.error(err);
    approvalPage(res, 500, 'Something went wrong', para('Please try again, or approve from the Platform page.'));
  }
};
