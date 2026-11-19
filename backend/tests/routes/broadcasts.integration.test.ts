import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../../src/db.js';
import { runBroadcast } from '../../src/services/broadcasts.js';
import * as whatsapp from '../../src/services/whatsapp.js';
import { addMember, addMembership, addUser, api, makeGym, resetDb } from '../helpers.js';

/**
 * Bulk WhatsApp: the audience it would reach, sending in the background, and
 * the log of who got what.
 */
beforeEach(resetDb);
afterEach(() => { vi.restoreAllMocks(); });

const stubWhatsApp = (result: whatsapp.SendResult | ((to: string) => whatsapp.SendResult) = 'sent') => {
  vi.spyOn(whatsapp, 'whatsappEnabled', 'get').mockReturnValue(true);
  return vi.spyOn(whatsapp, 'sendWhatsApp').mockImplementation(async (msg) =>
    typeof result === 'function' ? result(msg.to) : result);
};

/** Waits for the background send to finish. */
const finished = async (id: string) => {
  for (let i = 0; i < 200; i++) {
    const b = await prisma.broadcast.findUnique({ where: { id } });
    if (b?.status === 'done') return;
    await new Promise(r => setTimeout(r, 10));
  }
  throw new Error('broadcast did not finish');
};

const offer = { template: 'offer', values: { offer: '20% off on 3-month plans', until: '15 April' } };

