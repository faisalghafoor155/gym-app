import prisma from '../db.js';
import { gymDay } from '../services/dates.js';
import { canWhatsApp } from '../services/phone.js';
import { planHasFeature } from '../services/subscription.js';
import { templates } from '../services/whatsapp.js';
import { messagingEnabled, sendMemberMessage } from '../services/messaging.js';

/**
 * Tells each gym's front desk, on WhatsApp, who to call about joining today.
 *
 * One message per gym, to the gym's own number from Gym settings: the leads
 * whose follow-up is today or already late, a count and the first few names.
 * Nothing is sent on a day with nobody to call — a daily "0 follow-ups" is the
 * message staff learn to ignore.
 *
 * Idempotent per gym and day: `leadDigestSentOn` is claimed with a conditional
 * update before the send, so two runs on one day (or two instances) send once.
 */

/** How many names fit in the message before it says "and N more". */
const NAMES_SHOWN = 5;

export interface LeadFollowUpRun {
  /** Gyms with at least one follow-up due today. */
  gyms: number;
  sent: number;
  /** The gym has no number WhatsApp can reach, or its plan has no WhatsApp. */
  skippedNoWhatsApp: number;
  skippedAlreadySent: number;
  failed: number;
}

export const runLeadFollowUps = async (now: Date = new Date()): Promise<LeadFollowUpRun> => {
  const run: LeadFollowUpRun = { gyms: 0, sent: 0, skippedNoWhatsApp: 0, skippedAlreadySent: 0, failed: 0 };
  const today = gymDay(now);

  const due = await prisma.lead.findMany({
    where: {
      status: { in: ['new', 'contacted', 'trial'] },
      followUpOn: { lte: today },
      gym: { suspendedAt: null },
    },
    orderBy: [{ followUpOn: 'asc' }, { createdAt: 'asc' }],
    select: { gymId: true, name: true },
  });

  const byGym = new Map<string, string[]>();
  for (const l of due) byGym.set(l.gymId, [...(byGym.get(l.gymId) ?? []), l.name]);
  run.gyms = byGym.size;
  if (byGym.size === 0 || !messagingEnabled()) return run;

  const gyms = await prisma.gym.findMany({
    where: { id: { in: [...byGym.keys()] } },
    select: { id: true, name: true, phone: true, plan: true, leadDigestSentOn: true },
  });

  for (const gym of gyms) {
    const names = byGym.get(gym.id)!;
    if (!planHasFeature(gym.plan, 'whatsapp') || !canWhatsApp(gym.phone)) {
      run.skippedNoWhatsApp++;
      continue;
    }

    const claimed = await prisma.gym.updateMany({
      where: { id: gym.id, OR: [{ leadDigestSentOn: null }, { leadDigestSentOn: { lt: today } }] },
      data: { leadDigestSentOn: today },
    });
    if (claimed.count === 0) {
      run.skippedAlreadySent++;
      continue;
    }

    const shown = names.slice(0, NAMES_SHOWN).join(', ');
    const list = names.length > NAMES_SHOWN ? `${shown} and ${names.length - NAMES_SHOWN} more` : shown;
    const result = await sendMemberMessage({
      to: gym.phone!,
      ...templates.leadFollowUps(gym.name, String(names.length), list),
    });

    if (result === 'sent') {
      run.sent++;
      continue;
    }
    run.failed++;
    // Given back, so a later run today can try again.
    await prisma.gym.update({ where: { id: gym.id }, data: { leadDigestSentOn: gym.leadDigestSentOn } });
  }

  return run;
};
