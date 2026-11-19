import prisma from '../db.js';
import { findInactive } from '../controllers/inactiveController.js';
import { membersAt } from './branches.js';
import { memberStatusWhere, currentMembershipWhere, startOfDay } from './membership.js';
import { sendMemberMessage } from './messaging.js';
import { toWhatsAppNumber } from './phone.js';

/**
 * Bulk WhatsApp: who a broadcast goes to, what it says, and sending it.
 *
 * Meta lets a business open a conversation only with a template approved in
 * advance, so a broadcast cannot be free text. Each kind below is one approved
 * template; the gym fills in its slots (the offer, the date) and the member's
 * name and the gym's name are added here. The exact bodies to register in
 * Meta's console are in `whatsapp-templates.md`, and must match `body` below
 * word for word apart from the slots.
 */

export const BROADCAST_TEMPLATES = {
  offer: {
    meta: 'gym_offer',
    label: 'Offer / discount',
    fields: [
      { key: 'offer', label: 'The offer', example: '20% off on all 3-month plans' },
      { key: 'until', label: 'Valid until', example: '15 April' },
    ],
    body: 'Hi {name}! {gym} has a special offer for you: {offer}. Valid until {until}. Visit the front desk to avail it.',
  },
  new_batch: {
    meta: 'gym_new_batch',
    label: 'New batch / class',
    fields: [
      { key: 'batch', label: 'Batch', example: 'ladies morning yoga' },
      { key: 'starts', label: 'Starting', example: 'Monday 1 December, 7 am' },
    ],
    body: 'Hi {name}, {gym} is starting a new {batch} batch on {starts}. Ask at the front desk to join.',
  },
  closed: {
    meta: 'gym_closed_notice',
    label: 'Gym closed notice',
    fields: [
      { key: 'when', label: 'Closed on', example: 'Friday 25 December' },
      { key: 'reason', label: 'Reason', example: 'Quaid Day' },
    ],
    body: 'Hi {name}, {gym} will be closed on {when} for {reason}. We will be open as usual after that.',
  },
  announcement: {
    meta: 'gym_announcement',
    label: 'Announcement',
    fields: [
      { key: 'message', label: 'Message', example: 'new AC has been installed in the cardio area' },
    ],
    body: 'Hi {name}, an update from {gym}: {message}.',
  },
} as const;

export type BroadcastTemplate = keyof typeof BROADCAST_TEMPLATES;
export type Audience = 'active' | 'expired' | 'inactive' | 'leads';

/** Meta's ceiling is far higher; this is a guard against a mis-click on a big gym. */
export const MAX_RECIPIENTS = 3000;

/** The variables in Meta's positional order: name, gym, then the template's own fields. */
export const variablesFor = (
  template: BroadcastTemplate, name: string, gym: string, values: Record<string, string>,
): string[] => [name, gym, ...BROADCAST_TEMPLATES[template].fields.map(f => values[f.key] ?? '')];

interface Candidate {
  memberId?: string;
  leadId?: string;
  name: string;
  phone: string | null;
  optedOut: boolean;
}

/** Everyone in an audience, before anyone is filtered out. */
const candidates = async (
  gymId: string, branchId: string | undefined, audience: Audience, inactiveDays: number, now: Date,
): Promise<Candidate[]> => {
  const member = (m: { id: string; name: string; phone: string | null; whatsappOptOut: boolean }): Candidate =>
    ({ memberId: m.id, name: m.name, phone: m.phone, optedOut: m.whatsappOptOut });
  const select = { id: true, name: true, phone: true, whatsappOptOut: true } as const;
  const scope = membersAt({ branchId });

  switch (audience) {
    // Everyone whose membership is still running, expiring ones included.
    case 'active':
      return (await prisma.member.findMany({
        where: {
          gymId, ...scope, status: 'active',
          memberships: { some: { ...currentMembershipWhere, status: 'active', expiryDate: { gte: startOfDay(now) } } },
        },
        select,
      })).map(member);
    // Ran out recently, the same window as the Members page's Expired tab:
    // the ones a renewal offer can still win back.
    case 'expired':
      return (await prisma.member.findMany({ where: { gymId, ...scope, ...memberStatusWhere('expired', now) }, select })).map(member);
    case 'inactive':
      return (await findInactive(gymId, inactiveDays, now, scope)).map(member);
    // Enquiries still being chased. Leads are gym-wide, like the Leads page.
    case 'leads':
      return (await prisma.lead.findMany({
        where: { gymId, status: { in: ['new', 'contacted', 'trial'] } },
        select: { id: true, name: true, phone: true },
      })).map(l => ({ leadId: l.id, name: l.name, phone: l.phone, optedOut: false }));
  }
};

