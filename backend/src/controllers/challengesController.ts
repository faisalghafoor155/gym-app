import type { Response } from 'express';
import prisma from '../db.js';
import { audit } from '../services/audit.js';
import { challengeStatus, ordinal, standings } from '../services/challenges.js';
import { gymDay } from '../services/dates.js';
import { notifyChallengeWinner } from '../services/memberNotifications.js';
import type { AuthedRequest } from '../types.js';
import type {
  AddParticipantBody, CreateChallengeBody, IdParam, ParticipantParams, UpdateChallengeBody,
} from '../schemas.js';

/**
 * Challenges: most visits, longest streak, or most weight lost between two
 * dates. Members join from the portal or the desk signs them up; scores are
 * worked out from attendance and measurements (see services/challenges.ts).
 */

/** How many places are congratulated when the winners are announced. */
const WINNERS = 3;

const memberSelect = { id: true, name: true, memberNo: true, phone: true } as const;

const findChallenge = (gymId: string, id: string) =>
  prisma.challenge.findFirst({
    where: { id, gymId },
    include: {
      participants: { include: { member: { select: memberSelect } }, orderBy: { joinedAt: 'asc' } },
      createdBy: { select: { id: true, name: true } },
    },
  });

type LoadedChallenge = NonNullable<Awaited<ReturnType<typeof findChallenge>>>;

/** A challenge with its leaderboard, as the gym's screen shows it. */
const withStandings = async (c: LoadedChallenge) => {
  const { participants, ...rest } = c;
  const members = new Map(participants.map(p => [p.memberId, p.member]));
  const board = await standings(c, participants);
  return {
    ...rest,
    status: challengeStatus(c),
    standings: board.map(s => ({ ...s, member: members.get(s.memberId)! })),
  };
};

const label = (c: { name: string; kind: string }) => `${c.name} (${c.kind})`;

// --- the gym's side ---------------------------------------------------------------

