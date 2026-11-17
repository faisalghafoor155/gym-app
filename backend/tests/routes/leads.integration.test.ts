import { beforeEach, describe, expect, it } from 'vitest';
import prisma from '../../src/db.js';
import { gymDay } from '../../src/services/dates.js';
import { addMember, addUser, api, makeGym, resetDb } from '../helpers.js';

/**
 * Enquiries, from first contact to the member they became.
 *
 * The cases worth pinning are the ones that keep the numbers honest: a lead
 * only counts as joined when it points at a real member of the same gym, and a
 * follow-up list that missed yesterday's overdue calls would be the list
 * nobody trusts.
 */
beforeEach(resetDb);

const day = (offset: number) => new Date(gymDay(new Date()).getTime() + offset * 86_400_000)
  .toISOString().slice(0, 10);

describe('leads', () => {
  it('creates a lead and lists it with counts', async () => {
    const owner = await makeGym();

    const res = await api().post('/api/leads').set('Cookie', owner.cookie)
      .send({ name: 'Ali Khan', phone: '03001234567', source: 'facebook', interest: 'weight loss' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Ali Khan', status: 'new', source: 'facebook' });

    const list = await api().get('/api/leads').set('Cookie', owner.cookie);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.counts).toMatchObject({ all: 1, new: 1, joined: 0 });
    expect(list.body.bySource).toEqual([{ source: 'facebook', total: 1, joined: 0 }]);
  });

  it('lists today and overdue follow-ups as due, not future ones', async () => {
    const owner = await makeGym();
    for (const [name, followUpOn] of [['Late', day(-2)], ['Today', day(0)], ['Later', day(3)]] as const) {
      await api().post('/api/leads').set('Cookie', owner.cookie).send({ name, followUpOn });
    }

    const res = await api().get('/api/leads?due=true').set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.map((l: { name: string }) => l.name)).toEqual(['Late', 'Today']);
    expect(res.body.counts.due).toBe(2);
  });

  it('clears the follow-up date when a lead is marked lost', async () => {
    const owner = await makeGym();
    const { body: lead } = await api().post('/api/leads').set('Cookie', owner.cookie)
      .send({ name: 'Sara', followUpOn: day(1) });

    const res = await api().put(`/api/leads/${lead.id}`).set('Cookie', owner.cookie)
      .send({ status: 'lost', lostReason: 'Too far from home' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'lost', followUpOn: null, lostReason: 'Too far from home' });
  });

  it('refuses setting joined by hand', async () => {
    const owner = await makeGym();
    const { body: lead } = await api().post('/api/leads').set('Cookie', owner.cookie).send({ name: 'Bilal' });

    const res = await api().put(`/api/leads/${lead.id}`).set('Cookie', owner.cookie).send({ status: 'joined' });
    expect(res.status).toBe(400);
  });

  it('converts a lead into a member and counts it as joined for its source', async () => {
    const owner = await makeGym();
    const member = await addMember(owner.gymId);
    const { body: lead } = await api().post('/api/leads').set('Cookie', owner.cookie)
      .send({ name: 'Usman', source: 'instagram', followUpOn: day(0) });

    const res = await api().post(`/api/leads/${lead.id}/convert`).set('Cookie', owner.cookie)
      .send({ memberId: member.id });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'joined', followUpOn: null, member: { id: member.id } });

    const list = await api().get('/api/leads').set('Cookie', owner.cookie);
    expect(list.body.bySource).toEqual([{ source: 'instagram', total: 1, joined: 1 }]);
    expect(list.body.counts.due).toBe(0);

    // Converted once is converted: no second member, no status change after.
    const again = await api().post(`/api/leads/${lead.id}/convert`).set('Cookie', owner.cookie)
      .send({ memberId: member.id });
    expect(again.status).toBe(409);
    const reopen = await api().put(`/api/leads/${lead.id}`).set('Cookie', owner.cookie).send({ status: 'new' });
    expect(reopen.status).toBe(409);
  });

  it('will not link one member to two leads', async () => {
    const owner = await makeGym();
    const member = await addMember(owner.gymId);
    const { body: a } = await api().post('/api/leads').set('Cookie', owner.cookie).send({ name: 'A' });
    const { body: b } = await api().post('/api/leads').set('Cookie', owner.cookie).send({ name: 'B' });

    await api().post(`/api/leads/${a.id}/convert`).set('Cookie', owner.cookie).send({ memberId: member.id });
    const res = await api().post(`/api/leads/${b.id}/convert`).set('Cookie', owner.cookie).send({ memberId: member.id });
    expect(res.status).toBe(409);
  });

  it("keeps one gym's leads and members out of another's", async () => {
    const mine = await makeGym();
    const theirs = await makeGym();
    const theirMember = await addMember(theirs.gymId);
    const { body: lead } = await api().post('/api/leads').set('Cookie', mine.cookie).send({ name: 'Mine' });

    expect((await api().get('/api/leads').set('Cookie', theirs.cookie)).body.data).toHaveLength(0);
    expect((await api().delete(`/api/leads/${lead.id}`).set('Cookie', theirs.cookie)).status).toBe(404);
    const convert = await api().post(`/api/leads/${lead.id}/convert`).set('Cookie', mine.cookie)
      .send({ memberId: theirMember.id });
    expect(convert.status).toBe(404);
  });

  it('keeps members out', async () => {
    const owner = await makeGym();
    const member = await addMember(owner.gymId);
    const login = await addUser(owner.gymId, { role: 'member', memberId: member.id });

    expect((await api().get('/api/leads').set('Cookie', login.cookie)).status).toBe(403);
  });

  it('deletes a lead and records it in the audit log', async () => {
    const owner = await makeGym();
    const { body: lead } = await api().post('/api/leads').set('Cookie', owner.cookie).send({ name: 'Gone' });

    expect((await api().delete(`/api/leads/${lead.id}`).set('Cookie', owner.cookie)).status).toBe(204);
    expect(await prisma.lead.count()).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: 'lead.delete' } })).toBe(1);
  });
});
