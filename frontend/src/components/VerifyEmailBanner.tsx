import { useState } from 'react';
import { MailWarning } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { apiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

/**
 * Says the account's email has not been confirmed, and offers to send the link
 * again.
 *
 * A strip rather than anything that blocks. Nothing is withheld from an
 * unverified account: a gym that signed up this morning has to be able to
 * enrol its first member this morning, and gating that behind an email nobody
 * has opened yet would be a worse problem than the one it solves.
 *
 * What it is actually for is the typo. The address is where a password reset
 * goes, so a wrong one is a lockout waiting for the day it is needed — and the
 * only moment anyone can still fix it cheaply is now, while they are signed in.
 * That is what the wording leans on, rather than nagging about a rule.
 *
 * Absent for accounts created by invite: following a link sent to the address
 * already proved it, so they are verified on arrival and never see this.
 */
export default function VerifyEmailBanner() {
  const { user, isAuth } = useAuth();
  const { t } = useLanguage();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // `undefined` means a server that predates the field — treated as verified,
  // so an older backend does not light this up for everybody.
  if (!isAuth || user?.emailVerified !== false) return null;

  const resend = async () => {
    setSending(true);
    try {
      const { data } = await api.post<{ emailed: boolean }>('/auth/resend-verification');
      setSent(true);
      // The server says whether a transport actually took it. Claiming "sent"
      // where no mail is configured would leave somebody waiting for a message
      // that only ever reached the container log.
      toast.success(
        data.emailed
          ? t('Confirmation sent to {email}', { email: user.email })
          : t('Email is not set up on this server — ask whoever installed it for the link.'),
      );
    } catch (err) {
      toast.error(apiError(err, t('Could not send the confirmation')));
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-2 text-xs font-medium text-amber-900 bg-amber-100 border-b border-amber-200 dark:text-amber-200 dark:bg-amber-500/15 dark:border-amber-500/25 shrink-0"
    >
      <MailWarning size={14} className="shrink-0" />
      <span>
        <span className="font-semibold">{user.email}</span>{' '}
        {t('is not confirmed yet — a password reset would go here.')}
      </span>
      <button
        type="button"
        onClick={() => void resend()}
        disabled={sending || sent}
        className="underline underline-offset-2 font-semibold hover:no-underline disabled:opacity-60 disabled:no-underline"
      >
        {sending ? t('Sending...') : sent ? t('Sent — check your inbox') : t('Send the link again')}
      </button>
    </div>
  );
}