/** Every challenge, newest first, with how many have joined and who leads. */
export const list = async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    const rows = await prisma.challenge.findMany({
      where: { gymId: req.gymId },
      include: {
        participants: { select: { memberId: true, joinedAt: true, member: { select: { id: true, name: true } } } },
      },
      orderBy: [{ endsOn: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
    const out = await Promise.all(rows.map(async ({ participants, ...c }) => {
      const status = challengeStatus(c);
      const top = status === 'upcoming' || !participants.length ? null
        : (await standings(c, participants)).find(s => s.rank === 1) ?? null;
      const leader = top && participants.find(p => p.memberId === top.memberId)!.member;
      return {
        ...c,
        status,
        participantCount: participants.length,
        leader: leader && top ? { ...leader, score: top.score } : null,
      };
    }));
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const getOne = async (req: AuthedRequest<IdParam>, res: Response): Promise<void> => {
  try {
    const c = await findChallenge(req.gymId, req.params.id);
    if (!c) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }
    res.json(await withStandings(c));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const create = async (
  req: AuthedRequest<Record<string, string>, unknown, CreateChallengeBody>,
  res: Response,
): Promise<void> => {
  const { name, description, kind, target, startsOn, endsOn, prize } = req.body;
  try {
    // One that would already be over is a typo, not a challenge.
    if (endsOn < gymDay(new Date())) {
      res.status(400).json({ error: 'That challenge would already be over. Check the end date.' });
      return;
    }
    const row = await prisma.challenge.create({
      data: {
        gymId: req.gymId, name, description, kind, target: target ?? null, startsOn, endsOn, prize,
        createdById: req.userId,
      },
    });
    await audit(req, {
      action: 'challenge.create',
      entity: 'challenge',
      entityId: row.id,
      entityLabel: label(row),
      after: { name, kind, target, startsOn, endsOn, prize },
    });
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const update = async (
  req: AuthedRequest<IdParam, unknown, UpdateChallengeBody>,
  res: Response,
): Promise<void> => {
  const { name, description, target, startsOn, endsOn, prize } = req.body;
  try {
    const existing = await prisma.challenge.findFirst({ where: { id: req.params.id, gymId: req.gymId } });
    if (!existing) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }
    if (existing.announcedAt) {
      res.status(400).json({ error: 'The winners have been announced, so this challenge can no longer change' });
      return;
    }
    const from = startsOn ?? existing.startsOn;
    const to = endsOn ?? existing.endsOn;
    if (to < from) {
      res.status(400).json({ error: 'The end date must be on or after the start date' });
      return;
    }
    if (existing.kind === 'weight_loss' && target != null && target > 30) {
      res.status(400).json({ error: 'A weight loss target is a percent, 30 at most' });
      return;
    }
    const row = await prisma.challenge.update({
      where: { id: existing.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(target !== undefined && { target }),
        ...(prize !== undefined && { prize }),
        startsOn: from,
        endsOn: to,
      },
    });
    await audit(req, {
      action: 'challenge.update',
      entity: 'challenge',
      entityId: row.id,
      entityLabel: label(row),
      before: { name: existing.name, target: existing.target, startsOn: existing.startsOn, endsOn: existing.endsOn, prize: existing.prize },
      after: { name: row.name, target: row.target, startsOn: row.startsOn, endsOn: row.endsOn, prize: row.prize },
    });
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/** Deletes it and its sign-ups. Scores were never stored, so nothing else goes. */
export const remove = async (req: AuthedRequest<IdParam>, res: Response): Promise<void> => {
  try {
    const existing = await prisma.challenge.findFirst({
      where: { id: req.params.id, gymId: req.gymId },
      include: { _count: { select: { participants: true } } },
    });
    if (!existing) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }
    await prisma.challenge.delete({ where: { id: existing.id } });
    await audit(req, {
      action: 'challenge.delete',
      entity: 'challenge',
      entityId: existing.id,
      entityLabel: label(existing),
      before: { participants: existing._count.participants, startsOn: existing.startsOn, endsOn: existing.endsOn },
    });
    res.json({ message: 'Challenge deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/** The desk signs a member up — for members who never open the portal. */
export const addParticipant = async (
  req: AuthedRequest<IdParam, unknown, AddParticipantBody>,
  res: Response,
): Promise<void> => {
  try {
    const [c, member] = await Promise.all([
      prisma.challenge.findFirst({ where: { id: req.params.id, gymId: req.gymId } }),
      prisma.member.findFirst({ where: { id: req.body.memberId, gymId: req.gymId }, select: { id: true, name: true } }),
    ]);
    if (!c || !member) {
      res.status(404).json({ error: c ? 'Member not found' : 'Challenge not found' });
      return;
    }
    if (challengeStatus(c) === 'ended') {
      res.status(400).json({ error: 'This challenge has ended' });
      return;
    }
    await prisma.challengeParticipant.upsert({
      where: { challengeId_memberId: { challengeId: c.id, memberId: member.id } },
      create: { challengeId: c.id, memberId: member.id },
      update: {},
    });
    await audit(req, {
      action: 'challenge.join',
      entity: 'challenge',
      entityId: c.id,
      entityLabel: `${label(c)} ← ${member.name}`,
      after: { memberId: member.id },
    });
    res.status(201).json({ message: `${member.name} joined ${c.name}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const removeParticipant = async (req: AuthedRequest<ParticipantParams>, res: Response): Promise<void> => {
  try {
    const c = await prisma.challenge.findFirst({ where: { id: req.params.id, gymId: req.gymId } });
    if (!c) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }
    if (c.announcedAt) {
      res.status(400).json({ error: 'The winners have been announced, so the leaderboard is final' });
      return;
    }
    const { count } = await prisma.challengeParticipant.deleteMany({
      where: { challengeId: c.id, memberId: req.params.memberId },
    });
    if (!count) {
      res.status(404).json({ error: 'That member is not in this challenge' });
      return;
    }
    await audit(req, {
      action: 'challenge.leave',
      entity: 'challenge',
      entityId: c.id,
      entityLabel: label(c),
      before: { memberId: req.params.memberId },
    });
    res.json({ message: 'Removed from the challenge' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Announces the winners once the challenge is over: the top three with a real
 * score are congratulated on WhatsApp (or SMS), and the leaderboard is fixed.
 *
 * Done once. A second press would message the same people again, so it is
 * refused rather than repeated.
 */
export const announce = async (req: AuthedRequest<IdParam>, res: Response): Promise<void> => {
  try {
    const c = await findChallenge(req.gymId, req.params.id);
    if (!c) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }
    if (challengeStatus(c) !== 'ended') {
      res.status(400).json({ error: 'Winners can be announced once the challenge has ended' });
      return;
    }
    // Claimed before sending, so two presses at once cannot both send.
    const { count } = await prisma.challenge.updateMany({
      where: { id: c.id, announcedAt: null },
      data: { announcedAt: new Date() },
    });
    if (!count) {
      res.status(409).json({ error: 'The winners have already been announced' });
      return;
    }

    const board = await standings(c, c.participants);
    const winners = board.filter(s => s.rank !== null && s.rank <= WINNERS && (s.score ?? 0) > 0);
    const people = await prisma.member.findMany({
      where: { id: { in: winners.map(w => w.memberId) } },
      select: { id: true, name: true, phone: true, whatsappOptOut: true },
    });
    const results = await Promise.all(winners.map(async w => {
      const m = people.find(p => p.id === w.memberId)!;
      return { memberId: m.id, name: m.name, rank: w.rank!, score: w.score, result: await notifyChallengeWinner(req.gymId, m, ordinal(w.rank!), c.name) };
    }));

    await audit(req, {
      action: 'challenge.announce',
      entity: 'challenge',
      entityId: c.id,
      entityLabel: label(c),
      after: { winners: results.map(r => ({ name: r.name, rank: r.rank, score: r.score, message: r.result })) },
    });
    res.json({
      winners: results,
      sent: results.filter(r => r.result === 'sent').length,
      notSent: results.filter(r => r.result !== 'sent').length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// --- the member's side -------------------------------------------------------------

/** "Ali Khan" → "Ali K.": other members see who is ahead, not their full name. */
const shortName = (name: string): string => {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0]!.toUpperCase()}.` : first ?? '';
};

const memberIdOf = async (userId: string): Promise<string | null> =>
  (await prisma.user.findUnique({ where: { id: userId }, select: { memberId: true } }))?.memberId ?? null;

/** How many places the portal shows; the member's own row is added if lower. */
const BOARD_SIZE = 10;

/**
 * Challenges a member can join or is in: everything upcoming or running, and
 * those that ended in the last month so winners can be seen.
 */
export const listMine = async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    const memberId = await memberIdOf(req.userId);
    if (!memberId) {
      res.json([]);
      return;
    }
    const since = new Date(gymDay(new Date()).getTime() - 30 * 86_400_000);
    const rows = await prisma.challenge.findMany({
      where: { gymId: req.gymId, endsOn: { gte: since } },
      include: {
        participants: { include: { member: { select: { name: true } } }, orderBy: { joinedAt: 'asc' } },
      },
      orderBy: [{ startsOn: 'asc' }],
    });
    const out = await Promise.all(rows.map(async ({ participants, createdById: _c, ...c }) => {
      const names = new Map(participants.map(p => [p.memberId, p.member.name]));
      const board = await standings(c, participants);
      const mine = board.find(s => s.memberId === memberId) ?? null;
      const shown = board.slice(0, BOARD_SIZE);
      if (mine && !shown.includes(mine)) shown.push(mine);
      return {
        ...c,
        status: challengeStatus(c),
        joined: !!mine,
        participantCount: participants.length,
        me: mine && { score: mine.score, rank: mine.rank, completed: mine.completed },
        leaderboard: shown.map(s => ({
          name: s.memberId === memberId ? names.get(s.memberId)! : shortName(names.get(s.memberId)!),
          isMe: s.memberId === memberId,
          score: s.score,
          rank: s.rank,
          completed: s.completed,
        })),
      };
    }));
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/** Joins (POST) or leaves (DELETE) from the portal, while it has not ended. */
export const joinMine = async (req: AuthedRequest<IdParam>, res: Response): Promise<void> => {
  const leaving = req.method === 'DELETE';
  try {
    const memberId = await memberIdOf(req.userId);
    if (!memberId) {
      res.status(403).json({ error: 'Only a member account can join a challenge' });
      return;
    }
    const c = await prisma.challenge.findFirst({ where: { id: req.params.id, gymId: req.gymId } });
    if (!c) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }
    if (challengeStatus(c) === 'ended') {
      res.status(400).json({ error: 'This challenge has ended' });
      return;
    }
    if (leaving) {
      await prisma.challengeParticipant.deleteMany({ where: { challengeId: c.id, memberId } });
    } else {
      await prisma.challengeParticipant.upsert({
        where: { challengeId_memberId: { challengeId: c.id, memberId } },
        create: { challengeId: c.id, memberId },
        update: {},
      });
    }
    res.status(leaving ? 200 : 201).json({ joined: !leaving });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
