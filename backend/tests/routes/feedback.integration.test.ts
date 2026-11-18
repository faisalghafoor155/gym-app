import { beforeEach, describe, expect, it } from 'vitest';
import prisma from '../../src/db.js';
import { addMember, addUser, api, makeGym, resetDb } from '../helpers.js';

/**
 * Member feedback: sent from the portal, answered from the inbox, scored on
 * the dashboard. Anonymous must mean the member is not stored at all.
 */
beforeEach(resetDb);

const asMember = async (gymId: string) => {
  const member = await addMember(gymId);
  const login = await addUser(gymId, { role: 'member', memberId: member.id });
  return { member, cookie: login.cookie };
};

const send = (cookie: string, body: Record<string, unknown>) =>
  api().post('/api/me/feedback').set('Cookie', cookie).send(body);

describe('feedback', () => {
  it('opens a complaint, lets the gym reply and resolve, and shows the reply to the member', async () => {
    const owner = await makeGym();
    const m = await asMember(owner.gymId);

    const sent = await send(m.cookie, { rating: 2, category: 'cleanliness', message: 'Showers were dirty all week' });
    expect(sent.status).toBe(201);
    expect(sent.body.status).toBe('open');

    const inbox = await api().get('/api/feedback').set('Cookie', owner.cookie);
    expect(inbox.body).toHaveLength(1);
    expect(inbox.body[0]).toMatchObject({ rating: 2, member: { id: m.member.id } });

    const resolved = await api().put(`/api/feedback/${sent.body.id}`).set('Cookie', owner.cookie)
      .send({ status: 'resolved', response: 'Sorry — a cleaner now checks them every two hours.' });
    expect(resolved.status).toBe(200);
    expect(resolved.body).toMatchObject({ status: 'resolved', resolvedBy: { id: owner.userId } });

    const mine = await api().get('/api/me/feedback').set('Cookie', m.cookie);
    expect(mine.body[0]).toMatchObject({ status: 'resolved', response: expect.stringContaining('cleaner') });
  });

  it('stores no member at all for anonymous feedback', async () => {
    const owner = await makeGym();
    const m = await asMember(owner.gymId);
    await send(m.cookie, { rating: 1, category: 'staff', message: 'Rude at the desk', anonymous: true });

    const [row] = await prisma.feedback.findMany({ where: { gymId: owner.gymId } });
    expect(row!.memberId).toBeNull();
    expect((await api().get('/api/me/feedback').set('Cookie', m.cookie)).body).toHaveLength(0);
  });

  it('files stars alone as thanks, and asks why for a low score', async () => {
    const owner = await makeGym();
    const m = await asMember(owner.gymId);
    expect((await send(m.cookie, { rating: 5 })).body.status).toBe('resolved');
    expect((await send(m.cookie, { rating: 1 })).status).toBe(400);
    expect((await send(m.cookie, { rating: 6, message: 'x' })).status).toBe(400);
  });

  it("scores this month and keeps the inbox to staff who manage members", async () => {
    const owner = await makeGym();
    const m = await asMember(owner.gymId);
    await send(m.cookie, { rating: 5 });
    await send(m.cookie, { rating: 4 });
    await send(m.cookie, { rating: 3, message: 'AC too weak' });

    const res = await api().get('/api/feedback/summary').set('Cookie', owner.cookie);
    expect(res.body.thisMonth).toEqual({ count: 3, average: 4, happyPct: 67 });
    expect(res.body.open).toBe(1);

    const desk = await addUser(owner.gymId, { staffPermission: 'receptionist' });
    expect((await api().get('/api/feedback').set('Cookie', desk.cookie)).status).toBe(403);
    // Staff cannot send feedback as a member.
    expect((await send(owner.cookie, { rating: 5 })).status).toBe(403);

    const other = await makeGym({ gymName: 'Other' });
    const [row] = await prisma.feedback.findMany({ where: { gymId: owner.gymId, status: 'open' } });
    expect((await api().put(`/api/feedback/${row!.id}`).set('Cookie', other.cookie).send({ status: 'resolved' })).status).toBe(404);
  });
});
