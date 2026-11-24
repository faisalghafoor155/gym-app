import { beforeEach, describe, expect, it } from 'vitest';
import prisma from '../../src/db.js';
import { DEFAULT_WAIVER_TEXT } from '../../src/services/waiver.js';
import { addMember, addMembership, addUser, api, makeGym, resetDb } from '../helpers.js';

/**
 * Health declarations: the questionnaire and signed waiver.
 *
 * What matters is that a signing is a record: it keeps the waiver as it read
 * when signed, it is never overwritten, and the member list carries enough of
 * it for the health badge.
 */
beforeEach(resetDb);

const SIGNATURE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const sign = (cookie: string, memberId: string, body: Record<string, unknown> = {}) =>
  api().post(`/api/members/${memberId}/health`).set('Cookie', cookie).send({
    conditions: ['bp', 'injury'],
    details: 'Knee surgery 2024',
    signedName: 'Ali Khan',
    signature: SIGNATURE,
    waiverAccepted: true,
    ...body,
  });

const health = (cookie: string, memberId: string) =>
  api().get(`/api/members/${memberId}/health`).set('Cookie', cookie);

describe('health declarations', () => {
  it('asks a new member to sign, then records what they declared', async () => {
    const owner = await makeGym();
    const member = await addMember(owner.gymId);

    const before = await health(owner.cookie, member.id);
    expect(before.status).toBe(200);
    expect(before.body).toMatchObject({ current: null, needsSigning: true, waiverText: DEFAULT_WAIVER_TEXT });

    const res = await sign(owner.cookie, member.id);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ conditions: ['bp', 'injury'], signedName: 'Ali Khan', waiverText: DEFAULT_WAIVER_TEXT });

    const after = await health(owner.cookie, member.id);
    expect(after.body.needsSigning).toBe(false);
    expect(after.body.current.id).toBe(res.body.id);

    // The member list carries the badge's data, not the signature.
    const list = await api().get('/api/members').set('Cookie', owner.cookie);
    const row = list.body.data.find((m: { id: string }) => m.id === member.id);
    expect(row.health).toMatchObject({ conditions: ['bp', 'injury'] });
    expect(row.health.signature).toBeUndefined();
  });

  it('refuses a declaration without the waiver ticked, or with a malformed signature', async () => {
    const owner = await makeGym();
    const member = await addMember(owner.gymId);
    expect((await sign(owner.cookie, member.id, { waiverAccepted: false })).status).toBe(400);
    expect((await sign(owner.cookie, member.id, { signature: 'not an image' })).status).toBe(400);
    expect((await sign(owner.cookie, member.id, { conditions: ['flu'] })).status).toBe(400);
  });

  it('records a declaration with no drawn signature — the ticked waiver and typed name are enough', async () => {
    const owner = await makeGym();
    const member = await addMember(owner.gymId);

    const res = await sign(owner.cookie, member.id, { signature: undefined });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ signedName: 'Ali Khan', signature: null });

    const after = await health(owner.cookie, member.id);
    expect(after.body.needsSigning).toBe(false);
  });

  it("keeps the gym's wording as it read when signed, and every earlier signing", async () => {
    const owner = await makeGym();
    const member = await addMember(owner.gymId);
    await prisma.gym.update({ where: { id: owner.gymId }, data: { waiverText: 'Version one.' } });
    await sign(owner.cookie, member.id, { conditions: [] });

    await prisma.gym.update({ where: { id: owner.gymId }, data: { waiverText: 'Version two.' } });
    await sign(owner.cookie, member.id, { conditions: ['heart'] });

    const res = await health(owner.cookie, member.id);
    expect(res.body.current).toMatchObject({ waiverText: 'Version two.', conditions: ['heart'] });
    expect(res.body.history).toHaveLength(1);
    expect(res.body.history[0]).toMatchObject({ waiverText: 'Version one.', conditions: [] });
  });

  it('asks again after a renewal when the gym wants that', async () => {
    const owner = await makeGym();
    const member = await addMember(owner.gymId);
    await sign(owner.cookie, member.id);
    await prisma.gym.update({ where: { id: owner.gymId }, data: { waiverOnRenewal: true } });

    // A membership sold after they signed: a renewal.
    await addMembership(owner.gymId, member.id);
    expect((await health(owner.cookie, member.id)).body.needsSigning).toBe(true);

    await sign(owner.cookie, member.id);
    expect((await health(owner.cookie, member.id)).body.needsSigning).toBe(false);
  });

  it('lets any staff read it but only member managers sign, and keeps other gyms out', async () => {
    const owner = await makeGym();
    const member = await addMember(owner.gymId);
    await sign(owner.cookie, member.id);

    const desk = await addUser(owner.gymId, { staffPermission: 'inventory_manager' });
    expect((await health(desk.cookie, member.id)).status).toBe(200);
    expect((await sign(desk.cookie, member.id)).status).toBe(403);

    const other = await makeGym({ gymName: 'Other' });
    expect((await health(other.cookie, member.id)).status).toBe(404);
    expect((await sign(other.cookie, member.id)).status).toBe(404);
  });
});
