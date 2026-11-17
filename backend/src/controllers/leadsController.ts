import type { Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../db.js';
import { audit, diff } from '../services/audit.js';
import { gymDay } from '../services/dates.js';
import type { AuthedRequest } from '../types.js';
import type {
  ConvertLeadBody, CreateLeadBody, IdParam, LeadQuery, UpdateLeadBody,
} from '../schemas.js';

/**
 * Enquiries: people who asked about the gym and have not joined yet.
 *
 * The point is the follow-up date. A walk-in who said "I'll think about it" is
 * a member the gym loses by default; one with a date against their name is a
 * phone call somebody makes. Converting a lead links it to the member it
 * became, which is what lets the page say which sources actually bring people
 * in rather than only which bring enquiries.
 */

const include = {
  member: { select: { id: true, name: true, memberNo: true } },
  createdBy: { select: { id: true, name: true } },
} as const;

/** Follow-ups that are today or already late — the list to ring through. */
const dueWhere = (): Prisma.LeadWhereInput => ({
  status: { in: ['new', 'contacted', 'trial'] },
  followUpOn: { lte: gymDay(new Date()) },
});

export const getAll = async (
  req: AuthedRequest<Record<string, string>, unknown, unknown, LeadQuery>,
  res: Response,
): Promise<void> => {
  const { status, source, search, due, page, limit } = req.query;
  try {
    const where: Prisma.LeadWhereInput = {
      gymId: req.gymId,
      ...(status && { status }),
      ...(source && { source }),
      ...(due && dueWhere()),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search } },
          { interest: { contains: search, mode: 'insensitive' as const } },
          { notes: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [leads, total, byStatus, bySource, dueCount] = await Promise.all([
      prisma.lead.findMany({
        where,
        include,
        // Soonest follow-up first, so the top of the list is who to call now;
        // leads with no date sink below them, newest first.
        orderBy: [{ followUpOn: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.lead.count({ where }),
      // Counts over the whole gym, not the filtered view, so the tabs keep
      // their numbers while one of them is selected.
      prisma.lead.groupBy({ by: ['status'], where: { gymId: req.gymId }, _count: true }),
      prisma.lead.groupBy({ by: ['source', 'status'], where: { gymId: req.gymId }, _count: true }),
      prisma.lead.count({ where: { gymId: req.gymId, ...dueWhere() } }),
    ]);

    const counts = Object.fromEntries(byStatus.map((s) => [s.status, s._count]));
    const sources = new Map<string, { source: string; total: number; joined: number }>();
    for (const row of bySource) {
      const entry = sources.get(row.source) ?? { source: row.source, total: 0, joined: 0 };
      entry.total += row._count;
      if (row.status === 'joined') entry.joined += row._count;
      sources.set(row.source, entry);
    }

    res.json({
      data: leads,
      total,
      page,
      limit,
      hasMore: page * limit < total,
      counts: {
        all: byStatus.reduce((n, s) => n + s._count, 0),
        new: counts.new ?? 0,
        contacted: counts.contacted ?? 0,
        trial: counts.trial ?? 0,
        joined: counts.joined ?? 0,
        lost: counts.lost ?? 0,
        due: dueCount,
      },
      bySource: [...sources.values()].sort((a, b) => b.total - a.total),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const create = async (
  req: AuthedRequest<Record<string, string>, unknown, CreateLeadBody>,
  res: Response,
): Promise<void> => {
  const { name, phone, source, interest, notes, status, followUpOn, lostReason } = req.body;
  try {
    const lead = await prisma.lead.create({
      data: {
        gymId: req.gymId,
        name,
        phone,
        source,
        interest,
        notes,
        status,
        followUpOn: status === 'lost' ? null : followUpOn,
        lostReason: status === 'lost' ? lostReason : null,
        createdById: req.userId,
      },
      include,
    });

    await audit(req, {
      action: 'lead.create',
      entity: 'lead',
      entityId: lead.id,
      entityLabel: name,
      after: { name, phone, source, status },
    });

    res.status(201).json(lead);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const update = async (
  req: AuthedRequest<IdParam, unknown, UpdateLeadBody>,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const { name, phone, source, interest, notes, status, followUpOn, lostReason } = req.body;
  try {
    const existing = await prisma.lead.findFirst({ where: { id, gymId: req.gymId } });
    if (!existing) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }
    // A joined lead is history: it points at a member now, and moving it back
    // to "new" would leave that link claiming a conversion the status denies.
    if (existing.status === 'joined' && status !== undefined) {
      res.status(409).json({ error: 'This lead has already joined' });
      return;
    }

    // Giving up on somebody ends the chase, so the date goes with it.
    const lost = status === 'lost';
    const updated = await prisma.lead.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(source !== undefined && { source }),
        ...(interest !== undefined && { interest }),
        ...(notes !== undefined && { notes }),
        ...(status !== undefined && { status }),
        ...(lost ? { followUpOn: null } : followUpOn !== undefined && { followUpOn }),
        ...(lostReason !== undefined && { lostReason }),
        ...(status !== undefined && !lost && { lostReason: null }),
      },
      include,
    });

    const changed = diff(existing, updated, ['name', 'phone', 'source', 'status', 'followUpOn', 'lostReason']);
    if (changed) {
      await audit(req, {
        action: 'lead.update',
        entity: 'lead',
        entityId: id,
        entityLabel: updated.name,
        before: changed.before,
        after: changed.after,
      });
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Marks a lead as joined, against the member it became.
 *
 * The member is registered through the normal form first — plan, fee, promo
 * code and all — and only then linked here, so converting never becomes a
 * second, thinner way to create a member.
 */
export const convert = async (
  req: AuthedRequest<IdParam, unknown, ConvertLeadBody>,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const { memberId } = req.body;
  try {
    const [lead, member] = await Promise.all([
      prisma.lead.findFirst({ where: { id, gymId: req.gymId } }),
      prisma.member.findFirst({ where: { id: memberId, gymId: req.gymId }, select: { id: true, name: true, lead: { select: { id: true } } } }),
    ]);
    if (!lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }
    if (!member) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }
    if (lead.status === 'joined') {
      res.status(409).json({ error: 'This lead has already joined' });
      return;
    }
    if (member.lead) {
      res.status(409).json({ error: 'That member is already linked to another lead' });
      return;
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: { status: 'joined', memberId, followUpOn: null, lostReason: null },
      include,
    });

    await audit(req, {
      action: 'lead.convert',
      entity: 'lead',
      entityId: id,
      entityLabel: lead.name,
      before: { status: lead.status },
      after: { status: 'joined', memberId, member: member.name },
    });

    res.json(updated);
  } catch (err) {
    // Two desks converting into the same member at once: the unique index on
    // memberId lets only one through.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: 'That member is already linked to another lead' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const remove = async (
  req: AuthedRequest<IdParam>,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  try {
    const existing = await prisma.lead.findFirst({ where: { id, gymId: req.gymId } });
    if (!existing) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    await prisma.lead.delete({ where: { id } });

    await audit(req, {
      action: 'lead.delete',
      entity: 'lead',
      entityId: id,
      entityLabel: existing.name,
      before: {
        name: existing.name,
        phone: existing.phone,
        source: existing.source,
        status: existing.status,
        notes: existing.notes,
      },
    });

    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
