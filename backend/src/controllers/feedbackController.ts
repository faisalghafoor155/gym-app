import type { Response } from 'express';
import prisma from '../db.js';
import { audit } from '../services/audit.js';
import { gymDay, gymDayBounds } from '../services/dates.js';
import type { AuthedRequest } from '../types.js';
import type { CreateFeedbackBody, FeedbackQuery, IdParam, UpdateFeedbackBody } from '../schemas.js';

/**
 * Member feedback: a star rating with a comment, or a complaint the gym has to
 * act on.
 *
 * Three stars or below, or anything with a comment, opens as something to
 * read and deal with; four or five stars alone are thanks and arrive resolved. Anonymous
 * feedback stores no member at all.
 */

const include = {
  member: { select: { id: true, name: true, memberNo: true, phone: true } },
  resolvedBy: { select: { id: true, name: true } },
} as const;

/** The first instant of the gym's month, `back` months before this one. */
const monthStart = (back: number, now = new Date()): Date => {
  const today = gymDay(now);
  return gymDayBounds(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - back, 1))).start;
};

/** Average stars, the share that were happy (4–5), and how many, for a window. */
const scoreFor = async (gymId: string, from: Date, to?: Date) => {
  const where = { gymId, createdAt: { gte: from, ...(to && { lt: to }) } };
  const [agg, happy] = await Promise.all([
    prisma.feedback.aggregate({ where, _avg: { rating: true }, _count: true }),
    prisma.feedback.count({ where: { ...where, rating: { gte: 4 } } }),
  ]);
  const count = agg._count;
  return {
    count,
    average: agg._avg.rating === null ? null : Math.round(agg._avg.rating * 10) / 10,
    happyPct: count ? Math.round((happy / count) * 100) : null,
  };
};

// --- the gym's side ---------------------------------------------------------------

export const list = async (
  req: AuthedRequest<Record<string, string>, unknown, unknown, FeedbackQuery>,
  res: Response,
): Promise<void> => {
  try {
    const rows = await prisma.feedback.findMany({
      where: { gymId: req.gymId, ...(req.query.status !== 'all' && { status: req.query.status }) },
      include,
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * This month's satisfaction score against last month's, and what is still
 * open. For the dashboard card and the top of the inbox.
 */
export const summary = async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    const thisMonth = monthStart(0);
    const [current, previous, open, byCategory] = await Promise.all([
      scoreFor(req.gymId, thisMonth),
      scoreFor(req.gymId, monthStart(1), thisMonth),
      prisma.feedback.count({ where: { gymId: req.gymId, status: 'open' } }),
      prisma.feedback.groupBy({
        by: ['category'],
        where: { gymId: req.gymId, createdAt: { gte: thisMonth } },
        _avg: { rating: true },
        _count: true,
        orderBy: { _count: { category: 'desc' } },
      }),
    ]);
    res.json({
      thisMonth: current,
      lastMonth: previous,
      open,
      byCategory: byCategory.map((c) => ({
        category: c.category,
        count: c._count,
        average: c._avg.rating === null ? null : Math.round(c._avg.rating * 10) / 10,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/** Replies, resolves, or reopens. A reply is what the member reads back. */
export const update = async (
  req: AuthedRequest<IdParam, unknown, UpdateFeedbackBody>,
  res: Response,
): Promise<void> => {
  const { status, response } = req.body;
  try {
    const existing = await prisma.feedback.findFirst({ where: { id: req.params.id, gymId: req.gymId } });
    if (!existing) {
      res.status(404).json({ error: 'Feedback not found' });
      return;
    }
    const resolving = status === 'resolved' && existing.status !== 'resolved';
    const reopening = status === 'open' && existing.status !== 'open';
    const row = await prisma.feedback.update({
      where: { id: existing.id },
      data: {
        ...(status !== undefined && { status }),
        ...(response !== undefined && { response }),
        ...(resolving && { resolvedAt: new Date(), resolvedById: req.userId }),
        ...(reopening && { resolvedAt: null, resolvedById: null }),
      },
      include,
    });
    await audit(req, {
      action: resolving ? 'feedback.resolve' : reopening ? 'feedback.reopen' : 'feedback.reply',
      entity: 'feedback',
      entityId: row.id,
      entityLabel: `${row.member?.name ?? 'Anonymous'} · ${row.rating}★ ${row.category}`,
      before: { status: existing.status, response: existing.response },
      after: { status: row.status, response: row.response },
    });
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// --- the member's side -------------------------------------------------------------

const memberIdOf = async (userId: string): Promise<string | null> =>
  (await prisma.user.findUnique({ where: { id: userId }, select: { memberId: true } }))?.memberId ?? null;

export const createMine = async (
  req: AuthedRequest<Record<string, string>, unknown, CreateFeedbackBody>,
  res: Response,
): Promise<void> => {
  const { rating, category, message, anonymous } = req.body;
  try {
    const memberId = await memberIdOf(req.userId);
    if (!memberId) {
      res.status(403).json({ error: 'Only a member account can send feedback' });
      return;
    }
    // Stars alone at four or five are thanks, resolved from the start.
    // Anything lukewarm or worse, or anything with words, waits for someone
    // at the gym to read it.
    const needsAction = rating <= 3 || !!message;
    const row = await prisma.feedback.create({
      data: {
        gymId: req.gymId,
        memberId: anonymous ? null : memberId,
        rating,
        category,
        message,
        status: needsAction ? 'open' : 'resolved',
        ...(!needsAction && { resolvedAt: new Date() }),
      },
    });
    res.status(201).json({ id: row.id, status: row.status, anonymous });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/** What the member sent under their name, with the gym's replies. */
export const listMine = async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    const memberId = await memberIdOf(req.userId);
    if (!memberId) {
      res.json([]);
      return;
    }
    const rows = await prisma.feedback.findMany({
      where: { gymId: req.gymId, memberId },
      select: { id: true, rating: true, category: true, message: true, status: true, response: true, createdAt: true, resolvedAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
