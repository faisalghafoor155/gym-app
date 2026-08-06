import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Shield, User, UserCog, Trash2, Crown, KeyRound } from 'lucide-react';
import Modal from '../components/Modal';
import api, { apiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { GymUser, Member, Role } from '../types';
import toast from 'react-hot-toast';

const roleStyles: Record<Role, { label: string; icon: typeof Shield; className: string }> = {
  owner: { label: 'Owner', icon: Crown, className: 'bg-purple-50 text-purple-700 border-purple-200' },
  staff: { label: 'Staff', icon: UserCog, className: 'bg-blue-50 text-blue-700 border-blue-200' },
  member: { label: 'Member', icon: User, className: 'bg-gray-50 text-gray-600 border-gray-200' },
};

export default function Team() {
  const { user: me, isOwner } = useAuth();
  const [users, setUsers] = useState<GymUser[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showStaff, setShowStaff] = useState(false);
  const [showMemberLogin, setShowMemberLogin] = useState(false);
  const [staffForm, setStaffForm] = useState({ name: '', email: '', password: '' });
  const [loginForm, setLoginForm] = useState({ memberId: '', email: '', password: '' });

  const load = () =>
    Promise.all([
      api.get<GymUser[]>('/users').then(r => setUsers(r.data)),
      api.get<Member[]>('/members').then(r => setMembers(r.data)),
    ])
      .catch(err => toast.error(apiError(err, 'Could not load accounts')))
      .finally(() => setLoading(false));

  useEffect(() => { void load(); }, []);

  const membersWithoutLogin = members.filter(
    m => !users.some(u => u.memberId === m.id),
  );

  const handleAddStaff = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/users/staff', staffForm);
      toast.success('Staff account created');
      setShowStaff(false);
      setStaffForm({ name: '', email: '', password: '' });
      await load();
    } catch (err) {
      toast.error(apiError(err, 'Could not create the account'));
    } finally {
      setSaving(false);
    }
  };

  const handleAddMemberLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/users/member-login', loginForm);
      toast.success('Member login created');
      setShowMemberLogin(false);
      setLoginForm({ memberId: '', email: '', password: '' });
      await load();
    } catch (err) {
      toast.error(apiError(err, 'Could not create the login'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: GymUser) => {
    try {
      await api.put(`/users/${u.id}`, { isActive: !u.isActive });
      toast.success(u.isActive ? 'Access revoked' : 'Access restored');
      await load();
    } catch (err) {
      toast.error(apiError(err, 'Could not update the account'));
    }
  };

  const handleDelete = async (u: GymUser) => {
    if (!window.confirm(`Remove ${u.name}'s access? They will no longer be able to sign in.`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast.success('Account removed');
      await load();
    } catch (err) {
      toast.error(apiError(err, 'Could not remove the account'));
    }
  };

  const handleTransfer = async (u: GymUser) => {
    if (!window.confirm(
      `Make ${u.name} the owner of this gym?\n\nYou will become staff and lose owner-only access.`
    )) return;
    try {
      const { data } = await api.post<{ message: string }>('/users/transfer-ownership', { userId: u.id });
      toast.success(data.message);
      // The signed-in account is no longer the owner, so reload to pick up the
      // new role everywhere.
      window.location.reload();
    } catch (err) {
      toast.error(apiError(err, 'Could not transfer ownership'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Team &amp; Access</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} accounts can sign in</p>
        </div>
        {isOwner && (
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setShowMemberLogin(true)}
              className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-3 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">
              <KeyRound size={15} /> <span className="hidden sm:inline">Member login</span>
            </button>
            <button onClick={() => setShowStaff(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-3 sm:px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700">
              <Plus size={16} /> <span className="hidden sm:inline">Add Staff</span><span className="sm:hidden">Staff</span>
            </button>
          </div>
        )}
      </div>

      {!isOwner && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 flex items-start gap-3">
          <Shield size={18} className="text-blue-600 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            You can see who has access, but only the gym owner can add or remove accounts.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {users.map(u => {
          const style = roleStyles[u.role];
          const RoleIcon = style.icon;
          const isMe = u.id === me?.id;
          return (
            <div key={u.id} className={`bg-white rounded-xl border p-4 ${
              u.isActive ? 'border-gray-200' : 'border-gray-200 bg-gray-50/60'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`font-semibold truncate ${u.isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                      {u.name}
                    </p>
                    {isMe && <span className="text-xs text-gray-400">(you)</span>}
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${style.className}`}>
                      <RoleIcon size={11} /> {style.label}
                    </span>
                    {!u.isActive && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                        Revoked
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate">{u.email}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {u.lastLoginAt
                      ? `Last signed in ${new Date(u.lastLoginAt).toLocaleDateString()}`
                      : 'Never signed in'}
                  </p>
                </div>

                {isOwner && !isMe && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {u.role !== 'owner' && (
                      <>
                        <button
                          onClick={() => void toggleActive(u)}
                          className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                        >
                          {u.isActive ? 'Revoke' : 'Restore'}
                        </button>
                        {u.role === 'staff' && (
                          <button
                            onClick={() => void handleTransfer(u)}
                            title="Transfer ownership"
                            aria-label={`Transfer ownership to ${u.name}`}
                            className="text-gray-400 hover:text-purple-600 p-1.5"
                          >
                            <Crown size={15} />
                          </button>
                        )}
                        <button
                          onClick={() => void handleDelete(u)}
                          aria-label={`Remove ${u.name}`}
                          className="text-gray-400 hover:text-red-600 p-1.5"
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showStaff && (
        <Modal title="Add Staff Account" onClose={() => setShowStaff(false)}>
          <form onSubmit={e => void handleAddStaff(e)} className="space-y-4">
            <p className="text-sm text-gray-500">
              Staff can manage members, attendance, fees, plans and supplements — but cannot
              add accounts or transfer ownership.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input required value={staffForm.name}
                onChange={e => setStaffForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Helper's full name"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input type="email" required value={staffForm.email}
                onChange={e => setStaffForm(f => ({ ...f, email: e.target.value }))}
                placeholder="helper@gym.com"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Temporary password *</label>
              <input type="password" required minLength={8} value={staffForm.password}
                onChange={e => setStaffForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Min 8 characters"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="text-xs text-gray-400 mt-1">Share this with them; they can change it after signing in.</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowStaff(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                {saving ? 'Creating...' : 'Create Account'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showMemberLogin && (
        <Modal title="Give a Member Login Access" onClose={() => setShowMemberLogin(false)}>
          <form onSubmit={e => void handleAddMemberLogin(e)} className="space-y-4">
            <p className="text-sm text-gray-500">
              The member will be able to see only their own plan, attendance and dues.
            </p>
            {membersWithoutLogin.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">
                Every member already has a login.
              </p>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Member *</label>
                  <select required value={loginForm.memberId}
                    onChange={e => setLoginForm(f => ({ ...f, memberId: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select member...</option>
                    {membersWithoutLogin.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input type="email" required value={loginForm.email}
                    onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="member@example.com"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Temporary password *</label>
                  <input type="password" required minLength={8} value={loginForm.password}
                    onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min 8 characters"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </>
            )}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowMemberLogin(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={saving || membersWithoutLogin.length === 0}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                {saving ? 'Creating...' : 'Create Login'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
