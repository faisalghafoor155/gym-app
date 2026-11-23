import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../../src/db.js';
import { gymDay } from '../../src/services/dates.js';
import { api, makeGym, resetDb } from '../helpers.js';

/**
 * Free trials for leads, checking them in on one, and the desk's daily
 * WhatsApp list of who to call.
 */

const sent = vi.hoisted(() => [] as { to: string; template: string; variables?: string[] }[]);
vi.mock('../../src/services/messaging.js', () => ({
  messagingEnabled: () => true,
  sendMemberMessage: async (msg: { to: string; template: string; variables?: string[] }) => {
    sent.push(msg);
    return 'sent';
  },
}));

beforeEach(async () => {
  await resetDb();
  sent.length = 0;
});

const day = (offset: number) => new Date(gymDay(new Date()).getTime() + offset * 86_400_000)
  .toISOString().slice(0, 10);

const aLead = async (cookie: string, body: Record<string, unknown> = {}) =>
  (await api().post('/api/leads').set('Cookie', cookie).send({ name: 'Ali Khan', phone: '03001234567', ...body })).body;

describe('free trials', () => {
  it('starts a trial and asks to follow up the day after it ends', async () => {
    const owner = await makeGym();
    const lead = await aLead(owner.cookie);

    const res = await api().post(`/api/leads/${lead.id}/trial`).set('Cookie', owner.cookie).send({ days: 3 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('trial');
    expect(res.body.trialUntil.slice(0, 10)).toBe(day(2));
    expect(res.body.followUpOn.slice(0, 10)).toBe(day(3));
  });

  it('checks a lead in once a day while the trial runs', async () => {
    const owner = await makeGym();
    const lead = await aLead(owner.cookie);
    await api().post(`/api/leads/${lead.id}/trial`).set('Cookie', owner.cookie).send({ days: 1 });

    const first = await api().post(`/api/leads/${lead.id}/checkin`).set('Cookie', owner.cookie);
    const again = await api().post(`/api/leads/${lead.id}/checkin`).set('Cookie', owner.cookie);

    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ visits: 1, alreadyCheckedIn: false });
    expect(again.status).toBe(200);
    expect(again.body.alreadyCheckedIn).toBe(true);
    expect(await prisma.leadVisit.count()).toBe(1);

    const list = await api().get('/api/leads').set('Cookie', owner.cookie);
    expect(list.body.data[0]._count.visits).toBe(1);
    // Not a member's attendance.
    expect(await prisma.attendance.count()).toBe(0);
  });

  it('refuses a lead with no trial, or one whose trial has ended', async () => {
    const owner = await makeGym();
    const lead = await aLead(owner.cookie);

    const none = await api().post(`/api/leads/${lead.id}/checkin`).set('Cookie', owner.cookie);
    expect(none.status).toBe(403);
    expect(none.body.reason).toBe('no_trial');

    await prisma.lead.update({ where: { id: lead.id }, data: { status: 'trial', trialUntil: new Date(day(-1)) } });
    const ended = await api().post(`/api/leads/${lead.id}/checkin`).set('Cookie', owner.cookie);
    expect(ended.status).toBe(403);
    expect(ended.body.error).toMatch(/ended/);
  });

  it('refuses a trial longer than a week, or for a lead who already joined', async () => {
    const owner = await makeGym();
    const lead = await aLead(owner.cookie);
    expect((await api().post(`/api/leads/${lead.id}/trial`).set('Cookie', owner.cookie).send({ days: 10 })).status).toBe(400);

    await prisma.lead.update({ where: { id: lead.id }, data: { status: 'joined' } });
    expect((await api().post(`/api/leads/${lead.id}/trial`).set('Cookie', owner.cookie).send({ days: 2 })).status).toBe(409);
  });

  it("does not reach another gym's lead", async () => {
    const owner = await makeGym();
    const lead = await aLead(owner.cookie);
    const other = await makeGym({ gymName: 'Other Gym' });
    expect((await api().post(`/api/leads/${lead.id}/trial`).set('Cookie', other.cookie).send({ days: 2 })).status).toBe(404);
    expect((await api().post(`/api/leads/${lead.id}/checkin`).set('Cookie', other.cookie)).status).toBe(404);
  });
});

describe('daily follow-up list to the desk', () => {
  const run = async () => (await import('../../src/jobs/leadFollowUps.js')).runLeadFollowUps();

  it("sends the gym's number today's and overdue follow-ups, once a day", async () => {
    const owner = await makeGym();
    await prisma.gym.update({ where: { id: owner.gymId }, data: { phone: '03211234567' } });
    await aLead(owner.cookie, { name: 'Late', followUpOn: day(-2) });
    await aLead(owner.cookie, { name: 'Today', followUpOn: day(0) });
    await aLead(owner.cookie, { name: 'Later', followUpOn: day(3) });
    await aLead(owner.cookie, { name: 'Gave up', followUpOn: day(0), status: 'lost' });

    const first = await run();
    expect(first.sent).toBe(1);
    expect(sent[0].template).toBe('lead_followups');
    expect(sent[0].variables).toEqual(['Test Gym', '2', 'Late, Today']);

    const second = await run();
    expect(second.skippedAlreadySent).toBe(1);
    expect(sent).toHaveLength(1);
  });

  it('sends nothing when nobody is due, or the gym has no number', async () => {
    const owner = await makeGym();
    await aLead(owner.cookie, { followUpOn: day(0) });
    expect((await run()).skippedNoWhatsApp).toBe(1);

    await prisma.lead.updateMany({ data: { followUpOn: new Date(day(5)) } });
    await prisma.gym.update({ where: { id: owner.gymId }, data: { phone: '03211234567' } });
    expect((await run()).gyms).toBe(0);
    expect(sent).toHaveLength(0);
  });
});