describe('broadcasts', () => {
  it('sends an offer to active members once per number, and logs each one', async () => {
    const send = stubWhatsApp(to => (to === '03009999999' ? 'failed' : 'sent'));
    const owner = await makeGym({ gymName: 'Iron House' });
    const ali = await addMember(owner.gymId, { name: 'Ali', phone: '03001111111' });
    const sara = await addMember(owner.gymId, { name: 'Sara', phone: '03001111111' }); // same family phone
    const usman = await addMember(owner.gymId, { name: 'Usman', phone: '03009999999' });
    const optedOut = await addMember(owner.gymId, { name: 'Opted Out', phone: '03002222222' });
    const landline = await addMember(owner.gymId, { name: 'Landline', phone: '0512345678' });
    const lapsed = await addMember(owner.gymId, { name: 'Expired', phone: '03003333333' });
    await prisma.member.update({ where: { id: optedOut.id }, data: { whatsappOptOut: true } });
    for (const m of [ali, sara, usman, optedOut, landline]) await addMembership(owner.gymId, m.id, { expiresInDays: 30 });
    await addMembership(owner.gymId, lapsed.id, { expiresInDays: -5 });

    const preview = await api().get('/api/broadcasts/audience?audience=active').set('Cookie', owner.cookie);
    expect(preview.body).toMatchObject({ total: 5, reachable: 2, optedOut: 1, noNumber: 1, duplicates: 1 });

    const res = await api().post('/api/broadcasts').set('Cookie', owner.cookie).send({ ...offer, audience: 'active' });
    expect(res.status).toBe(201);
    expect(res.body.recipients).toBe(2);
    await finished(res.body.id);

    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      template: 'gym_offer', variables: ['Ali', 'Iron House', '20% off on 3-month plans', '15 April'],
    }));

    const log = await api().get('/api/broadcasts').set('Cookie', owner.cookie);
    expect(log.body[0]).toMatchObject({ status: 'done', audience: 'active', counts: { total: 2, sent: 1, failed: 1, waiting: 0 } });
    const one = await api().get(`/api/broadcasts/${res.body.id}`).set('Cookie', owner.cookie);
    expect(one.body.recipients.map((r: { name: string; status: string }) => [r.name, r.status])).toEqual([['Usman', 'failed'], ['Ali', 'sent']]);
  });

  it('reaches expired members, inactive members and open leads', async () => {
    stubWhatsApp();
    const owner = await makeGym();
    const expired = await addMember(owner.gymId, { name: 'Expired', phone: '03001000001' });
    await addMembership(owner.gymId, expired.id, { expiresInDays: -10 });
    const away = await addMember(owner.gymId, { name: 'Away', phone: '03001000002' });
    await addMembership(owner.gymId, away.id, { expiresInDays: 40 });
    await prisma.membership.updateMany({ where: { memberId: away.id }, data: { startDate: new Date(Date.now() - 60 * 86_400_000) } });
    const regular = await addMember(owner.gymId, { name: 'Regular', phone: '03001000003' });
    await addMembership(owner.gymId, regular.id, { expiresInDays: 40 });
    await prisma.membership.updateMany({ where: { memberId: regular.id }, data: { startDate: new Date(Date.now() - 60 * 86_400_000) } });
    await prisma.attendance.create({ data: { gymId: owner.gymId, memberId: regular.id } });
    await prisma.lead.createMany({
      data: [
        { gymId: owner.gymId, name: 'Open lead', phone: '03001000004', status: 'contacted' },
        { gymId: owner.gymId, name: 'Lost lead', phone: '03001000005', status: 'lost' },
      ],
    });

    const count = async (q: string) => (await api().get(`/api/broadcasts/audience?${q}`).set('Cookie', owner.cookie)).body.sample;
    expect(await count('audience=expired')).toEqual(['Expired']);
    expect(await count('audience=inactive&inactiveDays=30')).toEqual(['Away']);
    expect(await count('audience=leads')).toEqual(['Open lead']);
    // The Inactive Members page reads the same list.
    const page = await api().get('/api/attendance/inactive?days=30').set('Cookie', owner.cookie);
    expect(page.body.data.map((r: { name: string }) => r.name)).toEqual(['Away']);
    expect(page.body.data[0]).not.toHaveProperty('whatsappOptOut');

    const res = await api().post('/api/broadcasts').set('Cookie', owner.cookie)
      .send({ template: 'closed', audience: 'leads', values: { when: 'Friday 25 December', reason: 'Quaid Day' } });
    await finished(res.body.id);
    const [row] = await prisma.broadcastRecipient.findMany({ where: { broadcastId: res.body.id } });
    expect(row).toMatchObject({ name: 'Open lead', status: 'sent', memberId: null });
    expect(row!.leadId).not.toBeNull();
  });

  it('refuses blank or multi-line slots, a second send while one is going, and an unconfigured install', async () => {
    const owner = await makeGym();
    const m = await addMember(owner.gymId);
    await addMembership(owner.gymId, m.id, { expiresInDays: 30 });

    // Nothing configured: refused before anything is recorded.
    expect((await api().post('/api/broadcasts').set('Cookie', owner.cookie).send({ ...offer, audience: 'active' })).status).toBe(400);

    stubWhatsApp();
    const post = (body: object) => api().post('/api/broadcasts').set('Cookie', owner.cookie).send(body);
    expect((await post({ template: 'offer', audience: 'active', values: { offer: 'x' } })).status).toBe(400);
    expect((await post({ template: 'offer', audience: 'active', values: { offer: 'line one\nline two', until: 'May' } })).status).toBe(400);

    // Held as still sending, so a second press is refused.
    await prisma.broadcast.create({ data: { gymId: owner.gymId, template: 'offer', values: {}, audience: 'active' } });
    expect((await post({ ...offer, audience: 'active' })).status).toBe(409);
  });

  it('picks up where it left off, without sending to anyone twice', async () => {
    const send = stubWhatsApp();
    const owner = await makeGym();
    const b = await prisma.broadcast.create({
      data: {
        gymId: owner.gymId, template: 'announcement', values: { message: 'new AC installed' }, audience: 'active',
        recipients: {
          create: [
            { name: 'Done', phone: '03001000001', status: 'sent' },
            { name: 'Next', phone: '03001000002' },
          ],
        },
      },
    });
    await runBroadcast(b.id);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ variables: ['Next', 'Test Gym', 'new AC installed'] }));
    expect((await prisma.broadcast.findUnique({ where: { id: b.id } }))!.status).toBe('done');
  });

  it('keeps broadcasts to staff who manage members, on a plan with WhatsApp, in their own gym', async () => {
    stubWhatsApp();
    const owner = await makeGym();
    const desk = await addUser(owner.gymId, { staffPermission: 'receptionist' });
    expect((await api().get('/api/broadcasts').set('Cookie', desk.cookie)).status).toBe(403);

    const other = await makeGym({ gymName: 'Other' });
    const b = await prisma.broadcast.create({ data: { gymId: owner.gymId, template: 'offer', values: {}, audience: 'active', status: 'done' } });
    expect((await api().get(`/api/broadcasts/${b.id}`).set('Cookie', other.cookie)).status).toBe(404);

    const free = await makeGym({ plan: 'free', gymName: 'Free' });
    const res = await api().post('/api/broadcasts').set('Cookie', free.cookie).send({ ...offer, audience: 'active' });
    expect(res.status).toBe(402);
  });
});
