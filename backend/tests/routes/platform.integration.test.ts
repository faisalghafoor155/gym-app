import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import prisma from '../../src/db.js';
import { PENDING_APPROVAL_REASON } from '../../src/controllers/authController.js';
import { addMember, api, makeGym, resetDb } from '../helpers.js';
import { signGymApprovalToken } from '../../src/services/gymApproval.js';
import { signGymCheckinToken } from '../../src/services/gymCheckin.js';

beforeEach(async () => {
  await resetDb();
  process.env.PLATFORM_ADMIN_EMAILS = 'boss@example.com';
});
afterEach(() => {
  delete process.env.PLATFORM_ADMIN_EMAILS;
});

describe('/api/platform', () => {
  it('shows the operator every gym, with usage and subscription expiry', async () => {
    const boss = await makeGym({ email: 'boss@example.com', gymName: 'Boss Gym', emailVerified: true });
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

  it('is closed to an owner on the list whose address was never verified', async () => {
    // Anybody can type the operator address into the sign-up form.
    const impostor = await makeGym({ email: 'boss@example.com' });
    const res = await api().get('/api/platform/gyms').set('Cookie', impostor.cookie);
    expect(res.status).toBe(404);
  });

  it('will not let a gym create a staff or member login with an operator address', async () => {
    const owner = await makeGym();
    const staff = await api().post('/api/users/staff').set('Cookie', owner.cookie)
      .send({ name: 'Boss', email: 'BOSS@example.com', password: 'correct-horse-battery' });
    expect(staff.status).toBe(409);

    const member = await addMember(owner.gymId);
    const login = await api().post('/api/users/member-login').set('Cookie', owner.cookie)
      .send({ memberId: member.id, email: 'boss@example.com', password: 'correct-horse-battery' });
    expect(login.status).toBe(409);

    expect(await prisma.user.count({ where: { email: 'boss@example.com' } })).toBe(0);
  });

  it('keeps the billing admin endpoints to the same operator', async () => {
    const owner = await makeGym();
    const other = await makeGym({ plan: 'free' });

    const plan = await api().post('/api/billing/admin/set-plan').set('Cookie', owner.cookie)
      .send({ gymId: other.gymId, plan: 'pro' });
    expect(plan.status).toBe(403);
    expect((await prisma.gym.findUnique({ where: { id: other.gymId } }))?.plan).toBe('free');

    const boss = await makeGym({ email: 'boss@example.com', emailVerified: true });
    const ok = await api().post('/api/billing/admin/set-plan').set('Cookie', boss.cookie)
      .send({ gymId: other.gymId, plan: 'pro' });
    expect(ok.status).toBe(200);
  });

  it('is closed to everyone when no operator is configured', async () => {
    const boss = await makeGym({ email: 'boss@example.com', emailVerified: true });
    delete process.env.PLATFORM_ADMIN_EMAILS;
    const res = await api().get('/api/platform/gyms').set('Cookie', boss.cookie);
    expect(res.status).toBe(404);
  });

  it('approves a pending gym, and only a pending one', async () => {
    const boss = await makeGym({ email: 'boss@example.com', emailVerified: true });
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

  describe("the operator's own pending gym", () => {
    const login = (email: string) =>
      api().post('/api/auth/login').send({ email, password: 'correct-horse-battery' });

    it('is approved when the verified operator signs in', async () => {
      const boss = await makeGym({ email: 'boss@example.com', emailVerified: true });
      await prisma.gym.update({
        where: { id: boss.gymId },
        data: { suspendedAt: new Date(), suspendedReason: PENDING_APPROVAL_REASON },
      });

      const res = await login('boss@example.com');

      expect(res.status).toBe(200);
      expect((await prisma.gym.findUnique({ where: { id: boss.gymId } }))?.suspendedAt).toBeNull();
    });

    it('stays held while the operator address is unverified', async () => {
      const boss = await makeGym({ email: 'boss@example.com' });
      await prisma.gym.update({
        where: { id: boss.gymId },
        data: { suspendedAt: new Date(), suspendedReason: PENDING_APPROVAL_REASON },
      });

      expect((await login('boss@example.com')).status).toBe(403);
      expect((await prisma.gym.findUnique({ where: { id: boss.gymId } }))?.suspendedAt).not.toBeNull();
    });

    it('is not lifted when suspended for a reason other than approval', async () => {
      const boss = await makeGym({ email: 'boss@example.com', emailVerified: true });
      await prisma.gym.update({
        where: { id: boss.gymId },
        data: { suspendedAt: new Date(), suspendedReason: 'Unpaid since March' },
      });

      expect((await login('boss@example.com')).status).toBe(403);
    });

    it('does not apply to an ordinary owner', async () => {
      const owner = await makeGym({ emailVerified: true });
      await prisma.gym.update({
        where: { id: owner.gymId },
        data: { suspendedAt: new Date(), suspendedReason: PENDING_APPROVAL_REASON },
      });

      expect((await login(owner.email)).status).toBe(403);
    });
  });

  it('suspends another gym but refuses to lock the operator out of their own', async () => {
    const boss = await makeGym({ email: 'boss@example.com', emailVerified: true });
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

  describe('approval link from the operator email', () => {
    const holdForApproval = (gymId: string) =>
      prisma.gym.update({
        where: { id: gymId },
        data: { suspendedAt: new Date(), suspendedReason: PENDING_APPROVAL_REASON },
      });

    it('only shows the gym on GET, and approves it on POST without a session', async () => {
      const pending = await makeGym({ gymName: 'Apex Fitness' });
      await holdForApproval(pending.gymId);
      const token = signGymApprovalToken(pending.gymId);

      const page = await api().get(`/api/platform/approve/${token}`);
      expect(page.status).toBe(200);
      expect(page.text).toContain('Approve Apex Fitness?');
      expect((await prisma.gym.findUnique({ where: { id: pending.gymId } }))?.suspendedAt).not.toBeNull();

      const done = await api().post(`/api/platform/approve/${token}`);
      expect(done.status).toBe(200);
      expect(done.text).toContain('is approved');
      expect((await prisma.gym.findUnique({ where: { id: pending.gymId } }))?.suspendedAt).toBeNull();
    });

    it('will not lift a suspension the operator chose', async () => {
      const gym = await makeGym();
      await prisma.gym.update({
        where: { id: gym.gymId },
        data: { suspendedAt: new Date(), suspendedReason: 'Unpaid' },
      });

      const res = await api().post(`/api/platform/approve/${signGymApprovalToken(gym.gymId)}`);
      expect(res.status).toBe(409);
      expect((await prisma.gym.findUnique({ where: { id: gym.gymId } }))?.suspendedReason).toBe('Unpaid');
    });

    it('refuses a token minted for anything else', async () => {
      const pending = await makeGym();
      await holdForApproval(pending.gymId);

      const res = await api().post(`/api/platform/approve/${signGymCheckinToken(pending.gymId)}`);
      expect(res.status).toBe(410);
      expect((await prisma.gym.findUnique({ where: { id: pending.gymId } }))?.suspendedAt).not.toBeNull();
    });
  });
});
