import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Shield, User, UserCog, Trash2, Crown, KeyRound } from 'lucide-react';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  Page, PageHeader, Card, PageLoader, IconButton, FieldLabel,
  inputClass, primaryButton, secondaryButton, focusRing,
} from '../components/ui';
import api, { apiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { GymUser, Member, Role, StaffSeats, TeamResponse } from '../types';
import toast from 'react-hot-toast';

/** How a new account gets its password: emailed invite, or one the owner
 *  types. Invite is the default; the manual route exists for the helper whose
 *  email does not work. */
type AccountMethod = 'invite' | 'password';

/** What the API answers when an account was created by invite. */
interface InviteResult {
  emailed: boolean;
  /** Only present when the mail could not be sent, so the owner can pass the
   *  link on themselves. */
  link?: string;
}

const roleStyles: Record<Role, { label: string; icon: typeof Shield; className: string }> = {
  owner: { label: 'Owner', icon: Crown, className: 'bg-purple-50 text-purple-700 border-purple-200' },
  staff: { label: 'Staff', icon: UserCog, className: 'bg-blue-50 text-blue-700 border-blue-200' },
  member: { label: 'Member', icon: User, className: 'bg-gray-50 text-gray-600 border-gray-200' },
};

/**
 * Picks how the new account gets a password, and renders the password field
 * only when the owner has chosen to set one. Shared by both create forms so
 * the two cannot drift apart.
 */
function PasswordMethod({ method, onMethod, password, onPassword }: {
  method: AccountMethod;
  onMethod: (m: AccountMethod) => void;
  password: string;
  onPassword: (p: string) => void;
}) {
  return (
    <div className="space-y-3">
      <FieldLabel required>How should they get in?</FieldLabel>
      <div className="grid grid-cols-2 gap-2">
        {([
          { value: 'invite', title: 'Email an invite', hint: 'They pick their own password' },
          { value: 'password', title: 'Set a password', hint: 'You share it with them' },
        ] as const).map(o => (
          <button
            key={o.value}
            type="button"
            onClick={() => onMethod(o.value)}
            aria-pressed={method === o.value}
            className={`border rounded-xl py-2.5 px-3 text-left transition-all ${focusRing} ${
              method === o.value
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <p className="font-semibold text-xs">{o.title}</p>
            <p className="text-xs opacity-60 mt-0.5 leading-snug">{o.hint}</p>
          </button>
        ))}
      </div>

      {method === 'password' ? (
        <div>
          <FieldLabel required>Temporary password</FieldLabel>
          <input
            type="password" required minLength={8} value={password}
            onChange={e => onPassword(e.target.value)}
            placeholder="Min 8 characters"
            className={inputClass}
          />
          <p className="text-xs text-gray-400 mt-1">
            Share this with them; they can change it after signing in.
          </p>
        </div>
      ) : (
        <p className="text-xs text-gray-500 bg-blue-50/60 border border-blue-100 rounded-xl px-3 py-2.5 leading-relaxed">
          They get an email with a link to choose their own password. The link
          lasts 48 hours and works once — you never see the password.
        </p>
      )}
    </div>
  );
}

export default function Team() {
  const { user: me, isOwner } = useAuth();
  const [params, setParams] = useSearchParams();
  const [users, setUsers] = useState<GymUser[]>([]);
  const [seats, setSeats] = useState<StaffSeats | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showStaff, setShowStaff] = useState(false);
  const [showMemberLogin, setShowMemberLogin] = useState(false);
  const [staffForm, setStaffForm] = useState({ name: '', email: '', password: '' });
  const [loginForm, setLoginForm] = useState({ memberId: '', email: '', password: '' });
  // How the new account gets its password. Inviting is the default: an owner
  // who never learns the password cannot leak it.
  const [staffMethod, setStaffMethod] = useState<AccountMethod>('invite');
  const [loginMethod, setLoginMethod] = useState<AccountMethod>('invite');
  // Shown when an invite could not be emailed, so the link is not lost.
  const [manualLink, setManualLink] = useState<string | null>(null);
  // Both are destructive enough to confirm, and both name the person, so they
  // share one dialog rather than two near-identical ones.
  const [confirming, setConfirming] = useState<{ user: GymUser; action: 'delete' | 'transfer' } | null>(null);
  // The account whose role is being changed, and what to. Confirmed rather than
  // applied on click: promoting somebody to staff hands them the till.
  const [changingRole, setChangingRole] =
    useState<{ user: GymUser; to: Exclude<Role, 'owner'> } | null>(null);

  const load = () =>
    Promise.all([
      api.get<TeamResponse>('/users').then(r => {
        setUsers(r.data.users);
        setSeats(r.data.seats);
      }),
      api.get<Member[]>('/members').then(r => setMembers(r.data)),
    ])
      .catch(err => toast.error(apiError(err, 'Could not load accounts')))
      .finally(() => setLoading(false));

  useEffect(() => { void load(); }, []);

  // The dashboard's "Add Staff" shortcut lands here as ?new=1. The param is
  // cleared once used, so refreshing does not reopen the modal.
  useEffect(() => {
    if (!params.get('new')) return;
    setShowStaff(true);
    setParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('new');
      return next;
    }, { replace: true });
    // Runs on the landing param only — this is a hint, not a live binding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const membersWithoutLogin = members.filter(
    m => !users.some(u => u.memberId === m.id),
  );

  /**
   * Reports how the account was handed over. An invite that could not be
   * emailed is not a failure — the account exists — but the owner has to be
   * told, or they will wait for a message that never arrives.
   */
  const announce = (invite: InviteResult | null, created: string) => {
    if (!invite) { toast.success(`${created} — they can sign in now`); return; }
    if (invite.emailed) { toast.success(`${created} — invite sent`); return; }
    setManualLink(invite.link ?? null);
    toast(`${created}, but the invite could not be emailed`, { icon: '⚠️' });
  };

  const handleAddStaff = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Omitting the password is what tells the API to invite instead.
      const { data } = await api.post<{ invite: InviteResult | null }>('/users/staff', {
        name: staffForm.name,
        email: staffForm.email,
        ...(staffMethod === 'password' && { password: staffForm.password }),
      });
      announce(data.invite, 'Staff account created');
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
      const { data } = await api.post<{ invite: InviteResult | null }>('/users/member-login', {
        memberId: loginForm.memberId,
        email: loginForm.email,
        ...(loginMethod === 'password' && { password: loginForm.password }),
      });
      announce(data.invite, 'Member login created');
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

  /**
   * Moves an account between staff and member.
   *
   * Not a route to owner: promoting a second owner is what transferring
   * ownership does, in one step, so the gym is never left with two owners or
   * none. The API refuses `owner` here for the same reason.
   *
   * The change takes effect on their next request — the server ends their open
   * sessions, so a demoted staff member does not keep staff access on a device
   * they left signed in.
   */
  const changeRole = async (u: GymUser, role: Exclude<Role, 'owner'>) => {
    setSaving(true);
    try {
      await api.put(`/users/${u.id}`, { role });
      toast.success(`${u.name} is now ${role}`);
      setChangingRole(null);
      await load();
    } catch (err) {
      toast.error(apiError(err, 'Could not change the role'));
    } finally {
      setSaving(false);
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

  // Null while the first load is in flight — treated as not full, so the button
  // is never disabled on a count nobody has yet.
  const seatsFull = seats !== null && seats.remaining === 0;

  if (loading) return <PageLoader />;

  return (
    <Page>
      <PageHeader
        icon={Shield}
        title="Staff & Logins"
        subtitle={
          seats
            ? `${users.length} ${users.length === 1 ? 'account' : 'accounts'} can sign in · ${seats.used} of ${seats.limit} staff seats used`
            : `${users.length} ${users.length === 1 ? 'account' : 'accounts'} can sign in`
        }
        action={isOwner ? (
          <div className="flex gap-2">
            <button onClick={() => setShowMemberLogin(true)} className={secondaryButton}>
              <KeyRound size={15} /> <span className="hidden sm:inline">Member login</span>
            </button>
            {/* Disabled once the seats are gone, with the reason on hover —
                the API refuses it anyway, so offering the form would only
                waste the owner's typing. Member logins are not capped. */}
            <button
              onClick={() => setShowStaff(true)}
              disabled={seatsFull}
              title={seatsFull
                ? `All ${seats?.limit} staff seats are in use. Remove an account to free one.`
                : undefined}
              className={primaryButton}
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Add Staff</span><span className="sm:hidden">Staff</span>
            </button>
          </div>
        ) : undefined}
      />

      {isOwner && seatsFull && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 flex items-start gap-3">
          <UserCog size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            All {seats?.limit} staff seats are in use. To add someone else, remove an
            account below — revoking access alone does not free the seat, since the
            account keeps its email address and can be restored.
          </p>
        </div>
      )}

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
                        {/* A member login is wired to a Member record, and
                            `/my` reads that link — so it has no role to change.
                            The API refuses it too. */}
                        {!u.memberId && (
                          <button
                            onClick={() => setChangingRole({
                              user: u,
                              to: u.role === 'staff' ? 'member' : 'staff',
                            })}
                            // Promoting takes a seat, so it is barred when
                            // there are none. Demoting frees one and is
                            // always allowed.
                            disabled={u.role !== 'staff' && seatsFull}
                            title={u.role !== 'staff' && seatsFull
                              ? `All ${seats?.limit} staff seats are in use.`
                              : undefined}
                            className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent ${focusRing}`}
                          >
                            {u.role === 'staff' ? 'Make member' : 'Make staff'}
                          </button>
                        )}
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
              Staff run the front desk: members, attendance, plans, supplement sales, and
              taking fees. They see only the payments they recorded themselves — never the
              gym's totals — and cannot edit the books or manage accounts.
            </p>
            {seats && (
              <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                {seats.remaining} of {seats.limit} staff{' '}
                {seats.remaining === 1 ? 'seat' : 'seats'} left.
              </p>
            )}
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
            <PasswordMethod
              method={staffMethod}
              onMethod={setStaffMethod}
              password={staffForm.password}
              onPassword={p => setStaffForm(f => ({ ...f, password: p }))}
            />
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
                <PasswordMethod
                  method={loginMethod}
                  onMethod={setLoginMethod}
                  password={loginForm.password}
                  onPassword={p => setLoginForm(f => ({ ...f, password: p }))}
                />
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

      {/* The account exists but nothing was emailed, so the link has to be
          handed over by hand — losing this dialog means re-inviting. */}
      {manualLink && (
        <Modal title="Send this link to them" onClose={() => setManualLink(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              The account was created, but the invite email could not be sent —
              no mail service is set up. Copy this link and give it to them
              yourself. It lasts 48 hours and works once.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <p className="text-xs text-gray-700 break-all font-mono leading-relaxed">
                {manualLink}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(manualLink)
                    .then(() => toast.success('Link copied'))
                    .catch(() => toast.error('Could not copy — select the text instead'));
                }}
                className={`flex-1 ${primaryButton}`}
              >
                Copy link
              </button>
              <button type="button" onClick={() => setManualLink(null)}
                className={`flex-1 ${secondaryButton}`}>
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}

      {changingRole && (
        <ConfirmDialog
          title={changingRole.to === 'staff' ? 'Make staff' : 'Make member'}
          message={changingRole.to === 'staff'
            ? `Give ${changingRole.user.name} staff access? They will be able to add members, take attendance, sell supplements and record fees — but not see the gym's totals or manage accounts.`
            : `Drop ${changingRole.user.name} to member access? They will lose the front desk entirely and see only their own data. Any open session of theirs ends now.`}
          confirmLabel={changingRole.to === 'staff' ? 'Make staff' : 'Make member'}
          tone={changingRole.to === 'staff' ? 'primary' : undefined}
          busy={saving}
          onConfirm={() => void changeRole(changingRole.user, changingRole.to)}
          onCancel={() => setChangingRole(null)}
        />
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

