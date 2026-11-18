import { beforeEach, describe, expect, it } from 'vitest';
import prisma from '../../src/db.js';
import { addUser, api, makeGym, resetDb } from '../helpers.js';

/**
 * Staff salaries: the month's sheet, advances and deductions, and payday.
 *
 * What matters most is the books. Every rupee handed over — an advance or the
 * rest on payday — must land in Expenses exactly once, and undoing it must take
 * it back out.
 */
beforeEach(resetDb);

/** A month already under way, so it can be paid. */
const MONTH = '2026-10';

const addStaff = async (cookie: string, body: Record<string, unknown> = {}) => {
  const res = await api().post('/api/salaries/staff').set('Cookie', cookie)
    .send({ name: 'Ali', role: 'receptionist', monthlySalary: 30000, ...body });
  expect(res.status).toBe(201);
  return res.body as { id: string };
};

const sheet = (cookie: string, month = MONTH) =>
  api().get(`/api/salaries/sheet?month=${month}`).set('Cookie', cookie);

const salaryExpenses = (gymId: string) =>
  prisma.expense.findMany({ where: { gymId, category: 'salaries' }, orderBy: { createdAt: 'asc' } });

describe('staff salaries', () => {
  it('works out the net from advances, deductions and bonuses', async () => {
    const owner = await makeGym();
    const ali = await addStaff(owner.cookie);

    for (const [kind, amount] of [['advance', 5000], ['deduction', 1000], ['bonus', 2000]] as const) {
      const res = await api().post('/api/salaries/adjustments').set('Cookie', owner.cookie)
        .send({ staffMemberId: ali.id, month: MONTH, kind, amount });
      expect(res.status).toBe(201);
    }

    const res = await sheet(owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(1);
    expect(res.body.rows[0]).toMatchObject({
      baseSalary: 30000, bonuses: 2000, advances: 5000, deductions: 1000, netPay: 26000, payment: null,
    });

    // Only the advance moved money, so only it is an expense so far.
    const expenses = await salaryExpenses(owner.gymId);
    expect(expenses.map((e) => e.amount.toNumber())).toEqual([5000]);
  });

  it('pays the first month only for the days after joining', async () => {
    const owner = await makeGym();
    await addStaff(owner.cookie, { joinedOn: '2026-10-22' });

    const res = await sheet(owner.cookie);
    // 10 of October's 31 days.
    expect(res.body.rows[0].baseSalary).toBe(Math.round((30000 * 10) / 31));

    // Not on the sheet at all before they joined.
    expect((await sheet(owner.cookie, '2026-09')).body.rows).toHaveLength(0);
  });

  it('pays a month once, books it as an expense, and locks its adjustments', async () => {
    const owner = await makeGym();
    const ali = await addStaff(owner.cookie);
    await api().post('/api/salaries/adjustments').set('Cookie', owner.cookie)
      .send({ staffMemberId: ali.id, month: MONTH, kind: 'advance', amount: 5000 });

    const paid = await api().post('/api/salaries/pay').set('Cookie', owner.cookie)
      .send({ staffMemberId: ali.id, month: MONTH });
    expect(paid.status).toBe(201);
    expect(paid.body).toMatchObject({ baseSalary: 30000, advances: 5000, netPay: 25000, method: 'cash' });

    const again = await api().post('/api/salaries/pay').set('Cookie', owner.cookie)
      .send({ staffMemberId: ali.id, month: MONTH });
    expect(again.status).toBe(409);

    const late = await api().post('/api/salaries/adjustments').set('Cookie', owner.cookie)
      .send({ staffMemberId: ali.id, month: MONTH, kind: 'deduction', amount: 500 });
    expect(late.status).toBe(409);

    // Advance + payday = the full salary, in the books exactly once.
    const expenses = await salaryExpenses(owner.gymId);
    expect(expenses.map((e) => e.amount.toNumber())).toEqual([5000, 25000]);

    // A raise afterwards does not rewrite the paid month.
    await api().put(`/api/salaries/staff/${ali.id}`).set('Cookie', owner.cookie).send({ monthlySalary: 40000 });
    expect((await sheet(owner.cookie)).body.rows[0]).toMatchObject({ baseSalary: 30000, netPay: 25000 });

    const slip = await api().get(`/api/salaries/payments/${paid.body.id}`).set('Cookie', owner.cookie);
    expect(slip.status).toBe(200);
    expect(slip.body).toMatchObject({ month: MONTH, netPay: 25000, staffMember: { name: 'Ali' } });
    expect(slip.body.adjustments).toHaveLength(1);
  });

  it('undoing a payment removes its expense too', async () => {
    const owner = await makeGym();
    const ali = await addStaff(owner.cookie);
    const paid = await api().post('/api/salaries/pay').set('Cookie', owner.cookie)
      .send({ staffMemberId: ali.id, month: MONTH });

    const undo = await api().delete(`/api/salaries/payments/${paid.body.id}`).set('Cookie', owner.cookie);
    expect(undo.status).toBe(204);
    expect(await salaryExpenses(owner.gymId)).toHaveLength(0);
    expect((await sheet(owner.cookie)).body.rows[0].payment).toBeNull();
  });

  it('will not let the Expenses page edit or delete a salary expense', async () => {
    const owner = await makeGym();
    const ali = await addStaff(owner.cookie);
    await api().post('/api/salaries/pay').set('Cookie', owner.cookie).send({ staffMemberId: ali.id, month: MONTH });
    const [expense] = await salaryExpenses(owner.gymId);

    const list = await api().get('/api/expenses').set('Cookie', owner.cookie);
    expect(list.body.data[0].fromSalaries).toBe(true);

    expect((await api().delete(`/api/expenses/${expense!.id}`).set('Cookie', owner.cookie)).status).toBe(409);
    expect((await api().put(`/api/expenses/${expense!.id}`).set('Cookie', owner.cookie).send({ amount: 1 })).status).toBe(409);
  });

  it('refuses a month that has not started', async () => {
    const owner = await makeGym();
    const ali = await addStaff(owner.cookie);
    const res = await api().post('/api/salaries/pay').set('Cookie', owner.cookie)
      .send({ staffMemberId: ali.id, month: '2999-01' });
    expect(res.status).toBe(400);
  });

  it('keeps anyone with salary records from being deleted', async () => {
    const owner = await makeGym();
    const ali = await addStaff(owner.cookie);
    await api().post('/api/salaries/adjustments').set('Cookie', owner.cookie)
      .send({ staffMemberId: ali.id, month: MONTH, kind: 'bonus', amount: 100 });
    const res = await api().delete(`/api/salaries/staff/${ali.id}`).set('Cookie', owner.cookie);
    expect(res.status).toBe(409);

    const fresh = await addStaff(owner.cookie, { name: 'Typo' });
    expect((await api().delete(`/api/salaries/staff/${fresh.id}`).set('Cookie', owner.cookie)).status).toBe(204);
  });

  it('is closed to a receptionist and to other gyms', async () => {
    const owner = await makeGym();
    const ali = await addStaff(owner.cookie);

    const receptionist = await addUser(owner.gymId, { staffPermission: 'receptionist' });
    expect((await api().get('/api/salaries/staff').set('Cookie', receptionist.cookie)).status).toBe(403);

    const other = await makeGym({ gymName: 'Other' });
    const res = await api().post('/api/salaries/pay').set('Cookie', other.cookie)
      .send({ staffMemberId: ali.id, month: MONTH });
    expect(res.status).toBe(404);
  });
});
