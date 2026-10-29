import { beforeEach, describe, expect, it, vi } from 'vitest';

import { addMember, api, makeGym, resetDb } from '../helpers.js';

/**
 * Inviting somebody by WhatsApp instead of email.
 *
 * The owner picks the channel. Choosing WhatsApp still issues a working link,
 * but no mail goes out — a member who never checks their inbox should not be
 * sent one, and a gym with no mail set up should not see a "could not email"
 * warning for a message it never meant to send.
 */

// Stubbed and reporting success, so a mail that does go out would show up here.
const sent = vi.hoisted(() => [] as { to: string }[]);
vi.mock('../../src/services/mail.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/mail.js')>();
  return {
    ...actual,
    mailEnabled: true,
    sendMail: vi.fn((mail: { to: string }) => {
      sent.push(mail);
      return Promise.resolve(true);
    }),
  };
});

beforeEach(async () => {
  await resetDb();
  sent.length = 0;
});

const tokenOf = (link: string) => new URL(link).searchParams.get('token')!;

describe('WhatsApp invites', () => {
  it('gives a member a working link without emailing them', async () => {
    const owner = await makeGym();
    const member = await addMember(owner.gymId);

    const res = await api().post('/api/users/member-login').set('Cookie', owner.cookie)
      .send({ memberId: member.id, email: 'member@example.com', sendEmail: false });

    expect(res.status).toBe(201);
    expect(res.body.invite.emailed).toBe(false);
    expect(sent).toHaveLength(0);

    const accepted = await api().post('/api/auth/accept-invite')
      .send({ token: tokenOf(res.body.invite.link), password: 'a-new-password-123' });
    expect(accepted.status).toBe(200);
  });

  it('does the same for staff', async () => {
    const owner = await makeGym();

    const res = await api().post('/api/users/staff').set('Cookie', owner.cookie)
      .send({ name: 'Helper', email: 'helper@example.com', staffPermission: 'receptionist', sendEmail: false });

    expect(res.status).toBe(201);
    expect(res.body.invite.link).toMatch(/\/accept-invite\?token=/);
    expect(sent).toHaveLength(0);
  });

  it('still emails when the owner picks email', async () => {
    const owner = await makeGym();
    const member = await addMember(owner.gymId);

    const res = await api().post('/api/users/member-login').set('Cookie', owner.cookie)
      .send({ memberId: member.id, email: 'member@example.com' });

    expect(res.status).toBe(201);
    expect(res.body.invite.emailed).toBe(true);
    expect(sent.map(m => m.to)).toEqual(['member@example.com']);
  });
});
