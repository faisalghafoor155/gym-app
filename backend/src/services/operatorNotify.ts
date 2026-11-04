import { appName, escapeHtml, sendMail } from './mail.js';
import { signGymApprovalToken } from './gymApproval.js';
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
  const appUrl = (process.env.APP_URL ?? '').trim().replace(/\/+$/, '');
  // Without APP_URL there is nowhere for a button to point, so the mail falls
  // back to naming the Platform page.
  const approveLink = appUrl
    ? `${appUrl}/api/platform/approve/${signGymApprovalToken(gym.gymId)}`
    : null;

  const operatorEmail = process.env.OPERATOR_EMAIL?.trim();
  if (operatorEmail) {
    const rows: [string, string][] = [
      ['Gym', gym.gymName],
      ['Owner', gym.ownerName],
      ['Email', gym.email],
      ['Phone', gym.phone ?? '—'],
    ];
    await sendMail({
      to: operatorEmail,
      // The inbox line says who is waiting, before the mail is even opened.
      fromName: `${gym.ownerName} · ${gym.gymName}`,
      subject: `Approve ${gym.gymName}? New gym waiting`,
      text:
        `A new gym has signed up and cannot use the app until you approve it.\n\n` +
        rows.map(([k, v]) => `${`${k}:`.padEnd(7)} ${v}`).join('\n') + '\n\n' +
        (approveLink
          ? `Approve ${gym.gymName}:\n${approveLink}\n\n`
          : `To approve, open the Platform page in the app and press Approve.\n\n`) +
        `If you do not recognise this signup, do nothing — they stay locked out.`,
      html:
        `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px">` +
        `<h2 style="margin:0 0 16px;font-size:18px">${escapeHtml(gym.gymName)} is waiting for approval</h2>` +
        `<p style="color:#374151;line-height:1.5">A new gym has signed up and cannot use ` +
        `${escapeHtml(appName())} until you approve it.</p>` +
        `<table style="font-size:14px;color:#374151;border-collapse:collapse">` +
        rows.map(([k, v]) =>
          `<tr><td style="padding:2px 16px 2px 0;color:#6b7280">${k}</td>` +
          `<td style="padding:2px 0"><strong>${escapeHtml(v)}</strong></td></tr>`,
        ).join('') +
        `</table>` +
        (approveLink
          ? `<p style="margin:24px 0"><a href="${approveLink}" ` +
            `style="background:#16a34a;color:#fff;padding:12px 20px;border-radius:10px;` +
            `text-decoration:none;font-weight:600;display:inline-block">` +
            `Approve ${escapeHtml(gym.ownerName)}'s gym</a></p>`
          : `<p style="color:#374151">To approve, open the Platform page in the app and press Approve.</p>`) +
        `<p style="color:#6b7280;font-size:13px;line-height:1.5">The button opens a page ` +
        `that asks once more before letting them in, and works for 7 days. If you do not ` +
        `recognise this signup, do nothing — they stay locked out.</p>` +
        `</div>`,
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
