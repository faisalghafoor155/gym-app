import { beforeEach, describe, expect, it } from 'vitest';

import prisma from '../../src/db.js';
import { ensureSubscription, issueInvoiceIfDue } from '../../src/services/billing.js';
import { addMember, api, makeGym, resetDb } from '../helpers.js';

beforeEach(resetDb);

/**
 * Two requests reading the same state at once, and a delete that a newer
 * table quietly blocked. Each was a check-then-write that only held when
 * nothing else happened at the same moment.
 */
describe('lockers', () => {
  it('gives a locker to one member when two desks assign it at once', async () => {
    const owner = await makeGym();
    const [a, b] = [await addMember(owner.gymId), await addMember(owner.gymId)];
    const locker = await prisma.locker.create({ data: { gymId: owner.gymId, number: '7' } });

    const assign = (memberId: string) => api()
      .post(`/api/lockers/${locker.id}/assign`).set('Cookie', owner.cookie)
      .send({ memberId, feeAmount: 500, feeMethod: 'cash' });
    const results = await Promise.all([assign(a.id), assign(b.id)]);

    expect(results.map(r => r.status).sort()).toEqual([200, 400]);
    expect(await prisma.payment.count({ where: { type: 'locker' } })).toBe(1);
  });
});

describe('PT sessions', () => {
  const setup = async () => {
    const owner = await makeGym();
    const member = await addMember(owner.gymId);
    const trainer = await prisma.trainer.create({
      data: { gymId: owner.gymId, name: 'Coach', commissionPercentage: 33.33 },
    });
    const created = await api().post('/api/pt-sessions').set('Cookie', owner.cookie).send({
      memberId: member.id, trainerId: trainer.id, sessionDate: new Date().toISOString(),
      priceCharged: 1000, paymentStatus: 'unpaid',
    });
    expect(created.status).toBe(201);
    return { owner, member, session: created.body };
  };

  it('rounds the commission to the paisa', async () => {
    const { session } = await setup();
    expect(session.trainerCommission).toBe(333.3);
  });

  it('removes the payment when a session is marked unpaid again', async () => {
    const { owner, member, session } = await setup();
    const mark = (paymentStatus: string) => api()
      .put(`/api/pt-sessions/${session.id}`).set('Cookie', owner.cookie).send({ paymentStatus });

    await mark('paid');
    await mark('unpaid');
    await mark('paid');

    expect(await prisma.payment.count({ where: { memberId: member.id, status: 'paid' } })).toBe(1);
  });

  it('records one payment when two requests mark it paid at once', async () => {
    const { owner, member, session } = await setup();
    const mark = () => api()
      .put(`/api/pt-sessions/${session.id}`).set('Cookie', owner.cookie).send({ paymentStatus: 'paid' });
    await Promise.all([mark(), mark()]);

    expect(await prisma.payment.count({ where: { memberId: member.id, status: 'paid' } })).toBe(1);
  });

  it('does not stop the member being deleted', async () => {
    const { owner, member } = await setup();
    const res = await api().delete(`/api/members/${member.id}`).set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(await prisma.member.count({ where: { id: member.id } })).toBe(0);
  });
});

describe('subscription invoices', () => {
  it('issues one open invoice when two sweeps run at once', async () => {
    const owner = await makeGym({ plan: 'free' });
    const sub = await ensureSubscription(owner.gymId, 'pro');

    const now = new Date();
    const issued = await Promise.all([
      issueInvoiceIfDue(sub.id, now),
      issueInvoiceIfDue(sub.id, now),
    ]);

    expect(issued.filter(Boolean)).toHaveLength(1);
    expect(await prisma.subscriptionInvoice.count({
      where: { subscriptionId: sub.id, status: 'open' },
    })).toBe(1);
  });
});
