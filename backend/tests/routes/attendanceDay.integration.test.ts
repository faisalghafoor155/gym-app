import { beforeEach, describe, expect, it } from 'vitest';

import prisma from '../../src/db.js';
import { gymDay, gymDayBounds } from '../../src/services/dates.js';
import { addMember, makeGym, resetDb } from '../helpers.js';

beforeEach(resetDb);

/**
 * A check-in's day is Pakistan's day, in the database and in the app alike.
 * When they disagreed, a member checked in in the evening and again after
 * midnight hit the one-per-day key on the UTC date and the desk got a 500.
 */
describe('the day a check-in falls on', () => {
  it('is counted in Pakistan time by the database', async () => {
    const owner = await makeGym();
    const member = await addMember(owner.gymId);

    // 18:00 on the 1st and 01:30 on the 2nd, Pakistan time: one UTC date.
    await prisma.attendance.create({
      data: { gymId: owner.gymId, memberId: member.id, checkedInAt: new Date('2026-01-01T13:00:00Z') },
    });
    await prisma.attendance.create({
      data: { gymId: owner.gymId, memberId: member.id, checkedInAt: new Date('2026-01-01T20:30:00Z') },
    });

    const days = (await prisma.attendance.findMany({
      where: { memberId: member.id },
      orderBy: { checkedInAt: 'asc' },
    })).map(a => a.checkedInOn.toISOString().slice(0, 10));
    expect(days).toEqual(['2026-01-01', '2026-01-02']);
  });

  it('matches the bounds the app looks for today in', () => {
    const lateNight = new Date('2026-01-01T20:30:00Z');
    expect(gymDay(lateNight).toISOString()).toBe('2026-01-02T00:00:00.000Z');

    const { start, end } = gymDayBounds(lateNight);
    expect(start.toISOString()).toBe('2026-01-01T19:00:00.000Z');
    expect(end.toISOString()).toBe('2026-01-02T18:59:59.999Z');
  });
});
