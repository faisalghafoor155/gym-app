import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Dumbbell, AlertTriangle, UserCog, User } from 'lucide-react';
import { inputClass, primaryButton, Spinner } from '../components/ui';
import api, { apiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { AuthResponse, Role } from '../types';
import toast from 'react-hot-toast';

/** What the invite is for, checked before the form is shown so a dead link
 *  says so immediately rather than after somebody picks a password. */
interface InvitePreview {
  name: string;
  email: string;
  role: Role;
  gymName: string;
}

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const { login } = useAuth();

  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [checking, setChecking] = useState(true);
  const [invalid, setInvalid] = useState(!token);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) { setChecking(false); return; }
    api.get<InvitePreview>(`/auth/invite?token=${encodeURIComponent(token)}`)
      .then(r => setInvite(r.data))
      .catch(() => setInvalid(true))
      .finally(() => setChecking(false));
  }, [token]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error('The two passwords do not match');
      return;
    }
    setSaving(true);
    try {
      // Accepting signs them in, so there is no second login prompt.
      const { data } = await api.post<AuthResponse>('/auth/accept-invite', { token, password });
      login(data.user, data.gym);
      toast.success(`Welcome to ${data.gym.name}`);
      navigate(data.user.role === 'member' ? '/my' : '/dashboard');
    } catch (err) {
      toast.error(apiError(err, 'Could not activate the account'));
    } finally {
      setSaving(false);
    }
  };

  const RoleIcon = invite?.role === 'member' ? User : UserCog;

  return (
    <div className="min-h-dvh bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-md p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-8">
          <Dumbbell className="text-blue-600" size={28} />
          <span className="text-xl font-bold text-gray-900">GymPro</span>
        </div>

        {checking ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : invalid || !invite ? (
          <div className="text-center py-4">
            <AlertTriangle size={36} className="text-yellow-500 mx-auto mb-3" />
            <h1 className="text-xl font-bold text-gray-900 mb-1">
              This invite is no longer valid
            </h1>
            <p className="text-gray-500 text-sm">
              Invite links last 48 hours and can be used once. Ask whoever added
              you to send a new one.
            </p>
            <Link to="/login" className="inline-block mt-6 text-sm text-blue-600 font-medium hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Welcome, {invite.name.split(' ')[0]}
            </h1>
            <p className="text-gray-500 text-sm mb-5">
              Choose a password to activate your account.
            </p>

            <div className="flex items-center gap-3 bg-blue-50/60 border border-blue-100 rounded-xl p-3 mb-6">
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <RoleIcon size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{invite.gymName}</p>
                <p className="text-xs text-gray-500 truncate">
                  {invite.role === 'member' ? 'Member' : 'Staff'} · {invite.email}
                </p>
              </div>
            </div>

            <form onSubmit={e => void handleSubmit(e)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoFocus
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="Min 8 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className={inputClass}
                  placeholder="Repeat it"
                />
              </div>
              <button type="submit" disabled={saving} className={`w-full ${primaryButton}`}>
                {saving ? 'Activating...' : 'Activate my account'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
