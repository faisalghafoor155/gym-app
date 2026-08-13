import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Dumbbell, AlertTriangle } from 'lucide-react';
import { inputClass, primaryButton } from '../components/ui';
import api, { apiError } from '../api/client';
import toast from 'react-hot-toast';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error('The two passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      toast.success('Password updated. Please sign in.');
      navigate('/login');
    } catch (err) {
      toast.error(apiError(err, 'Could not reset the password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-slate-800/60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 w-full max-w-md p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-8">
          <Dumbbell className="text-blue-600" size={28} />
          <span className="text-xl font-bold text-gray-900 dark:text-slate-100">GymPro</span>
        </div>

        {!token ? (
          <div className="text-center py-4">
            <AlertTriangle size={36} className="text-yellow-500 mx-auto mb-3" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-1">Link is incomplete</h1>
            <p className="text-gray-500 dark:text-slate-400 text-sm">
              Open the reset link from your email, or request a new one.
            </p>
            <Link to="/forgot-password" className="inline-block mt-6 text-sm text-blue-600 font-medium hover:underline">
              Request a new link
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-1">Set a new password</h1>
            <p className="text-gray-500 dark:text-slate-400 text-sm mb-6">Choose something at least 8 characters long.</p>

            <form onSubmit={e => void handleSubmit(e)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">New password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="Min 8 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Confirm password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className={inputClass}
                  placeholder="Repeat it"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className={`w-full ${primaryButton}`}
              >
                {loading ? 'Saving...' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

