import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Dumbbell, MailCheck } from 'lucide-react';
import { inputClass, primaryButton } from '../components/ui';
import api, { apiError } from '../api/client';
import toast from 'react-hot-toast';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      toast.error(apiError(err, 'Could not send the reset link'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-md p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-8">
          <Dumbbell className="text-blue-600" size={28} />
          <span className="text-xl font-bold text-gray-900">GymPro</span>
        </div>

        {sent ? (
          <div className="text-center py-4">
            <MailCheck size={40} className="text-green-600 mx-auto mb-3" />
            <h1 className="text-xl font-bold text-gray-900 mb-1">Check your email</h1>
            <p className="text-gray-500 text-sm">
              If <span className="font-medium text-gray-700">{email}</span> is registered,
              a reset link is on its way. It expires in one hour.
            </p>
            <Link to="/login" className="inline-block mt-6 text-sm text-blue-600 font-medium hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Forgot password</h1>
            <p className="text-gray-500 text-sm mb-6">
              Enter your email and we'll send you a link to set a new one.
            </p>

            <form onSubmit={e => void handleSubmit(e)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="owner@gym.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className={`w-full ${primaryButton}`}
              >
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-4">
              Remembered it?{' '}
              <Link to="/login" className="text-blue-600 font-medium hover:underline">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

