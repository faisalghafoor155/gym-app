import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Dumbbell, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { inputClass, primaryButton } from '../components/ui';
import api, { apiError } from '../api/client';
import GoogleSignIn from '../components/GoogleSignIn';
import InstallButton from '../components/InstallButton';
import LanguageToggle from '../components/LanguageToggle';
import { useLanguage } from '../context/LanguageContext';
import { isTwoFactorChallenge, type AuthResponse, type LoginResponse } from '../types';
import toast from 'react-hot-toast';
import { takeAfterLogin } from '../utils/afterLogin';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  // Set when the first factor passed and the server asked for the second.
  // The whole password form is swapped for the code entry until it clears.
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  /** A session, or the code step when the account has a second factor. */
  const finish = (data: LoginResponse) => {
    if (isTwoFactorChallenge(data)) {
      setChallenge(data.twoFactorToken);
      return;
    }
    login(data.user, data.gym);
    navigate(takeAfterLogin() ?? '/dashboard');
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post<LoginResponse>('/auth/login', form);
      finish(data);
    } catch (err) {
      toast.error(apiError(err, t('Login failed')));
    } finally {
      setLoading(false);
    }
  };

  const handleCode = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post<AuthResponse>('/auth/two-factor/verify-login', {
        token: challenge,
        code: code.trim(),
      });
      login(data.user, data.gym);
      navigate(takeAfterLogin() ?? '/dashboard');
    } catch (err) {
      toast.error(apiError(err, t('Invalid code')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-slate-800/60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 w-full max-w-md p-6 sm:p-8">
        <div className="flex items-center justify-between gap-2 mb-8">
          <div className="flex items-center gap-2">
            <Dumbbell className="text-blue-600" size={28} />
            <span className="text-xl font-bold text-gray-900 dark:text-slate-100">GymPro</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <InstallButton variant="navbar" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-1">
          {challenge ? t('Two-factor check') : t('Welcome back')}
        </h1>
        <p className="text-gray-500 dark:text-slate-400 text-sm mb-6">
          {challenge
            ? t('Enter the 6-digit code from your authenticator app, or a backup code')
            : t('Sign in to your gym dashboard')}
        </p>

        {challenge ? (
          <form onSubmit={handleCode} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                <ShieldCheck size={14} className="inline-block mr-1 -mt-0.5 text-blue-600" />
                {t('Authentication code')}
              </label>
              <input
                type="text"
                required
                autoFocus
                autoComplete="one-time-code"
                inputMode="numeric"
                value={code}
                onChange={e => setCode(e.target.value)}
                className={`${inputClass} tracking-widest`}
                placeholder="123456"
              />
            </div>
            <button type="submit" disabled={loading} className={`w-full ${primaryButton}`}>
              {loading ? t('Verifying...') : t('Verify & Sign In')}
            </button>
            {/* A failed or abandoned challenge goes back to the password step;
                the token itself expires after 10 minutes regardless. */}
            <button
              type="button"
              onClick={() => { setChallenge(null); setCode(''); }}
              className="w-full text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
            >
              {t('Back to sign in')}
            </button>
          </form>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t('Email')}</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className={inputClass}
                  placeholder="owner@gym.com"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">{t('Password')}</label>
                  <Link to="/forgot-password" className="text-xs text-blue-600 font-medium hover:underline">
                    {t('Forgot password?')}
                  </Link>
                </div>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className={inputClass}
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className={`w-full ${primaryButton}`}
              >
                {loading ? t('Signing in...') : t('Sign In')}
              </button>
            </form>

            <GoogleSignIn onSuccess={finish} />

            <p className="text-center text-sm text-gray-500 dark:text-slate-400 mt-4">
              {t('New gym?')}{' '}
              <Link to="/register" className="text-blue-600 font-medium hover:underline">
                {t('Register here')}
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

