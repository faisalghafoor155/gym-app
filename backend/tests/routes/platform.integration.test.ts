import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import prisma from '../../src/db.js';
import { PENDING_APPROVAL_REASON } from '../../src/controllers/authController.js';
import { api, makeGym, resetDb } from '../helpers.js';

beforeEach(async () => {
  await resetDb();
  process.env.PLATFORM_ADMIN_EMAILS = 'boss@example.com';
});
afterEach(() => {
  delete process.env.PLATFORM_ADMIN_EMAILS;
});

describe('/api/platform', () => {
  it('shows the operator every gym, with usage and subscription expiry', async () => {
    const boss = await makeGym({ email: 'boss@example.com', gymName: 'Boss Gym' });
    const other = await makeGym({ gymName: 'Iron Works' });
    await prisma.gymSubscription.create({
      data: {
        gymId: other.gymId, plan: 'growth', amount: 12000, periodDays: 365,
        paidThrough: new Date(Date.now() + 3 * 86_400_000),
      },
    });

    const res = await api().get('/api/platform/gyms').set('Cookie', boss.cookie);

    expect(res.status).toBe(200);
    expect(res.body.summary.gyms).toBe(2);
    const iron = res.body.gyms.find((g: { name: string }) => g.name === 'Iron Works');
    expect(iron.subscription).toMatchObject({ cycle: 'yearly', state: 'expiring' });
    expect(iron.subscription.daysLeft).toBeLessThanOrEqual(3);
    expect(res.body.summary.expiringSoon).toBe(1);
  });

  it('does not exist for a gym owner who is not the operator', async () => {
    const owner = await makeGym();
    const res = await api().get('/api/platform/gyms').set('Cookie', owner.cookie);
    expect(res.status).toBe(404);
  });

  it('is closed to everyone when no operator is configured', async () => {
    const boss = await makeGym({ email: 'boss@example.com' });
    delete process.env.PLATFORM_ADMIN_EMAILS;
    const res = await api().get('/api/platform/gyms').set('Cookie', boss.cookie);
    expect(res.status).toBe(404);
  });

  it('approves a pending gym, and only a pending one', async () => {
    const boss = await makeGym({ email: 'boss@example.com' });
    const pending = await makeGym({ gymName: 'New Gym' });
    await prisma.gym.update({
      where: { id: pending.gymId },
      data: { suspendedAt: new Date(), suspendedReason: PENDING_APPROVAL_REASON },
    });

    const ok = await api().post(`/api/platform/gyms/${pending.gymId}/approve`).set('Cookie', boss.cookie);
    expect(ok.status).toBe(200);
    expect((await prisma.gym.findUnique({ where: { id: pending.gymId } }))?.suspendedAt).toBeNull();

    const again = await api().post(`/api/platform/gyms/${pending.gymId}/approve`).set('Cookie', boss.cookie);
    expect(again.status).toBe(409);
  });

  it('suspends another gym but refuses to lock the operator out of their own', async () => {
    const boss = await makeGym({ email: 'boss@example.com' });
    const other = await makeGym();

    const own = await api().post(`/api/platform/gyms/${boss.gymId}/suspend`).set('Cookie', boss.cookie).send({});
    expect(own.status).toBe(400);

    const res = await api()
      .post(`/api/platform/gyms/${other.gymId}/suspend`)
      .set('Cookie', boss.cookie)
      .send({ reason: 'Unpaid' });
    expect(res.status).toBe(200);
    const gym = await prisma.gym.findUnique({ where: { id: other.gymId } });
    expect(gym?.suspendedReason).toBe('Unpaid');
  });
});
