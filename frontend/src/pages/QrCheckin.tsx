import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Dumbbell, QrCode } from 'lucide-react';
import api, { apiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Spinner } from '../components/ui';
import { rememberAfterLogin } from '../utils/afterLogin';
import type { CheckinResult } from '../types';

const money = (n: number) => `Rs ${n.toLocaleString('en-PK')}`;

type State =
  | { kind: 'working' }
  | { kind: 'done'; result: CheckinResult }
  | { kind: 'failed'; message: string };

/**
 * Where a member lands after scanning the gym's QR with their phone.
 *
 * Outside the app chrome and the usual protected route on purpose: a phone that
 * is not signed in yet should be sent to sign in and brought straight back
 * here, scan intact, rather than dropped on a home page with the code lost.
 */
export default function QrCheckin() {
  const { isAuth, loading } = useAuth();
  const { t } = useLanguage();
  const [params] = useSearchParams();
  const location = useLocation();
  const token = params.get('t') ?? '';
  const [state, setState] = useState<State>({ kind: 'working' });
  // Once per page load. React's development double-run would otherwise send two
  // check-ins, and the second, answered "already checked in", could land last
  // and replace the real result on screen.
  const sent = useRef(false);

  useEffect(() => {
    if (loading || !isAuth || sent.current) return;
    sent.current = true;
    if (!token) {
      setState({ kind: 'failed', message: t('This link has no check-in code. Scan the QR on the gym screen again.') });
      return;
    }
    api.post<CheckinResult>('/me/checkin', { token })
      .then(({ data }) => setState({ kind: 'done', result: data }))
      .catch(err => setState({ kind: 'failed', message: apiError(err, t('Could not check you in')) }));
  }, [loading, isAuth, token, t]);

  if (loading) {
    return <Shell><Spinner /></Shell>;
  }
  if (!isAuth) {
    rememberAfterLogin(location.pathname + location.search);
    return <Navigate to="/login" replace />;
  }

  return (
    <Shell>
      {state.kind === 'working' && (
        <div className="text-center space-y-3">
          <Spinner />
          <p className="text-gray-500 dark:text-slate-400">{t('Checking you in…')}</p>
        </div>
      )}
      {state.kind === 'failed' && (
        <div className="text-center space-y-4">
          <AlertCircle size={56} className="text-red-500 mx-auto" />
          <p className="text-lg font-bold text-gray-900 dark:text-slate-100">{t('Not checked in')}</p>
          <p className="text-gray-600 dark:text-slate-300">{state.message}</p>
          <p className="text-sm text-gray-400 dark:text-slate-500 flex items-center justify-center gap-1.5">
            <QrCode size={16} /> {t('Scan the code on the gym screen to try again.')}
          </p>
        </div>
      )}
      {state.kind === 'done' && <Result result={state.result} />}
      <Link to="/my" className="block text-center text-sm font-semibold text-blue-600 dark:text-blue-400 mt-8">
        {t('Open my membership')}
      </Link>
    </Shell>
  );
}

function Result({ result }: { result: CheckinResult }) {
  const { t } = useLanguage();
  const { member, membership, fee, alreadyCheckedIn } = result;
  const time = new Date(result.checkedInAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const expired = membership?.status === 'expired';
  return (
    <div className="text-center space-y-4">
      <CheckCircle2 size={64} className={`mx-auto ${alreadyCheckedIn ? 'text-amber-500' : 'text-green-600'}`} />
      <div>
        <p className="text-2xl font-extrabold text-gray-900 dark:text-slate-100">
          {alreadyCheckedIn ? t('Already checked in today') : t('You’re checked in!')}
        </p>
        <p className="text-gray-500 dark:text-slate-400 mt-1">{member.name} · {time}</p>
      </div>
      {membership ? (
        <p className={`text-sm font-semibold ${expired ? 'text-red-600' : 'text-gray-600 dark:text-slate-300'}`}>
          {membership.planName} · {expired
            ? t('membership expired — please renew at the desk')
            : t('{days} days left', { days: membership.daysLeft })}
        </p>
      ) : (
        <p className="text-sm font-semibold text-red-600">{t('No active membership — please see the desk.')}</p>
      )}
      {fee && fee.balance > 0 && (
        <p className="text-sm rounded-xl p-3 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300">
          {t('Fee due:')} <strong>{money(fee.balance)}</strong>
        </p>
      )}
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-slate-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-gray-200 dark:border-slate-800 p-8">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white">
            <Dumbbell size={20} />
          </div>
          <span className="text-xl font-black text-gray-900 dark:text-slate-100">{t('Gym Check-In')}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

