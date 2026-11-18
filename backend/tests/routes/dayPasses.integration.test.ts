import { beforeEach, describe, expect, it } from 'vitest';
import prisma from '../../src/db.js';
import { addMember, addUser, api, makeGym, resetDb } from '../helpers.js';

/**
 * Day passes: one day's entry for a walk-in or a member's guest.
 *
 * What matters most is the money. A day pass never becomes a Payment, so the
 * reports have to add it in themselves — these tests pin that every revenue
 * figure the owner reads includes it.
 */
beforeEach(resetDb);

const sell = (cookie: string, body: Record<string, unknown>) =>
  api().post('/api/day-passes').set('Cookie', cookie).send(body);

describe('day passes', () => {
  it("sells a walk-in pass and lists it under today's totals", async () => {
    const owner = await makeGym();

    const res = await sell(owner.cookie, { name: 'Traveller', phone: '03001112222', amount: 500 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Traveller', amount: 500, method: 'cash', hostMember: null });

    const list = await api().get('/api/day-passes').set('Cookie', owner.cookie);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.totals).toEqual({ count: 1, amount: 500, guests: 0 });
  });

  it('refuses a channel on a cash pass', async () => {
    const owner = await makeGym();
    const res = await sell(owner.cookie, { name: 'X', amount: 500, method: 'cash', channel: 'jazzcash' });
    expect(res.status).toBe(400);
  });

  it('records a guest against the member who brought them', async () => {
    const owner = await makeGym();
    const host = await addMember(owner.gymId);

    const res = await sell(owner.cookie, { name: 'Friend', amount: 0, hostMemberId: host.id });
    expect(res.status).toBe(201);
    expect(res.body.hostMember).toMatchObject({ id: host.id });

    const list = await api().get('/api/day-passes').set('Cookie', owner.cookie);
    expect(list.body.totals.guests).toBe(1);
  });

  it("enforces the gym's monthly guest limit per member", async () => {
    const owner = await makeGym();
    await prisma.gym.update({ where: { id: owner.gymId }, data: { guestPassesPerMonth: 2 } });
    const host = await addMember(owner.gymId);

    expect((await sell(owner.cookie, { name: 'G1', amount: 0, hostMemberId: host.id })).status).toBe(201);
    expect((await sell(owner.cookie, { name: 'G2', amount: 0, hostMemberId: host.id })).status).toBe(201);
    const third = await sell(owner.cookie, { name: 'G3', amount: 0, hostMemberId: host.id });
    expect(third.status).toBe(409);
    expect(third.body.error).toMatch(/limit 2/);

    // The cap is per member; a walk-in with no host is never limited.
    expect((await sell(owner.cookie, { name: 'Walk-in', amount: 500 })).status).toBe(201);
  });

  it("will not take another gym's member as host", async () => {
    const mine = await makeGym();
    const theirs = await makeGym();
    const theirMember = await addMember(theirs.gymId);

    const res = await sell(mine.cookie, { name: 'X', amount: 0, hostMemberId: theirMember.id });
    expect(res.status).toBe(404);
  });

  it("keeps one gym's passes out of another's", async () => {
    const mine = await makeGym();
    const theirs = await makeGym();
    const { body: pass } = await sell(mine.cookie, { name: 'Mine', amount: 300 });

    expect((await api().get('/api/day-passes').set('Cookie', theirs.cookie)).body.data).toHaveLength(0);
    expect((await api().delete(`/api/day-passes/${pass.id}`).set('Cookie', theirs.cookie)).status).toBe(404);
  });

  it('lets a receptionist neither sell nor see passes, as with payments', async () => {
    const owner = await makeGym();
    const desk = await addUser(owner.gymId, { role: 'staff', staffPermission: 'receptionist' });
    expect((await sell(desk.cookie, { name: 'X', amount: 500 })).status).toBe(403);
  });

  it('deletes a pass and logs it', async () => {
    const owner = await makeGym();
    const { body: pass } = await sell(owner.cookie, { name: 'Oops', amount: 500 });

    expect((await api().delete(`/api/day-passes/${pass.id}`).set('Cookie', owner.cookie)).status).toBe(204);
    expect(await prisma.dayPass.count()).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: 'dayPass.delete' } })).toBe(1);
  });

  it('saves the day pass fee and guest limit in gym settings', async () => {
    const owner = await makeGym();
    const res = await api().put('/api/gym-settings').set('Cookie', owner.cookie)
      .send({ defaultPtFee: 0, dayPassFee: 600, guestPassesPerMonth: 3 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ dayPassFee: 600, guestPassesPerMonth: 3 });
  });
});

describe('day pass revenue in the reports', () => {
  it('is counted in profit, the payment summary and the dashboard', async () => {
    const owner = await makeGym();
    await sell(owner.cookie, { name: 'A', amount: 500 });
    await sell(owner.cookie, { name: 'B', amount: 700, method: 'online', channel: 'jazzcash' });

    const profit = await api().get('/api/expenses/profit').set('Cookie', owner.cookie);
    expect(profit.body.revenue).toBe(1200);
    expect(profit.body.profit).toBe(1200);
    expect(profit.body.revenueByType).toContainEqual({ type: 'daypass', total: 1200 });

    const summary = await api().get('/api/payments/summary').set('Cookie', owner.cookie);
    expect(summary.body.thisMonth).toBe(1200);
    expect(summary.body.byMonth.at(-1)).toMatchObject({ daypass: 1200, total: 1200 });

    const dash = await api().get('/api/dashboard').set('Cookie', owner.cookie);
    expect(dash.body.revenue.monthToDate).toMatchObject({ daypass: 1200, total: 1200 });
  });
});
