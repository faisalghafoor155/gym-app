import type { Response } from 'express';
import { branchForNew, inBranch, pinned } from '../services/branches.js';
import { Prisma } from '@prisma/client';
import prisma from '../db.js';
import { audit } from '../services/audit.js';
import { gymDay, gymDayBounds } from '../services/dates.js';
import { sum, withMoney } from '../services/money.js';
import type { AuthedRequest } from '../types.js';
import type { CreateDayPassBody, DayPassQuery, IdParam } from '../schemas.js';

/**
 * One day's entry for somebody who is not a member: a traveller, a friend
 * trying the gym, a member's guest.
 *
 * Kept apart from payments because a payment needs a member and a walk-in has
 * none. The revenue reports add these in as their own type, so the money is
 * counted even though it never touches the payments table.
 */

const include = {
  hostMember: { select: { id: true, name: true, memberNo: true } },
  recordedBy: { select: { id: true, name: true } },
} as const;

/** The first instant of the gym's current calendar month. */
const startOfGymMonth = (now: Date): Date => {
  const today = gymDay(now);
  return gymDayBounds(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))).start;
};

export const getAll = async (
  req: AuthedRequest<Record<string, string>, unknown, unknown, DayPassQuery>,
  res: Response,
): Promise<void> => {
  const { from, to, search } = req.query;
  try {
    // Date-only filters name days in the gym's calendar; with none, today.
    const start = gymDayBounds(from ?? to ?? new Date()).start;
    const end = gymDayBounds(to ?? from ?? new Date()).end;

    const where: Prisma.DayPassWhereInput = {
      gymId: req.gymId,
      ...inBranch(req),
      visitedAt: { gte: start, lte: end },
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search } },
        ],
      }),
    };

    const passes = await prisma.dayPass.findMany({
      where,
      include,
      orderBy: { visitedAt: 'desc' },
      // A day's walk-ins, or a month's at most — far below what needs paging.
      take: 500,
    });

    res.json({
      from: start,
      to: end,
      data: passes.map((p) => withMoney(p, 'amount')),
      totals: {
        count: passes.length,
        amount: sum(passes.map((p) => p.amount)),
        guests: passes.filter((p) => p.hostMemberId).length,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const create = async (
  req: AuthedRequest<Record<string, string>, unknown, CreateDayPassBody>,
  res: Response,
): Promise<void> => {
  const { name, phone, amount, method, channel, reference, hostMemberId, notes } = req.body;
  try {
    let host: { id: string; name: string; memberNo: string } | null = null;
    if (hostMemberId) {
      host = await prisma.member.findFirst({
        where: { id: hostMemberId, gymId: req.gymId },
        select: { id: true, name: true, memberNo: true },
      });
      if (!host) {
        res.status(404).json({ error: 'Member not found' });
        return;
      }

      // The gym's monthly cap on guests per member, if it has one. Counted,
      // not locked: two desks letting the same member's guests in at the same
      // second is not a case worth a transaction for.
      const { guestPassesPerMonth } = await prisma.gym.findUniqueOrThrow({
        where: { id: req.gymId },
        select: { guestPassesPerMonth: true },
      });
      if (guestPassesPerMonth > 0) {
        const used = await prisma.dayPass.count({
          where: { hostMemberId: host.id, visitedAt: { gte: startOfGymMonth(new Date()) } },
        });
        if (used >= guestPassesPerMonth) {
          res.status(409).json({
            error: `${host.name} has already brought ${used} guest${used === 1 ? '' : 's'} this month (limit ${guestPassesPerMonth})`,
          });
          return;
        }
      }
    }

    const pass = await prisma.dayPass.create({
      data: {
        gymId: req.gymId,
        name,
        phone,
        amount,
        method,
        channel: method === 'online' ? channel : null,
        reference: method === 'online' ? reference : null,
        hostMemberId: host?.id ?? null,
        notes,
        recordedById: req.userId,
        branchId: await branchForNew(req),
      },
      include,
    });

    await audit(req, {
      action: 'dayPass.create',
      entity: 'dayPass',
      entityId: pass.id,
      entityLabel: host ? `${name} (guest of ${host.name})` : name,
      after: { name, phone, amount, method, hostMemberId: host?.id ?? null },
    });

    res.status(201).json(withMoney(pass, 'amount'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/** For a pass entered by mistake. The audit log keeps what it was. */
export const remove = async (
  req: AuthedRequest<IdParam>,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  try {
    const existing = await prisma.dayPass.findFirst({ where: { id, gymId: req.gymId, ...inBranch(pinned(req)) } });
    if (!existing) {
      res.status(404).json({ error: 'Day pass not found' });
      return;
    }

    await prisma.dayPass.delete({ where: { id } });

    await audit(req, {
      action: 'dayPass.delete',
      entity: 'dayPass',
      entityId: id,
      entityLabel: existing.name,
      before: {
        name: existing.name,
        phone: existing.phone,
        amount: existing.amount,
        method: existing.method,
        visitedAt: existing.visitedAt,
        hostMemberId: existing.hostMemberId,
      },
    });

    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
