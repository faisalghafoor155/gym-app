import { beforeEach, describe, expect, it } from 'vitest';
import prisma from '../../src/db.js';
import { addUser, api, makeGym, resetDb } from '../helpers.js';

/**
 * Branches: what one branch sees, who may check in where, and staff placed at
 * a branch staying there.
 */
beforeEach(resetDb);

const newBranch = async (cookie: string, name: string) => {
  const res = await api().post('/api/branches').set('Cookie', cookie).send({ name });
  expect(res.status).toBe(201);
  return res.body as { id: string };
};

const addMemberAt = async (cookie: string, branchId: string, body: Record<string, unknown> = {}) => {
  const res = await api().post('/api/members').set('Cookie', cookie).set('X-Branch-Id', branchId)
    .send({ name: `Member ${Math.random().toString(36).slice(2, 7)}`, ...body });
  expect(res.status).toBe(201);
  return res.body as { id: string; branchId: string };
};

describe('branches', () => {
  it('gives every gym a main branch and lets the owner open more', async () => {
    const owner = await makeGym();
    const list = await api().get('/api/branches').set('Cookie', owner.cookie);
    expect(list.body.branches).toHaveLength(1);
    expect(list.body.branches[0]).toMatchObject({ name: 'Main Branch', isMain: true });

    await newBranch(owner.cookie, 'DHA');
    const after = await api().get('/api/branches').set('Cookie', owner.cookie);
    expect(after.body.branches.map((b: { name: string }) => b.name)).toEqual(['Main Branch', 'DHA']);

    const main = after.body.branches[0].id;
    expect((await api().delete(`/api/branches/${main}`).set('Cookie', owner.cookie)).status).toBe(409);
  });

  it('files a new member at the branch in use and scopes the roster to it', async () => {
    const owner = await makeGym();
    const { body } = await api().get('/api/branches').set('Cookie', owner.cookie);
    const main = body.branches[0].id;
    const dha = (await newBranch(owner.cookie, 'DHA')).id;

    const a = await addMemberAt(owner.cookie, main);
    const b = await addMemberAt(owner.cookie, dha);
    const both = await addMemberAt(owner.cookie, dha, { allBranches: true });
    expect(a.branchId).toBe(main);
    expect(b.branchId).toBe(dha);

    const ids = async (branch?: string) => {
      const req = api().get('/api/members?status=none').set('Cookie', owner.cookie);
      const res = branch ? await req.set('X-Branch-Id', branch) : await req;
      return res.body.data.map((m: { id: string }) => m.id).sort();
    };
    expect(await ids()).toEqual([a.id, b.id, both.id].sort());
    // Main's desk sees its own and the member allowed everywhere.
    expect(await ids(main)).toEqual([a.id, both.id].sort());
    expect(await ids(dha)).toEqual([b.id, both.id].sort());
  });

  it('turns a member away at a branch that is not theirs, unless they may use all', async () => {
    const owner = await makeGym();
    const main = (await api().get('/api/branches').set('Cookie', owner.cookie)).body.branches[0].id;
    const dha = (await newBranch(owner.cookie, 'DHA')).id;
    const local = await addMemberAt(owner.cookie, dha);
    const roamer = await addMemberAt(owner.cookie, dha, { allBranches: true });

    const at = (branch: string, memberId: string) =>
      api().post('/api/attendance/checkin').set('Cookie', owner.cookie).set('X-Branch-Id', branch).send({ memberId });

    const refused = await at(main, local.id);
    expect(refused.status).toBe(403);
    expect(refused.body.reason).toBe('other_branch');
    expect((await at(dha, local.id)).status).toBe(201);
    expect((await at(main, roamer.id)).status).toBe(201);

    const row = await prisma.attendance.findFirst({ where: { memberId: roamer.id } });
    expect(row!.branchId).toBe(main);

    const today = await api().get('/api/attendance/today').set('Cookie', owner.cookie).set('X-Branch-Id', dha);
    expect(today.body.map((r: { memberId: string }) => r.memberId)).toEqual([local.id]);
  });

  it('keeps staff placed at a branch there, whatever they ask for', async () => {
    const owner = await makeGym();
    const main = (await api().get('/api/branches').set('Cookie', owner.cookie)).body.branches[0].id;
    const dha = (await newBranch(owner.cookie, 'DHA')).id;
    await addMemberAt(owner.cookie, main);
    const dhaMember = await addMemberAt(owner.cookie, dha);

    const desk = await addUser(owner.gymId, { staffPermission: 'manager' });
    expect((await api().put(`/api/branches/staff/${desk.userId}`).set('Cookie', owner.cookie).send({ branchId: dha })).status).toBe(200);

    const list = await api().get('/api/branches').set('Cookie', desk.cookie);
    expect(list.body).toMatchObject({ fixed: true, current: dha });
    expect(list.body.branches).toHaveLength(1);

    const roster = await api().get('/api/members?status=none').set('Cookie', desk.cookie).set('X-Branch-Id', main);
    expect(roster.body.data.map((m: { id: string }) => m.id)).toEqual([dhaMember.id]);

    // Only the owner places staff or opens branches.
    expect((await api().post('/api/branches').set('Cookie', desk.cookie).send({ name: 'X' })).status).toBe(403);
  });

  it('lines the branches up for the owner', async () => {
    const owner = await makeGym();
    const main = (await api().get('/api/branches').set('Cookie', owner.cookie)).body.branches[0].id;
    const dha = (await newBranch(owner.cookie, 'DHA')).id;
    await addMemberAt(owner.cookie, main);
    await addMemberAt(owner.cookie, dha);
    await addMemberAt(owner.cookie, dha);

    const res = await api().get('/api/branches/overview').set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.branches.map((b: { name: string; members: number }) => [b.name, b.members]))
      .toEqual([['Main Branch', 1], ['DHA', 2]]);
  });

  it('ignores a branch id from another gym', async () => {
    const owner = await makeGym();
    const other = await makeGym({ gymName: 'Other' });
    const foreign = (await newBranch(other.cookie, 'Theirs')).id;
    const res = await api().get('/api/branches').set('Cookie', owner.cookie).set('X-Branch-Id', foreign);
    expect(res.body.current).toBeNull();
    expect((await api().post('/api/members').set('Cookie', owner.cookie).send({ name: 'Z', branchId: foreign })).status).toBe(404);
  });
});
