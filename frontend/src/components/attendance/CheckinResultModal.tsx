import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Clock, CalendarX2, Phone, Wallet } from 'lucide-react';
import { useLanguage, type TVars } from '../../context/LanguageContext';

import type { CheckinFee, Membership } from '../../types';

/**
 * What the front desk sees the moment somebody checks in.
 *
 * The old inline strip said the name and little else, which is the one thing
 * the person at the counter already knows — they are looking straight at them.
 * What they cannot see is whether the membership has run out, and that is the
 * only moment the gym gets to say so: the member is standing there, and five
 * seconds later they are on the floor.
 *
 * So the expiry leads. It is stated three ways on purpose — a colour that
 * carries across the room, a sentence in plain words, and the date itself for
 * anyone who wants to check — because a desk during evening rush reads one of
 * those and not the others.
 *
 * It dismisses itself, since nobody can press a button while a queue is
 * forming, but the timer is long enough to read and the panel can be closed
 * early. Escape or a click outside also close it.
 */

export interface CheckinDisplay {
  name: string;
  memberNo?: string | null;
  phone?: string | null;
  photo?: string | null;
  membership: Membership | null;
  /** Fee, paid and balance for the current membership, when known. */
  fee?: CheckinFee | null;
  alreadyCheckedIn: boolean;
}

/** How long the panel stays up before clearing itself, in milliseconds. */
const DISMISS_MS = 6000;

const initials = (name: string): string =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

const asDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-PK', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

const rs = (n: number): string => `Rs. ${n.toLocaleString()}`;

/**
 * The one thing the desk has to act on, worked out once.
 *
 * `already` is deliberately not a tone of its own: somebody scanning twice is
 * unremarkable, and what still matters about them is whether their membership
 * has run out. So it changes the headline and leaves the colour alone.
 */
type Tone = 'ok' | 'warn' | 'bad';

const readStanding = (
  membership: Membership | null,
  t: (english: string, vars?: TVars) => string,
): { tone: Tone; headline: string; detail: string | null } => {
  if (!membership) {
    return {
      tone: 'bad',
      headline: t('No membership'),
      detail: t('Nothing on file — sell them one before they train.'),
    };
  }
  if (membership.status === 'expired') {
    const ago = Math.abs(membership.daysLeft);
    return {
      tone: 'bad',
      headline: t('Membership expired'),
      detail: ago === 0
        ? t('Ran out today. Take the renewal now.')
        : ago === 1
          ? t('Ran out {count} day ago. Take the renewal now.', { count: ago })
          : t('Ran out {count} days ago. Take the renewal now.', { count: ago }),
    };
  }
  if (membership.status === 'suspended') {
    return {
      tone: 'warn',
      headline: t('Membership suspended'),
      detail: t('On hold — resume it before they train.'),
    };
  }
  if (membership.status === 'expiring') {
    const count = membership.daysLeft;
    return {
      tone: 'warn',
      headline: count === 1
        ? t('Expires in {count} day', { count })
        : t('Expires in {count} days', { count }),
      detail: t('Worth asking for the renewal while they are here.'),
    };
  }
  const count = membership.daysLeft;
  return {
    tone: 'ok',
    headline: t('Membership active'),
    detail: count === 1 ? t('{count} day left.', { count }) : t('{count} days left.', { count }),
  };
};

const TONES: Record<Tone, {
  panel: string; badge: string; text: string; Icon: typeof CheckCircle2;
}> = {
  ok: {
    panel: 'border-green-400 bg-green-50 dark:bg-green-950/30 dark:border-green-500/40',
    badge: 'bg-green-600',
    text: 'text-green-800 dark:text-green-300',
    Icon: CheckCircle2,
  },
  warn: {
    panel: 'border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-500/40',
    badge: 'bg-amber-500',
    text: 'text-amber-800 dark:text-amber-300',
    Icon: AlertTriangle,
  },
  bad: {
    panel: 'border-red-400 bg-red-50 dark:bg-red-950/30 dark:border-red-500/40',
    badge: 'bg-red-600',
    text: 'text-red-800 dark:text-red-300',
    Icon: XCircle,
  },
};

