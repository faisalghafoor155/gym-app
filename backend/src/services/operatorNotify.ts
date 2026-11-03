import { sendMail } from './mail.js';
import { sendWhatsApp } from './whatsapp.js';

/**
 * Tells the operator — whoever approves new gyms — that one is waiting.
 *
 * A gym held for approval (`REQUIRE_GYM_APPROVAL`) is invisible until somebody
 * looks at the list, and a signup left waiting for days is a customer lost.
 * This is the "look now".
 *
 * Never throws and never blocks the signup: the gym already exists and the
 * owner has already been told to wait, so a mail transport being down must not
 * turn that into a failure. With nothing configured it logs instead.
 *
 * Email goes out first and works as soon as mail is set up. WhatsApp is sent
 * as well when `OPERATOR_WHATSAPP` is set, but it needs a template named
 * `new_gym_pending` approved in Meta's console (see whatsapp-templates.md);
 * until then it logs and the email is the notice.
 */

interface PendingGym {
  gymId: string;
  gymName: string;
  ownerName: string;
  email: string;
  phone: string | null | undefined;
}

export const notifyOperatorOfPendingGym = async (gym: PendingGym): Promise<void> => {
  const approve = `npx tsx scripts/suspendGym.ts ${gym.gymId} approve`;

  const operatorEmail = process.env.OPERATOR_EMAIL?.trim();
  if (operatorEmail) {
    await sendMail({
      to: operatorEmail,
      subject: `New gym waiting for approval: ${gym.gymName}`,
      text:
        `A new gym has signed up and cannot use the app until you approve it.\n\n` +
        `Gym:    ${gym.gymName}\n` +
        `Owner:  ${gym.ownerName}\n` +
        `Email:  ${gym.email}\n` +
        `Phone:  ${gym.phone ?? '—'}\n\n` +
        `To approve, run in the backend folder:\n  ${approve}\n\n` +
        `If you do not recognise this signup, do nothing — they stay locked out.`,
    });
  } else {
    console.log(`[operator] OPERATOR_EMAIL not set — pending gym "${gym.gymName}" (${gym.gymId}) not announced.`);
  }

  const operatorWhatsApp = process.env.OPERATOR_WHATSAPP?.trim();
  if (operatorWhatsApp) {
    await sendWhatsApp({
      to: operatorWhatsApp,
      template: 'new_gym_pending',
      variables: [gym.gymName, gym.ownerName, gym.phone ?? gym.email],
    });
  }
};
