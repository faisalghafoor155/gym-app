import { Prisma } from '@prisma/client';
import prisma from '../db.js';
import { membershipBalances, type MembershipBalance } from '../services/balances.js';
import { addDays, daysUntil, LAPSED_AFTER_DAYS, startOfDay } from '../services/membership.js';
import { canWhatsApp } from '../services/phone.js';
import { planHasFeature } from '../services/subscription.js';
import { templates } from '../services/whatsapp.js';
import { messagingEnabled, sendMemberMessage } from '../services/messaging.js';

/**
 * Reminds members who still owe part of their membership fee.
 *
 * At most once every `EVERY_DAYS` days per membership — a weekly nudge, not a
 * daily one. A member who owes Rs. 2,000 and is told so every morning stops
 * reading the gym's messages, including the expiry notice that actually needs
 * reading.
 *
 * WhatsApp only. The expiry notice goes both ways because missing it costs the
 * member their access; this one costs nothing to miss once, and an email
 * nobody opens is not worth the duplicate.
 *
 * A balance split into installments is chased by its dates instead: one
 * reminder `INSTALLMENT_NOTICE_DAYS` days before each part falls due, and the
 * weekly nudge only once a part is overdue, for what is overdue. A member
 * keeping to the plan they agreed owes nothing yet, and must not be told
 * every week that they do.
 *
 * Idempotent the same way the expiry job is: a ReminderLog row is claimed
 * before the send, and two runs on the same day collide on its unique key.
 */

/** Days between reminders for one membership. Zero turns the job off. */
const EVERY_DAYS = Number(process.env.DUES_REMINDER_EVERY_DAYS ?? 7);

/** How many days before an installment falls due its reminder goes out. */
export const INSTALLMENT_NOTICE_DAYS = 2;

export interface DuesRun {
  /** Current memberships with money still owed, across every gym. */
  owing: number;
  sent: number;
  /** Reminded within the last `EVERY_DAYS` days. */
  skippedRecently: number;
  /** Already claimed today, by an earlier run or another instance. */
  skippedAlreadySent: number;
  /** No number WhatsApp can reach, or the member opted out. */
  skippedNoWhatsApp: number;
  /** On an installment plan with nothing overdue and no part due soon. */
  skippedNotDue: number;
  failed: number;
}

const emptyRun = (): DuesRun => ({
  owing: 0,
  sent: 0,
  skippedRecently: 0,
  skippedAlreadySent: 0,
  skippedNoWhatsApp: 0,
  skippedNotDue: 0,
  failed: 0,
});

type DuesKind = 'duesOutstanding' | 'installmentDue';

const claim = async (
  b: MembershipBalance, kind: DuesKind, sentOn: Date, sentTo: string,
): Promise<boolean> => {
  try {
    await prisma.reminderLog.create({
      data: {
        gymId: b.gymId,
        membershipId: b.membershipId,
        kind,
        channel: 'whatsapp',
        sentOn,
        sentTo,
      },
    });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return false;
    throw err;
  }
};

export const runDuesReminders = async (now: Date = new Date()): Promise<DuesRun> => {
  const run = emptyRun();
  const today = startOfDay(now);

  // Somebody gone long enough to have lapsed is off the roster; chasing them
  // for a balance belongs to a phone call, not an automated message.
  const balances = await membershipBalances(
    // Suspended gyms are left out, as with the expiry notices.
    { expiryDate: { gte: addDays(today, -LAPSED_AFTER_DAYS) }, gym: { suspendedAt: null } },
    now,
  );
  run.owing = balances.length;

  // Not configured, or configured off, is not failing to send.
  if (EVERY_DAYS <= 0 || !messagingEnabled() || balances.length === 0) return run;

  // One query for "who was reminded, and when", rather than one per member.
  // Reaches back far enough for both kinds of reminder.
  const recent = await prisma.reminderLog.findMany({
    where: {
      membershipId: { in: balances.map(b => b.membershipId) },
      kind: { in: ['duesOutstanding', 'installmentDue'] },
      channel: 'whatsapp',
      sentOn: { gt: addDays(today, -Math.max(EVERY_DAYS, INSTALLMENT_NOTICE_DAYS + 1)) },
    },
    select: { membershipId: true, kind: true, sentOn: true },
  });
  const remindedRecently = new Set(
    recent
      .filter(r => r.kind === 'duesOutstanding' && r.sentOn > addDays(today, -EVERY_DAYS))
      .map(r => r.membershipId),
  );
  const lastInstallmentNotice = new Map<string, Date>();
  for (const r of recent) {
    if (r.kind !== 'installmentDue') continue;
    const seen = lastInstallmentNotice.get(r.membershipId);
    if (!seen || r.sentOn > seen) lastInstallmentNotice.set(r.membershipId, r.sentOn);
  }

  for (const b of balances) {
    if (b.member.status !== 'active') continue;
    if (!planHasFeature(b.gym.plan, 'whatsapp')) continue;

    // What to say, and under which kind — or nothing yet.
    let kind: DuesKind = 'duesOutstanding';
    let amount = `Rs. ${b.outstanding.toLocaleString('en-PK')}`;
    if (b.installments.length > 0) {
      const soon = b.nextDue && daysUntil(b.nextDue.dueDate, now) <= INSTALLMENT_NOTICE_DAYS;
      if (b.overdue > 0) {
        amount = `Rs. ${b.overdue.toLocaleString('en-PK')}`;
      } else if (b.nextDue && soon) {
        // Once per part: a notice sent inside this part's window already
        // covers it.
        const last = lastInstallmentNotice.get(b.membershipId);
        if (last && last >= addDays(startOfDay(b.nextDue.dueDate), -INSTALLMENT_NOTICE_DAYS)) {
          run.skippedRecently++;
          continue;
        }
        kind = 'installmentDue';
        const due = b.nextDue.dueDate.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
        amount = `Rs. ${b.nextDue.remaining.toLocaleString('en-PK')} (due ${due})`;
      } else {
        run.skippedNotDue++;
        continue;
      }
    }

    if (b.member.whatsappOptOut || !canWhatsApp(b.member.phone)) {
      run.skippedNoWhatsApp++;
      continue;
    }
    if (kind === 'duesOutstanding' && remindedRecently.has(b.membershipId)) {
      run.skippedRecently++;
      continue;
    }
    if (!(await claim(b, kind, today, b.member.phone!))) {
      run.skippedAlreadySent++;
      continue;
    }

    const result = await sendMemberMessage({
      to: b.member.phone!,
      ...templates.duesReminder(b.member.name, b.gym.name, amount, b.membership.planName),
    });

    if (result === 'sent') {
      run.sent++;
      continue;
    }

    run.failed++;
    // Given back so tomorrow's run tries again, as the expiry job does: one
    // refusal must not silently push the next reminder a week out.
    await prisma.reminderLog.deleteMany({
      where: {
        membershipId: b.membershipId, kind, channel: 'whatsapp', sentOn: today,
      },
    });
  }

  return run;
};
