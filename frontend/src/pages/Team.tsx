import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Shield, User, UserCog, Trash2, Crown, KeyRound } from 'lucide-react';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  Page, PageHeader, Card, PageLoader, IconButton, FieldLabel,
  inputClass, primaryButton, secondaryButton, focusRing,
} from '../components/ui';
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
  // Both are destructive enough to confirm, and both name the person, so they
  // share one dialog rather than two near-identical ones.
  const [confirming, setConfirming] = useState<{ user: GymUser; action: 'delete' | 'transfer' } | null>(null);

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
    setSaving(true);
    try {
      await api.delete(`/users/${u.id}`);
      toast.success('Account removed');
      setConfirming(null);
      await load();
    } catch (err) {
      toast.error(apiError(err, 'Could not remove the account'));
    } finally {
      setSaving(false);
    }
  };

  const handleTransfer = async (u: GymUser) => {
    setSaving(true);
    try {
      const { data } = await api.post<{ message: string }>('/users/transfer-ownership', { userId: u.id });
      toast.success(data.message);
      // The signed-in account is no longer the owner, so reload to pick up the
      // new role everywhere.
      window.location.reload();
    } catch (err) {
      toast.error(apiError(err, 'Could not transfer ownership'));
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <Page>
      <PageHeader
        icon={Shield}
        title="Team & Access"
        subtitle={`${users.length} ${users.length === 1 ? 'account' : 'accounts'} can sign in`}
        action={isOwner ? (
          <div className="flex gap-2">
            <button onClick={() => setShowMemberLogin(true)} className={secondaryButton}>
              <KeyRound size={15} /> <span className="hidden sm:inline">Member login</span>
            </button>
            <button onClick={() => setShowStaff(true)} className={primaryButton}>
              <Plus size={16} />
              <span className="hidden sm:inline">Add Staff</span><span className="sm:hidden">Staff</span>
            </button>
          </div>
        ) : undefined}
      />

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
            <Card key={u.id} className={`p-4 ${u.isActive ? '' : 'bg-gray-50/60'}`}>
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
                          className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 ${focusRing}`}
                        >
                          {u.isActive ? 'Revoke' : 'Restore'}
                        </button>
                        {u.role === 'staff' && (
                          <IconButton
                            icon={Crown} tone="purple"
                            label={`Transfer ownership to ${u.name}`}
                            onClick={() => setConfirming({ user: u, action: 'transfer' })}
                          />
                        )}
                        <IconButton
                          icon={Trash2} tone="red"
                          label={`Remove ${u.name}`}
                          onClick={() => setConfirming({ user: u, action: 'delete' })}
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
            </Card>
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
              <FieldLabel required>Name</FieldLabel>
              <input required value={staffForm.name}
                onChange={e => setStaffForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Helper's full name"
                className={inputClass} />
            </div>
            <div>
              <FieldLabel required>Email</FieldLabel>
              <input type="email" required value={staffForm.email}
                onChange={e => setStaffForm(f => ({ ...f, email: e.target.value }))}
                placeholder="helper@gym.com"
                className={inputClass} />
            </div>
            <div>
              <FieldLabel required>Temporary password</FieldLabel>
              <input type="password" required minLength={8} value={staffForm.password}
                onChange={e => setStaffForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Min 8 characters"
                className={inputClass} />
              <p className="text-xs text-gray-400 mt-1">Share this with them; they can change it after signing in.</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowStaff(false)}
                className={`flex-1 ${secondaryButton}`}>
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className={`flex-1 ${primaryButton}`}>
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
                  <FieldLabel required>Member</FieldLabel>
                  <select required value={loginForm.memberId}
                    onChange={e => setLoginForm(f => ({ ...f, memberId: e.target.value }))}
                    className={inputClass}>
                    <option value="">Select member...</option>
                    {membersWithoutLogin.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel required>Email</FieldLabel>
                  <input type="email" required value={loginForm.email}
                    onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="member@example.com"
                    className={inputClass} />
                </div>
                <div>
                  <FieldLabel required>Temporary password</FieldLabel>
                  <input type="password" required minLength={8} value={loginForm.password}
                    onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min 8 characters"
                    className={inputClass} />
                </div>
              </>
            )}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowMemberLogin(false)}
                className={`flex-1 ${secondaryButton}`}>
                Cancel
              </button>
              <button type="submit" disabled={saving || membersWithoutLogin.length === 0}
                className={`flex-1 ${primaryButton}`}>
                {saving ? 'Creating...' : 'Create Login'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {confirming && (
        confirming.action === 'delete' ? (
          <ConfirmDialog
            title="Remove access"
            message={`Remove ${confirming.user.name}'s access? They will no longer be able to sign in. Their member record, if they have one, is untouched.`}
            confirmLabel="Remove"
            busy={saving}
            onConfirm={() => void handleDelete(confirming.user)}
            onCancel={() => setConfirming(null)}
          />
        ) : (
          <ConfirmDialog
            title="Transfer ownership"
            message={`Make ${confirming.user.name} the owner of this gym? You will become staff and lose owner-only access, including this page.`}
            confirmLabel="Transfer ownership"
            tone="primary"
            busy={saving}
            onConfirm={() => void handleTransfer(confirming.user)}
            onCancel={() => setConfirming(null)}
          />
        )
      )}
    </Page>
  );
}