export default function CheckinResultModal(
  { result, onClose }: { result: CheckinDisplay; onClose: () => void },
) {
  const { t } = useLanguage();
  const { name, memberNo, phone, photo, membership, fee, alreadyCheckedIn } = result;
  const { tone, headline, detail } = readStanding(membership, t);
  const { panel, badge, text, Icon } = TONES[tone];

  // Kept in a ref so restarting the countdown for a new member does not
  // depend on the caller passing a stable handler.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [remaining, setRemaining] = useState(DISMISS_MS);

  useEffect(() => {
    setRemaining(DISMISS_MS);
    // Keyed on the member so a second person scanning restarts the countdown
    // rather than inheriting whatever was left of the previous one.
    const tick = setInterval(() => {
      setRemaining(ms => {
        if (ms <= 100) {
          clearInterval(tick);
          onCloseRef.current();
          return 0;
        }
        return ms - 100;
      });
    }, 100);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearInterval(tick);
      window.removeEventListener('keydown', onKey);
    };
  }, [name, memberNo]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        role="alertdialog"
        aria-live="assertive"
        aria-label={`${name}. ${headline}`}
        className={`relative w-full max-w-md rounded-2xl border-4 shadow-2xl overflow-hidden ${panel}`}
      >
        {/* The countdown is shown rather than left to surprise: a panel that
            vanishes mid-sentence reads as a glitch. */}
        <div
          className={`h-1.5 ${badge} transition-[width] duration-100 ease-linear`}
          style={{ width: `${(remaining / DISMISS_MS) * 100}%` }}
        />

        <div className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 overflow-hidden">
              {photo
                ? <img src={photo} alt="" className="w-full h-full object-cover" />
                : <span className="text-white font-bold text-2xl">{initials(name)}</span>}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-2xl text-gray-900 dark:text-slate-100 truncate">{name}</p>
              {memberNo && (
                <p className="text-sm font-mono text-gray-500 dark:text-slate-400">{memberNo}</p>
              )}
              {phone && (
                <p className="text-sm text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Phone size={12} /> {phone}
                </p>
              )}
              <p className="text-sm font-semibold text-gray-700 dark:text-slate-300 mt-1 flex items-center gap-1.5">
                {alreadyCheckedIn
                  ? <><Clock size={14} /> {t('Already checked in today')}</>
                  : <><CheckCircle2 size={14} className="text-green-600" /> {t('Checked in')}</>}
              </p>
            </div>
          </div>

          {/* The standing, which is the whole reason this panel is large. */}
          <div className={`mt-5 rounded-xl border-2 px-4 py-3 ${panel}`}>
            <p className={`flex items-center gap-2 font-bold text-lg ${text}`}>
              <Icon size={22} className="shrink-0" /> {headline}
            </p>
            {detail && (
              <p className={`text-sm mt-1 ${text}`}>{detail}</p>
            )}
            {membership && (
              <dl className="mt-3 pt-3 border-t border-current/15 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-gray-600 dark:text-slate-400">{t('Plan')}</dt>
                <dd className="font-semibold text-gray-900 dark:text-slate-100 text-right truncate">
                  {membership.planName}
                </dd>
                <dt className="text-gray-600 dark:text-slate-400 flex items-center gap-1.5">
                  <CalendarX2 size={13} /> {t('Expiry')}
                </dt>
                <dd className="font-semibold text-gray-900 dark:text-slate-100 text-right">
                  {asDate(membership.expiryDate)}
                </dd>
                {/* A free plan has no fee to talk about. */}
                {fee && fee.amount > 0 && (
                  <>
                    <dt className="text-gray-600 dark:text-slate-400 flex items-center gap-1.5">
                      <Wallet size={13} /> {t('Fee')}
                    </dt>
                    <dd className="font-semibold text-gray-900 dark:text-slate-100 text-right">
                      {rs(fee.amount)}
                    </dd>
                    <dt className="text-gray-600 dark:text-slate-400">{t('Paid')}</dt>
                    <dd className="font-semibold text-gray-900 dark:text-slate-100 text-right">
                      {rs(fee.paid)}
                    </dd>
                    <dt className="text-gray-600 dark:text-slate-400">{t('Balance due')}</dt>
                    <dd className={`font-bold text-right ${
                      fee.balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'
                    }`}>
                      {fee.balance > 0 ? rs(fee.balance) : t('Fully paid')}
                    </dd>
                  </>
                )}
              </dl>
            )}
          </div>

          <button
            onClick={onClose}
            className="mt-5 w-full py-2.5 rounded-xl font-semibold bg-gray-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 transition-opacity"
          >
            {t('Next member')}
          </button>
        </div>
      </div>
    </div>
  );
}
