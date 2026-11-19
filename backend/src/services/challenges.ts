import prisma from '../db.js';
import { gymDay } from './dates.js';

/**
 * Challenge scores, worked out from what the gym already records.
 *
 * Nothing is stored as progress: visits and streaks come from attendance, and
 * weight lost from measurements. A check-in recorded late or a weigh-in
 * corrected afterwards counts the next time the leaderboard is read, with
 * nothing to keep in sync.
 */

export type ChallengeKind = 'visits' | 'streak' | 'weight_loss';
export type ChallengeStatus = 'upcoming' | 'running' | 'ended';

const DAY_MS = 86_400_000;

export interface ChallengeWindow {
  kind: string;
  target: number | null;
  startsOn: Date;
  endsOn: Date;
}

export interface Standing {
  memberId: string;
  joinedAt: Date;
  /** Visits, best run of days in a row, or percent of weight lost. Null when
   *  there is nothing to score yet: a weight challenge with no second weigh-in. */
  score: number | null;
  /** 1 for the leader. Equal scores share a place. Null when unscored. */
  rank: number | null;
  /** Reached the target, when the challenge has one. */
  completed: boolean;
}

/** Whether a challenge is still to come, under way, or over, in the gym's calendar. */
export const challengeStatus = (c: { startsOn: Date; endsOn: Date }, now = new Date()): ChallengeStatus => {
  const today = gymDay(now);
  if (today < c.startsOn) return 'upcoming';
  return today > c.endsOn ? 'ended' : 'running';
};

/** "1st", "2nd", "3rd", "4th" — how a place is written in a message. */
export const ordinal = (n: number): string => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
};

/** The longest run of consecutive days in a sorted list of days. */
const longestRun = (days: Date[]): number => {
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of days) {
    const t = d.getTime();
    run = prev !== null && t - prev === DAY_MS ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
};

/** Visits, or the best streak, for each member over the days counted so far. */
const attendanceScores = async (kind: 'visits' | 'streak', memberIds: string[], from: Date, to: Date) => {
  const rows = await prisma.attendance.findMany({
    where: { memberId: { in: memberIds }, checkedInOn: { gte: from, lte: to } },
    select: { memberId: true, checkedInOn: true },
    orderBy: { checkedInOn: 'asc' },
  });
  const days = new Map<string, Date[]>();
  for (const r of rows) {
    const list = days.get(r.memberId) ?? [];
    list.push(r.checkedInOn);
    days.set(r.memberId, list);
  }
  return new Map(memberIds.map(id => {
    const list = days.get(id) ?? [];
    return [id, kind === 'visits' ? list.length : longestRun(list)];
  }));
};

/**
 * Percent of body weight lost, from the starting weight to the latest one in
 * the challenge.
 *
 * The starting weight is the last weigh-in on or before the first day, so a
 * member weighed the week before still counts; failing that, their first
 * weigh-in inside the challenge. Without a later weigh-in there is nothing to
 * compare, and the score stays empty rather than reading as zero.
 */
const weightScores = async (memberIds: string[], from: Date, to: Date) => {
  const rows = await prisma.memberMeasurement.findMany({
    where: { memberId: { in: memberIds }, weightKg: { not: null }, measuredOn: { lt: new Date(to.getTime() + 2 * DAY_MS) } },
    select: { memberId: true, measuredOn: true, weightKg: true },
    orderBy: [{ measuredOn: 'asc' }, { createdAt: 'asc' }],
  });
  const byMember = new Map<string, { day: Date; kg: number }[]>();
  for (const r of rows) {
    const day = gymDay(r.measuredOn);
    if (day > to) continue;
    const list = byMember.get(r.memberId) ?? [];
    list.push({ day, kg: Number(r.weightKg) });
    byMember.set(r.memberId, list);
  }
  return new Map(memberIds.map(id => {
    const list = byMember.get(id) ?? [];
    const before = list.filter(w => w.day <= from);
    const during = list.filter(w => w.day > from);
    const start = before.at(-1) ?? during[0];
    const latest = during.at(-1);
    if (!start || !latest || latest === start || start.kg <= 0) return [id, null];
    return [id, Math.round(((start.kg - latest.kg) / start.kg) * 1000) / 10];
  }));
};

/**
 * Everyone in the challenge, best first.
 *
 * Equal scores share a place (1, 1, 3), and the earlier joiner is listed first
 * among them. Before the challenge starts nobody has a score.
 */
export const standings = async (
  challenge: ChallengeWindow,
  participants: { memberId: string; joinedAt: Date }[],
  now = new Date(),
): Promise<Standing[]> => {
  const today = gymDay(now);
  const to = today < challenge.endsOn ? today : challenge.endsOn;
  const ids = participants.map(p => p.memberId);

  let scores = new Map<string, number | null>();
  if (ids.length && today >= challenge.startsOn) {
    scores = challenge.kind === 'weight_loss'
      ? await weightScores(ids, challenge.startsOn, to)
      : await attendanceScores(challenge.kind === 'streak' ? 'streak' : 'visits', ids, challenge.startsOn, to);
  }

  const rows = participants
    .map(p => ({ memberId: p.memberId, joinedAt: p.joinedAt, score: scores.get(p.memberId) ?? null }))
    .sort((a, b) =>
      (b.score ?? -Infinity) - (a.score ?? -Infinity) || a.joinedAt.getTime() - b.joinedAt.getTime());

  let place = 0;
  return rows.map((r, i) => {
    if (r.score !== null && (i === 0 || rows[i - 1]!.score !== r.score)) place = i + 1;
    return {
      ...r,
      rank: r.score === null ? null : place,
      completed: challenge.target != null && r.score !== null && r.score >= challenge.target,
    };
  });
};
