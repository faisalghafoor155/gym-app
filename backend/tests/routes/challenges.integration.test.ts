import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../../src/db.js';
import { gymDay } from '../../src/services/dates.js';
import * as whatsapp from '../../src/services/whatsapp.js';
import { addMember, addUser, api, makeGym, resetDb } from '../helpers.js';

/**
 * Challenges: created at the desk, joined from the portal, scored from
 * attendance and measurements, and the winners congratulated once.
 */
beforeEach(resetDb);
afterEach(() => { vi.restoreAllMocks(); });

const DAY = 86_400_000;
const today = gymDay(new Date());
/** The gym's day `n` days from today, as a yyyy-mm-dd string. */
const day = (n: number) => new Date(today.getTime() + n * DAY).toISOString().slice(0, 10);

const asMember = async (gymId: string, name: string) => {
  const member = await addMember(gymId, { name });
  const login = await addUser(gymId, { role: 'member', memberId: member.id });
  return { member, cookie: login.cookie };
};

/** A check-in at noon, Pakistan time, `n` days from today. */
const checkIn = (gymId: string, memberId: string, n: number) =>
  prisma.attendance.create({
    data: { gymId, memberId, checkedInAt: new Date(today.getTime() + n * DAY + 7 * 3_600_000) },
  });

describe('challenges', () => {
  it('ranks visits and streaks from attendance, sharing a place on a tie', async () => {
    const owner = await makeGym();
    const a = await addMember(owner.gymId, { name: 'Ali Khan' });
    const b = await addMember(owner.gymId, { name: 'Sara Ahmed' });
    const c = await addMember(owner.gymId, { name: 'Usman Tariq' });
    for (const n of [-9, -8, -7, -6, -5, -2]) await checkIn(owner.gymId, a.id, n);
    for (const n of [-9, -7, -5, -3, -1, -12]) await checkIn(owner.gymId, b.id, n); // -12 is before it began

    const made = await api().post('/api/challenges').set('Cookie', owner.cookie)
      .send({ name: 'November visits', kind: 'visits', target: 5, startsOn: day(-9), endsOn: day(20), prize: '1 month free' });
    expect(made.status).toBe(201);
    const streak = await api().post('/api/challenges').set('Cookie', owner.cookie)
      .send({ name: 'Streak', kind: 'streak', startsOn: day(-9), endsOn: day(20) });

    for (const m of [a, b, c]) {
      await api().post(`/api/challenges/${made.body.id}/participants`).set('Cookie', owner.cookie).send({ memberId: m.id });
      await api().post(`/api/challenges/${streak.body.id}/participants`).set('Cookie', owner.cookie).send({ memberId: m.id });
    }

    const visits = await api().get(`/api/challenges/${made.body.id}`).set('Cookie', owner.cookie);
    expect(visits.body.status).toBe('running');
    expect(visits.body.standings.map((s: { member: { name: string }; score: number; rank: number; completed: boolean }) =>
      [s.member.name, s.score, s.rank, s.completed])).toEqual([
      ['Ali Khan', 6, 1, true],
      ['Sara Ahmed', 5, 2, true],
      ['Usman Tariq', 0, 3, false],
    ]);

    const runs = await api().get(`/api/challenges/${streak.body.id}`).set('Cookie', owner.cookie);
    expect(runs.body.standings.map((s: { score: number; rank: number }) => [s.score, s.rank])).toEqual([[5, 1], [1, 2], [0, 3]]);

    // Two members level on visits share first place.
    await checkIn(owner.gymId, c.id, -4);
    for (const n of [-3, -1, 0, -8, -6]) await checkIn(owner.gymId, c.id, n);
    const tied = await api().get(`/api/challenges/${made.body.id}`).set('Cookie', owner.cookie);
    expect(tied.body.standings.map((s: { rank: number }) => s.rank)).toEqual([1, 1, 3]);
  });

  it('scores weight loss from the last weigh-in before the start to the latest one', async () => {
    const owner = await makeGym();
    const a = await addMember(owner.gymId);
    const b = await addMember(owner.gymId);
    const weigh = (memberId: string, n: number, kg: number) => prisma.memberMeasurement.create({
      data: { gymId: owner.gymId, memberId, measuredOn: new Date(day(n)), weightKg: kg },
    });
    await weigh(a.id, -20, 104);
    await weigh(a.id, -12, 100);
    await weigh(a.id, -3, 97);
    await weigh(a.id, -1, 95);
    await weigh(b.id, -9, 80); // only one weigh-in: nothing to compare yet

    const made = await api().post('/api/challenges').set('Cookie', owner.cookie)
      .send({ name: 'Cut', kind: 'weight_loss', target: 5, startsOn: day(-10), endsOn: day(30) });
    for (const m of [a, b]) {
      await api().post(`/api/challenges/${made.body.id}/participants`).set('Cookie', owner.cookie).send({ memberId: m.id });
    }
    const res = await api().get(`/api/challenges/${made.body.id}`).set('Cookie', owner.cookie);
    expect(res.body.standings.map((s: { score: number | null; rank: number | null; completed: boolean }) =>
      [s.score, s.rank, s.completed])).toEqual([[5, 1, true], [null, null, false]]);

    const silly = await api().post('/api/challenges').set('Cookie', owner.cookie)
      .send({ name: 'x', kind: 'weight_loss', target: 50, startsOn: day(0), endsOn: day(30) });
    expect(silly.status).toBe(400);
  });

  it('lets a member join and leave from the portal, and hides other members\' full names', async () => {
    const owner = await makeGym();
    const me = await asMember(owner.gymId, 'Hamza Ali');
    const other = await addMember(owner.gymId, { name: 'Ayesha Noor Siddiqui' });
    await checkIn(owner.gymId, other.id, -1);

    const made = await api().post('/api/challenges').set('Cookie', owner.cookie)
      .send({ name: 'Visits', kind: 'visits', startsOn: day(-5), endsOn: day(5) });
    await api().post(`/api/challenges/${made.body.id}/participants`).set('Cookie', owner.cookie).send({ memberId: other.id });

    expect((await api().post(`/api/me/challenges/${made.body.id}/join`).set('Cookie', me.cookie)).status).toBe(201);
    const mine = await api().get('/api/me/challenges').set('Cookie', me.cookie);
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0]).toMatchObject({ joined: true, participantCount: 2, me: { score: 0, rank: 2 } });
    expect(mine.body[0].leaderboard).toEqual([
      { name: 'Ayesha S.', isMe: false, score: 1, rank: 1, completed: false },
      { name: 'Hamza Ali', isMe: true, score: 0, rank: 2, completed: false },
    ]);
    expect(JSON.stringify(mine.body)).not.toContain(other.id);

    expect((await api().delete(`/api/me/challenges/${made.body.id}/join`).set('Cookie', me.cookie)).status).toBe(200);
    expect((await api().get('/api/me/challenges').set('Cookie', me.cookie)).body[0].joined).toBe(false);

    // Staff cannot join as a member, and members cannot reach the desk's screens.
    expect((await api().post(`/api/me/challenges/${made.body.id}/join`).set('Cookie', owner.cookie)).status).toBe(403);
    expect((await api().get('/api/challenges').set('Cookie', me.cookie)).status).toBe(403);
  });

  it('announces the top three once it has ended, and only once', async () => {
    const send = vi.spyOn(whatsapp, 'sendWhatsApp').mockResolvedValue('sent');
    vi.spyOn(whatsapp, 'whatsappEnabled', 'get').mockReturnValue(true);
    const owner = await makeGym();
    const members = await Promise.all(['A One', 'B Two', 'C Three', 'D Four', 'E Five'].map(name => addMember(owner.gymId, { name })));
    const visits = [4, 3, 3, 1, 0];
    for (const [i, m] of members.entries()) {
      for (let n = 0; n < visits[i]!; n++) await checkIn(owner.gymId, m.id, -10 + n);
    }
    // Made directly: the API refuses one that would already be over.
    const ended = await prisma.challenge.create({
      data: {
        gymId: owner.gymId, name: 'October visits', kind: 'visits',
        startsOn: new Date(day(-10)), endsOn: new Date(day(-1)),
        participants: { create: members.map(m => ({ memberId: m.id })) },
      },
    });
    const running = await api().post('/api/challenges').set('Cookie', owner.cookie)
      .send({ name: 'Now', kind: 'visits', startsOn: day(0), endsOn: day(5) });
    expect((await api().post(`/api/challenges/${running.body.id}/announce`).set('Cookie', owner.cookie)).status).toBe(400);

    const res = await api().post(`/api/challenges/${ended.id}/announce`).set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.winners.map((w: { name: string; rank: number }) => [w.name, w.rank])).toEqual([['A One', 1], ['B Two', 2], ['C Three', 2]]);
    expect(res.body.sent).toBe(3);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ template: 'challenge_winner', variables: ['B Two', 'Test Gym', '2nd', 'October visits'] }));

    expect((await api().post(`/api/challenges/${ended.id}/announce`).set('Cookie', owner.cookie)).status).toBe(409);
    expect(send).toHaveBeenCalledTimes(3);
    // The board is final once announced.
    expect((await api().delete(`/api/challenges/${ended.id}/participants/${members[0]!.id}`).set('Cookie', owner.cookie)).status).toBe(400);
  });

  it('keeps challenges to staff who manage members, and to their own gym', async () => {
    const owner = await makeGym();
    const made = await api().post('/api/challenges').set('Cookie', owner.cookie)
      .send({ name: 'Visits', kind: 'visits', startsOn: day(0), endsOn: day(-1) });
    expect(made.status).toBe(400);
    const ok = await api().post('/api/challenges').set('Cookie', owner.cookie)
      .send({ name: 'Visits', kind: 'visits', startsOn: day(0), endsOn: day(10) });

    const desk = await addUser(owner.gymId, { staffPermission: 'receptionist' });
    expect((await api().get('/api/challenges').set('Cookie', desk.cookie)).status).toBe(403);

    const other = await makeGym({ gymName: 'Other' });
    expect((await api().get(`/api/challenges/${ok.body.id}`).set('Cookie', other.cookie)).status).toBe(404);
    const stranger = await addMember(other.gymId);
    expect((await api().post(`/api/challenges/${ok.body.id}/participants`).set('Cookie', owner.cookie)
      .send({ memberId: stranger.id })).status).toBe(404);

    expect((await api().delete(`/api/challenges/${ok.body.id}`).set('Cookie', owner.cookie)).status).toBe(200);
    expect(await prisma.challenge.count()).toBe(0);
  });
});
