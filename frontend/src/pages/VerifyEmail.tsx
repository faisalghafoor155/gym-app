import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Dumbbell, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import api, { apiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

/**
 * Where the link in the confirmation email lands.
 *
 * Verifies on arrival rather than behind a button. There is nothing to decide
 * and nothing to type — the click in the inbox was the decision, and asking
 * for a second one would only be a step to get wrong.
 *
 * Deliberately usable while signed out: somebody opening their email on a
 * different device has no session there, and the token is the credential.
 */
export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { user, isAuth, refreshSession } = useAuth();

  const [state, setState] = useState<'working' | 'done' | 'failed'>('working');
  const [message, setMessage] = useState('');

  // Strict mode mounts effects twice in development. Without this the second
  // run spends the token the first one just consumed, and a link that worked
  // reports itself as invalid.
  const attempted = useRef(false);

  useEffect(() => {
    if (!token) {
      setState('failed');
      setMessage('This link is incomplete. Open it straight from the email.');
      return;
    }
    if (attempted.current) return;
    attempted.current = true;

    api.post('/auth/verify-email', { token })
      .then(() => {
        setState('done');
        // The banner reads the session's copy, so it would otherwise keep
        // asking for something that has just been done.
        if (isAuth) void refreshSession();
      })
      .catch((err: unknown) => {
        setState('failed');
        setMessage(apiError(err, 'This link is invalid or has expired'));
      });
  }, [token, isAuth, refreshSession]);

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-slate-800/60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 w-full max-w-md p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-8">
          <Dumbbell className="text-blue-600" size={28} />
          <span className="text-xl font-bold text-gray-900 dark:text-slate-100">GymPro</span>
        </div>

        {state === 'working' && (
          <div className="text-center py-4" aria-live="polite">
            <Loader2 size={36} className="text-blue-600 mx-auto mb-3 animate-spin" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">
              Confirming your email...
            </h1>
          </div>
        )}

        {state === 'done' && (
          <div className="text-center py-4" aria-live="polite">
            <CheckCircle2 size={36} className="text-green-600 mx-auto mb-3" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-1">
              Email confirmed
            </h1>
            <p className="text-gray-500 dark:text-slate-400 text-sm">
              {user?.email
                ? `${user.email} is confirmed. A password reset will reach you here.`
                : 'Thank you — a password reset will reach you at this address.'}
            </p>
            <Link
              to={isAuth ? '/dashboard' : '/login'}
              className="inline-block mt-6 text-sm text-blue-600 font-medium hover:underline"
            >
              {isAuth ? 'Back to the dashboard' : 'Sign in'}
            </Link>
          </div>
        )}

        {state === 'failed' && (
          <div className="text-center py-4" aria-live="polite">
            <AlertTriangle size={36} className="text-yellow-500 mx-auto mb-3" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-1">
              Could not confirm this link
            </h1>
            <p className="text-gray-500 dark:text-slate-400 text-sm">{message}</p>
            <p className="text-gray-400 dark:text-slate-500 text-xs mt-3">
              Nothing is blocked by this — sign in and send yourself a new link from
              the banner at the top.
            </p>
            <Link
              to={isAuth ? '/dashboard' : '/login'}
              className="inline-block mt-6 text-sm text-blue-600 font-medium hover:underline"
            >
              {isAuth ? 'Back to the dashboard' : 'Sign in'}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
