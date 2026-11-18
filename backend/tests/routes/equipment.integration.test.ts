import { beforeEach, describe, expect, it } from 'vitest';
import prisma from '../../src/db.js';
import { addMember, addUser, api, makeGym, resetDb } from '../helpers.js';

/**
 * Equipment and maintenance: the machine list, service schedule, faults, and
 * the expenses services and repairs book.
 */
beforeEach(resetDb);

const DAY = 24 * 60 * 60 * 1000;
const daysFromToday = (n: number) => new Date(Date.now() + 5 * 60 * 60 * 1000 + n * DAY).toISOString().slice(0, 10);

const addMachine = async (cookie: string, body: Record<string, unknown> = {}) => {
  const res = await api().post('/api/equipment').set('Cookie', cookie)
    .send({ name: 'Treadmill 1', category: 'cardio', brand: 'Life Fitness', cost: 450000, ...body });
  expect(res.status).toBe(201);
  return res.body as { id: string; service: { state: string; daysLeft: number | null } };
};

const maintenance = (gymId: string) =>
  prisma.expense.findMany({ where: { gymId, category: 'maintenance' }, orderBy: { createdAt: 'asc' } });

describe('equipment', () => {
  it('works out when a service is due and raises it on the alerts', async () => {
    const owner = await makeGym();
    const overdue = await addMachine(owner.cookie, { serviceEveryDays: 90, lastServicedOn: daysFromToday(-100) });
    expect(overdue.service).toMatchObject({ state: 'overdue', daysLeft: -10 });
    const soon = await addMachine(owner.cookie, { name: 'Bike', serviceEveryDays: 30, lastServicedOn: daysFromToday(-27) });
    expect(soon.service).toMatchObject({ state: 'due_soon', daysLeft: 3 });
    await addMachine(owner.cookie, { name: 'Rack', serviceEveryDays: 180, lastServicedOn: daysFromToday(-10) });
    await addMachine(owner.cookie, { name: 'Dumbbells' });

    const res = await api().get('/api/equipment/alerts').set('Cookie', owner.cookie);
    expect(res.body.serviceDue.map((m: { name: string }) => m.name)).toEqual(['Treadmill 1', 'Bike']);

    const listed = await api().get('/api/equipment').set('Cookie', owner.cookie);
    expect(listed.body.totals).toMatchObject({ machines: 4, overdue: 1, dueSoon: 1, openFaults: 0 });
  });

  it('records a service: moves the schedule on and books its cost as an expense', async () => {
    const owner = await makeGym();
    const m = await addMachine(owner.cookie, { serviceEveryDays: 90, lastServicedOn: daysFromToday(-100) });

    const res = await api().post(`/api/equipment/${m.id}/services`).set('Cookie', owner.cookie)
      .send({ servicedOn: daysFromToday(0), cost: 3500, vendor: 'FitFix' });
    expect(res.status).toBe(201);

    const one = await api().get(`/api/equipment/${m.id}`).set('Cookie', owner.cookie);
    expect(one.body.service).toMatchObject({ state: 'ok', daysLeft: 90 });
    expect(one.body.services).toHaveLength(1);
    expect((await maintenance(owner.gymId)).map((e) => [e.amount.toNumber(), e.vendor])).toEqual([[3500, 'FitFix']]);

    // The Expenses page cannot touch it; removing the service takes it back.
    const list = await api().get('/api/expenses').set('Cookie', owner.cookie);
    expect(list.body.data[0].fromEquipment).toBe(true);
    const [expense] = await maintenance(owner.gymId);
    expect((await api().delete(`/api/expenses/${expense!.id}`).set('Cookie', owner.cookie)).status).toBe(409);

    expect((await api().delete(`/api/equipment/services/${res.body.id}`).set('Cookie', owner.cookie)).status).toBe(204);
    expect(await maintenance(owner.gymId)).toHaveLength(0);
    const after = await api().get(`/api/equipment/${m.id}`).set('Cookie', owner.cookie);
    expect(after.body.lastServicedOn).toBeNull();
  });

  it('takes a fault from the desk, then marks it fixed with the repair cost', async () => {
    const owner = await makeGym();
    const m = await addMachine(owner.cookie);
    const desk = await addUser(owner.gymId, { staffPermission: 'receptionist' });

    const reported = await api().post('/api/equipment/faults').set('Cookie', desk.cookie)
      .send({ equipmentId: m.id, description: 'Belt slipping at speed 8' });
    expect(reported.status).toBe(201);
    expect(reported.body.reportedBy.id).toBe(desk.userId);

    // The desk can report, not spend.
    expect((await api().put(`/api/equipment/faults/${reported.body.id}/fix`).set('Cookie', desk.cookie).send({})).status).toBe(403);

    const fixed = await api().put(`/api/equipment/faults/${reported.body.id}/fix`).set('Cookie', owner.cookie)
      .send({ repairCost: 2000, fixNotes: 'Belt replaced' });
    expect(fixed.status).toBe(200);
    expect(fixed.body).toMatchObject({ status: 'fixed', repairCost: 2000 });
    expect((await maintenance(owner.gymId)).map((e) => e.amount.toNumber())).toEqual([2000]);

    expect((await api().put(`/api/equipment/faults/${reported.body.id}/fix`).set('Cookie', owner.cookie).send({})).status).toBe(409);
  });

  it('lets a member report a broken machine from the portal', async () => {
    const owner = await makeGym();
    const m = await addMachine(owner.cookie);
    const member = await addMember(owner.gymId);
    const login = await addUser(owner.gymId, { role: 'member', memberId: member.id });

    const machines = await api().get('/api/me/equipment').set('Cookie', login.cookie);
    expect(machines.body).toEqual([{ id: m.id, name: 'Treadmill 1', location: null }]);

    const res = await api().post('/api/me/equipment-faults').set('Cookie', login.cookie)
      .send({ equipmentId: m.id, description: 'Screen does not turn on' });
    expect(res.status).toBe(201);

    const faults = await api().get('/api/equipment/faults').set('Cookie', owner.cookie);
    expect(faults.body[0]).toMatchObject({ description: 'Screen does not turn on', reportedByMember: { id: member.id } });

    // A member cannot reach the staff side.
    expect((await api().get('/api/equipment').set('Cookie', login.cookie)).status).toBe(403);
  });

  it('retires rather than deletes a machine with history, and keeps other gyms out', async () => {
    const owner = await makeGym();
    const m = await addMachine(owner.cookie);
    await api().post('/api/equipment/faults').set('Cookie', owner.cookie).send({ equipmentId: m.id, description: 'Squeaks' });
    expect((await api().delete(`/api/equipment/${m.id}`).set('Cookie', owner.cookie)).status).toBe(409);

    const retired = await api().put(`/api/equipment/${m.id}`).set('Cookie', owner.cookie).send({ isActive: false });
    expect(retired.body.isActive).toBe(false);
    // Retired kit drops out of the alerts and the member's list.
    const alerts = await api().get('/api/equipment/alerts').set('Cookie', owner.cookie);
    expect(alerts.body.faults).toHaveLength(0);

    const other = await makeGym({ gymName: 'Other' });
    expect((await api().get(`/api/equipment/${m.id}`).set('Cookie', other.cookie)).status).toBe(404);
    expect((await api().post('/api/equipment/faults').set('Cookie', other.cookie)
      .send({ equipmentId: m.id, description: 'Not mine' })).status).toBe(404);
  });
});