/**
 * Who a broadcast would reach, and who it would not and why.
 *
 * One message per number: a family sharing a phone, or a lead who is also a
 * member, hears it once.
 */
export const resolveAudience = async (
  gymId: string, branchId: string | undefined, audience: Audience, inactiveDays: number, now = new Date(),
) => {
  const all = await candidates(gymId, branchId, audience, inactiveDays, now);
  const seen = new Set<string>();
  const reachable: (Candidate & { phone: string })[] = [];
  let optedOut = 0;
  let noNumber = 0;
  let duplicates = 0;
  for (const c of all) {
    if (c.optedOut) { optedOut++; continue; }
    const number = toWhatsAppNumber(c.phone);
    if (!number) { noNumber++; continue; }
    if (seen.has(number)) { duplicates++; continue; }
    seen.add(number);
    reachable.push({ ...c, phone: c.phone! });
  }
  return { total: all.length, reachable, optedOut, noNumber, duplicates };
};

/** How long to wait between messages, so a big send stays inside Meta's rate limits. */
const gap = (): number => Number(process.env.BROADCAST_DELAY_MS ?? (process.env.NODE_ENV === 'test' ? 0 : 150));
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Broadcasts this process is sending right now, so one is never sent twice at once. */
const running = new Set<string>();

/**
 * Sends a broadcast's pending messages, one after another, and marks it done.
 *
 * Runs after the request that created it has returned: a few hundred messages
 * take minutes, and the desk should not sit watching a spinner. Each recipient
 * is claimed (`pending` → `sending`) before its message goes, so a second
 * process resuming the same broadcast skips it rather than sending again.
 * Never throws.
 */
export const runBroadcast = async (id: string): Promise<void> => {
  if (running.has(id)) return;
  running.add(id);
  try {
    const b = await prisma.broadcast.findUnique({ where: { id }, include: { gym: { select: { name: true } } } });
    if (!b || b.status !== 'sending') return;
    const template = b.template as BroadcastTemplate;
    const values = b.values as Record<string, string>;

    for (;;) {
      const batch = await prisma.broadcastRecipient.findMany({
        where: { broadcastId: id, status: 'pending' },
        take: 50,
      });
      if (!batch.length) break;
      for (const r of batch) {
        const { count } = await prisma.broadcastRecipient.updateMany({
          where: { id: r.id, status: 'pending' },
          data: { status: 'sending' },
        });
        if (!count) continue;
        const result = await sendMemberMessage({
          to: r.phone,
          template: BROADCAST_TEMPLATES[template].meta,
          variables: variablesFor(template, r.name, b.gym.name, values),
        });
        await prisma.broadcastRecipient.update({
          where: { id: r.id },
          data: { status: result, ...(result === 'sent' && { sentAt: new Date() }) },
        });
        await pause(gap());
      }
    }
    await prisma.broadcast.update({ where: { id }, data: { status: 'done', finishedAt: new Date() } });
  } catch (err) {
    console.error(`[broadcast] ${id} stopped:`, err);
  } finally {
    running.delete(id);
  }
};

/**
 * Picks up broadcasts a restart interrupted.
 *
 * A recipient left `sending` was mid-message when the process died; whether
 * it reached them cannot be known, so it is marked failed rather than sent a
 * second time.
 */
export const resumeBroadcasts = async (): Promise<number> => {
  const open = await prisma.broadcast.findMany({ where: { status: 'sending' }, select: { id: true } });
  for (const { id } of open) {
    if (running.has(id)) continue;
    await prisma.broadcastRecipient.updateMany({ where: { broadcastId: id, status: 'sending' }, data: { status: 'failed' } });
    void runBroadcast(id);
  }
  return open.length;
};
