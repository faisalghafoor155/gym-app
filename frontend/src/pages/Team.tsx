import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Shield, User, UserCog, Trash2, Crown, KeyRound, Upload, Building2 } from 'lucide-react';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  Page, PageHeader, Card, PageLoader, EmptyState, IconButton, FieldLabel,
  inputClass, primaryButton, secondaryButton, focusRing,
} from '../components/ui';
import api, { apiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { GymUser, GymSettings, Member, Paginated, Role, StaffSeats, TeamResponse, StaffPermission } from '../types';
import { getPermissionLabel } from '../utils/permissions';
import PermissionPicker from '../components/team/PermissionPicker';
import toast from 'react-hot-toast';

/** How a new account gets its password: emailed invite, or one the owner
 *  types. Invite is the default; the manual route exists for the helper whose
 *  email does not work. */
type AccountMethod = 'invite' | 'password';

/** What the API answers when an account was created by invite. */
interface InviteResult {
  emailed: boolean;
  /** Always returned, so the owner can also send it on WhatsApp. */
  link: string;
}

/** The invite on screen after creating or re-inviting an account. */
interface SharedInvite extends InviteResult {
  name: string;
}

/** A WhatsApp message the owner forwards; no number, so they pick the chat. */
const whatsappInviteUrl = (invite: SharedInvite) =>
  `https://wa.me/?text=${encodeURIComponent(
    `Assalam o Alaikum ${invite.name}, aap ko gym app mein add kar diya gaya hai. ` +
    `Ye link khol kar apna password set karein (48 ghante ke liye, sirf aik dafa):
${invite.link}`,
  )}`;

const roleStyles: Record<Role, { label: string; icon: typeof Shield; className: string }> = {
  owner: { label: 'Owner', icon: Crown, className: 'bg-purple-50 dark:bg-purple-500/15 text-purple-700 border-purple-200 dark:border-purple-500/20' },
  staff: { label: 'Staff', icon: UserCog, className: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 border-blue-200 dark:border-blue-500/20' },
  member: { label: 'Member', icon: User, className: 'bg-gray-50 dark:bg-slate-800/60 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-800' },
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
      {/* Names the pair of choices below rather than a single field. */}
      <FieldLabel id="access-mode-label" required>How should they get in?</FieldLabel>
      <div
        role="group"
        aria-labelledby="access-mode-label"
        className="grid grid-cols-2 gap-2"
      >
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
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/15 text-blue-700'
                : 'border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 hover:border-gray-300'
            }`}
          >
            <p className="font-semibold text-xs">{o.title}</p>
            <p className="text-xs opacity-60 mt-0.5 leading-snug">{o.hint}</p>
          </button>
        ))}
      </div>

      {method === 'password' ? (
        <div>
          <FieldLabel htmlFor="team-temporary-password" required>Temporary password</FieldLabel>
          <input id="team-temporary-password"
            type="password" required minLength={8} value={password}
            onChange={e => onPassword(e.target.value)}
            placeholder="Min 8 characters"
            className={inputClass}
          />
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
            Share this with them; they can change it after signing in.
          </p>
        </div>
      ) : (
        <p className="text-xs text-gray-500 dark:text-slate-400 bg-blue-50/60 border border-blue-100 dark:border-blue-500/20 rounded-xl px-3 py-2.5 leading-relaxed">
          They get an email with a link to choose their own password. The link
          lasts 48 hours and works once — you never see the password.
        </p>
      )}
    </div>
  );
}

export default function Team() {
  const { user: me, isOwner, gym, updateGym } = useAuth();
  const [params, setParams] = useSearchParams();
  const [users, setUsers] = useState<GymUser[]>([]);
  const [seats, setSeats] = useState<StaffSeats | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showStaff, setShowStaff] = useState(false);
  const [showMemberLogin, setShowMemberLogin] = useState(false);
  const [staffForm, setStaffForm] = useState({ name: '', email: '', password: '', staffPermission: 'receptionist' as StaffPermission });
  const [loginForm, setLoginForm] = useState({ memberId: '', email: '', password: '' });
  // How the new account gets its password. Inviting is the default: an owner
  // who never learns the password cannot leak it.
  const [staffMethod, setStaffMethod] = useState<AccountMethod>('invite');
  const [loginMethod, setLoginMethod] = useState<AccountMethod>('invite');
  // The invite just issued, so its link can be copied or sent on WhatsApp.
  const [sharedInvite, setSharedInvite] = useState<SharedInvite | null>(null);
  const [reinviting, setReinviting] = useState<string | null>(null);
  // Both are destructive enough to confirm, and both name the person, so they
  // share one dialog rather than two near-identical ones.
  const [confirming, setConfirming] =
    useState<{ user: GymUser; action: 'delete' | 'transfer' | 'revoke' } | null>(null);
  // The account whose role is being changed, and what to. Confirmed rather than
  // applied on click: promoting somebody to staff hands them the till.
  const [changingRole, setChangingRole] =
    useState<{ user: GymUser; to: Exclude<Role, 'owner'> } | null>(null);
  
  const [editingPermissions, setEditingPermissions] = useState<GymUser | null>(null);

  /**
   * The gym's own identity, as it appears on every receipt a member keeps.
   *
   * Editable here for the first time: these were written once at signup and
   * never again, so a typo in the name printed on every receipt could only be
   * fixed in the database.
   */
  const [profile, setProfile] = useState<{
    name: string;
    ownerName: string;
    phone: string;
    address: string;
    logo: string | null;
  }>({ name: '', ownerName: '', phone: '', address: '', logo: null });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo image must be under 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setProfile(p => ({ ...p, logo: ev.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setProfile(p => ({ ...p, logo: null }));
  };

  // Gym-wide pricing. Held as a string so an emptied field does not become 0
  // while the owner is mid-edit.
  const [ptFeeInput, setPtFeeInput] = useState('');
  /**
   * Where members are told to send money, per channel. Read out at the front
   * desk when somebody pays online, so what matters is that it is exactly what
   * the owner typed — free text, not a parsed account number.
   */
  const [accounts, setAccounts] = useState({ easypaisa: '', jazzcash: '', bank: '' });
  const [savingSettings, setSavingSettings] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState<StaffPermission>('receptionist');

  useEffect(() => {
    if (editingPermissions?.staffPermission) {
      setSelectedPermission(editingPermissions.staffPermission);
    } else {
      setSelectedPermission('receptionist');
    }
  }, [editingPermissions]);

  const handleUpdatePermissions = async () => {
    if (!editingPermissions) return;
    setSaving(true);
    try {
      await api.put(`/users/${editingPermissions.id}`, {
        staffPermission: selectedPermission,
      });
      toast.success('Permissions updated');
      setEditingPermissions(null);
      await load();
    } catch (err) {
      toast.error(apiError(err, 'Could not update permissions'));
    } finally {
      setSaving(false);
    }
  };

  const load = () =>
    Promise.all([
      api.get<TeamResponse>('/users').then(r => {
        setUsers(r.data.users);
        setSeats(r.data.seats);
      }),
      // Issuing a login means picking any member, so this one needs them all.
      api.get<Paginated<Member>>('/members?all=true').then(r => setMembers(r.data.data)),
      api.get<GymSettings>('/gym-settings').then(r => {
        setProfile({
          name: r.data.name,
          ownerName: r.data.ownerName,
          phone: r.data.phone ?? '',
          address: r.data.address ?? '',
          logo: r.data.logo ?? null,
        });
        setPtFeeInput(String(r.data.defaultPtFee));
        setAccounts({
          easypaisa: r.data.easypaisaAccount ?? '',
          jazzcash: r.data.jazzcashAccount ?? '',
          bank: r.data.bankAccount ?? '',
        });
      }),
    ])
      .catch(err => toast.error(apiError(err, 'Could not load accounts')))
      .finally(() => setLoading(false));

  useEffect(() => { void load(); }, []);

  const handleSettingsSave = async (e: FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const { data } = await api.put<GymSettings>('/gym-settings', {
        name: profile.name.trim(),
        ownerName: profile.ownerName.trim(),
        // Blank clears these, and the receipt simply omits the line.
        phone: profile.phone.trim(),
        address: profile.address.trim(),
        logo: profile.logo,
        defaultPtFee: Number(ptFeeInput),
        // Blank clears the channel's published details — the channel is still
        // offered at the counter, just without an account line to read out.
        easypaisaAccount: accounts.easypaisa.trim(),
        jazzcashAccount: accounts.jazzcash.trim(),
        bankAccount: accounts.bank.trim(),
      });
      // The header and every receipt read the gym off the session, so without
      // this a rename would not show until the owner signed in again.
      if (gym) {
        updateGym({
          ...gym,
          name: data.name,
          ownerName: data.ownerName,
          phone: data.phone,
          address: data.address,
          logo: data.logo ?? null,
        });
      }
      toast.success('Settings updated');
    } catch (err) {
      toast.error(apiError(err, 'Could not update settings'));
    } finally {
      setSavingSettings(false);
    }
  };

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
  const announce = (invite: InviteResult | null, created: string, name: string) => {
    if (!invite) { toast.success(`${created} — they can sign in now`); return; }
    setSharedInvite({ ...invite, name });
    if (invite.emailed) toast.success(`${created} — invite emailed`);
    else toast(`${created}, but the invite could not be emailed`, { icon: '⚠️' });
  };

  /** A fresh link for somebody whose invite never arrived or ran out. */
  const resendInvite = async (u: GymUser) => {
    setReinviting(u.id);
    try {
      const { data } = await api.post<{ invite: InviteResult }>(`/users/${u.id}/invite`);
      announce(data.invite, 'New invite ready', u.member?.name ?? u.name);
    } catch (err) {
      toast.error(apiError(err, 'Could not send the invite'));
    } finally {
      setReinviting(null);
    }
  };

  const handleAddStaff = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Omitting the password is what tells the API to invite instead.
      const { data } = await api.post<{ invite: InviteResult | null }>('/users/staff', {
        name: staffForm.name,
        email: staffForm.email,
        staffPermission: staffForm.staffPermission,
        ...(staffMethod === 'password' && { password: staffForm.password }),
      });
      announce(data.invite, 'Staff account created', staffForm.name);
      setShowStaff(false);
      setStaffForm({ name: '', email: '', password: '', staffPermission: 'receptionist' as StaffPermission });
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
      announce(data.invite, 'Member login created',
        members.find(m => m.id === loginForm.memberId)?.name ?? loginForm.email);
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

      {isOwner && (
        <Card className="p-5 mb-5">
          <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-1">Gym settings</h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
            What members see on a receipt, pricing, and the accounts they send money to.
          </p>
          <form onSubmit={handleSettingsSave} className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Gym details
              </p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">
                Printed at the top of every receipt a member keeps.
              </p>
              <div className="mb-4 p-4 rounded-xl bg-gray-50/70 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center shrink-0 shadow-md ring-2 ring-white/20 dark:ring-white/10 overflow-hidden">
                  {profile.logo ? (
                    <img src={profile.logo} alt="Gym Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="text-white/80" size={32} />
                  )}
                </div>
                <div className="space-y-1.5 text-center sm:text-left flex-1 min-w-0">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <p className="text-xs font-bold text-gray-800 dark:text-slate-200">Gym Brand Logo</p>
                    {profile.logo && (
                      <span className="text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">Custom Logo Set</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Appears in the desktop sidebar, mobile header, and receipts. PNG, JPG, or SVG up to 2MB.
                  </p>
                  <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors">
                      <Upload size={13} />
                      <span>{profile.logo ? 'Change Logo' : 'Upload Logo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoChange}
                      />
                    </label>
                    {profile.logo && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                      >
                        <Trash2 size={13} />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="gym-name">Gym name</FieldLabel>
                  <input
                    id="gym-name"
                    required
                    maxLength={100}
                    value={profile.name}
                    onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="gym-owner">Owner name</FieldLabel>
                  <input
                    id="gym-owner"
                    required
                    maxLength={100}
                    value={profile.ownerName}
                    onChange={e => setProfile(p => ({ ...p, ownerName: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="gym-phone">Phone</FieldLabel>
                  <input
                    id="gym-phone"
                    type="tel"
                    inputMode="tel"
                    maxLength={30}
                    placeholder="0300-1234567"
                    value={profile.phone}
                    onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="gym-address">Address</FieldLabel>
                  <textarea
                    id="gym-address"
                    rows={2}
                    maxLength={300}
                    placeholder="Shop 4, Al-Rehman Plaza, Peshawar Road, Rawalpindi"
                    value={profile.address}
                    onChange={e => setProfile(p => ({ ...p, address: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-400 dark:text-slate-500">
                Leave the phone or address blank and the receipt simply leaves that line out.
              </p>
            </div>

            <div className="max-w-xs border-t border-gray-100 dark:border-slate-800 pt-4">
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Default trainer assignment fee (Rs.)
              </label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={ptFeeInput}
                onChange={e => setPtFeeInput(e.target.value)}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
                Charged once when a member is put with a personal trainer. A trainer with their
                own fee set overrides this. Set it to 0 to charge nothing.
              </p>
            </div>

            <div className="border-t border-gray-100 dark:border-slate-800 pt-4">
              <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Payment accounts
              </p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">
                Shown to the front desk when a member pays online, so they can say where to send
                it. Leave blank for any channel you do not use.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="acct-easypaisa" className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Easypaisa
                  </label>
                  <input
                    id="acct-easypaisa"
                    inputMode="tel"
                    maxLength={200}
                    value={accounts.easypaisa}
                    onChange={e => setAccounts(a => ({ ...a, easypaisa: e.target.value }))}
                    placeholder="03001234567"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="acct-jazzcash" className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    JazzCash
                  </label>
                  <input
                    id="acct-jazzcash"
                    inputMode="tel"
                    maxLength={200}
                    value={accounts.jazzcash}
                    onChange={e => setAccounts(a => ({ ...a, jazzcash: e.target.value }))}
                    placeholder="03001234567"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="acct-bank" className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Bank account
                  </label>
                  <input
                    id="acct-bank"
                    maxLength={300}
                    value={accounts.bank}
                    onChange={e => setAccounts(a => ({ ...a, bank: e.target.value }))}
                    placeholder="Meezan Bank — PK00MEZN0001234567890"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            <button type="submit" disabled={savingSettings} className={primaryButton}>
              {savingSettings ? 'Saving…' : 'Save'}
            </button>
          </form>
        </Card>
      )}

      {isOwner && seatsFull && (
        <div className="bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4 mb-5 flex items-start gap-3">
          <UserCog size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            All {seats?.limit} staff seats are in use. To add someone else, remove an
            account below — revoking access alone does not free the seat, since the
            account keeps its email address and can be restored.
          </p>
        </div>
      )}

      {!isOwner && (
        <div className="bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4 mb-5 flex items-start gap-3">
          <Shield size={18} className="text-blue-600 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            You can see who has access, but only the gym owner can add or remove accounts.
          </p>
        </div>
      )}

      {users.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="No accounts yet"
          hint={isOwner
            ? 'Invite a staff member, or create a login for a member so they can see their own plan and fees.'
            : 'Only the gym owner can add accounts.'}
        />
      ) : (
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
                    <p className={`font-semibold truncate ${u.isActive ? 'text-gray-900 dark:text-slate-100' : 'text-gray-400 dark:text-slate-500'}`}>
                      {u.name}
                    </p>
                    {isMe && <span className="text-xs text-gray-400 dark:text-slate-500">(you)</span>}
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${style.className}`}>
                      <RoleIcon size={11} /> {style.label}
                    </span>
                    {u.role === 'staff' && u.staffPermission && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800">
                        {getPermissionLabel(u.staffPermission)}
                      </span>
                    )}
                    {!u.isActive && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-500/15 text-red-600 border border-red-200 dark:border-red-500/20">
                        Revoked
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 truncate">{u.email}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                    {u.lastLoginAt
                      ? `Last signed in ${new Date(u.lastLoginAt).toLocaleDateString()}`
                      : u.invitePending ? 'Invite sent — password not set yet' : 'Never signed in'}
                  </p>
                </div>

                {isOwner && !isMe && (
                  // Wraps rather than shrinking: five controls do not fit beside
                  // a name on a phone, and `shrink-0` alone pushed the name to
                  // nothing instead of moving the buttons to their own line.
                  <div className="flex items-center justify-end gap-1.5 flex-wrap shrink-0">
                    {u.role !== 'owner' && (
                      <>
                        {u.invitePending && u.isActive && (
                          <button
                            onClick={() => void resendInvite(u)}
                            disabled={reinviting === u.id}
                            className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/10 disabled:opacity-40 ${focusRing}`}
                          >
                            {reinviting === u.id ? 'Sending…' : 'Resend invite'}
                          </button>
                        )}
                        <button
                          // Restoring access is harmless and stays one click;
                          // revoking locks someone out mid-shift, so it asks.
                          onClick={() =>
                            u.isActive
                              ? setConfirming({ user: u, action: 'revoke' })
                              : void toggleActive(u)
                          }
                          className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60 ${focusRing}`}
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
                            className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60 disabled:opacity-40 disabled:hover:bg-transparent ${focusRing}`}
                          >
                            {u.role === 'staff' ? 'Make member' : 'Make staff'}
                          </button>
                        )}
                        {u.role === 'staff' && (
                          <button
                            onClick={() => setEditingPermissions(u)}
                            className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60 ${focusRing}`}
                          >
                            Permissions
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
      )}

      {showStaff && (
        <Modal title="Add Staff Account" onClose={() => setShowStaff(false)}>
          <form onSubmit={e => void handleAddStaff(e)} className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Staff run the front desk: members, attendance, plans, supplement sales, and
              taking fees. They see only the payments they recorded themselves — never the
              gym's totals — and cannot edit the books or manage accounts.
            </p>
            {seats && (
              <p className="text-xs text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800 rounded-xl px-3 py-2.5">
                {seats.remaining} of {seats.limit} staff{' '}
                {seats.remaining === 1 ? 'seat' : 'seats'} left.
              </p>
            )}
            <div>
              <FieldLabel htmlFor="team-name" required>Name</FieldLabel>
              <input id="team-name" required value={staffForm.name}
                onChange={e => setStaffForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Helper's full name"
                className={inputClass} />
            </div>
            <div>
              <FieldLabel htmlFor="team-email" required>Email</FieldLabel>
              <input id="team-email" type="email" required value={staffForm.email}
                onChange={e => setStaffForm(f => ({ ...f, email: e.target.value }))}
                placeholder="helper@gym.com"
                className={inputClass} />
            </div>
            <PermissionPicker
              id="team-permission-level"
              value={staffForm.staffPermission}
              onChange={p => setStaffForm(f => ({ ...f, staffPermission: p }))}
            />
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
            <p className="text-sm text-gray-500 dark:text-slate-400">
              The member will be able to see only their own plan, attendance and dues.
            </p>
            {membersWithoutLogin.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-slate-500 py-4 text-center">
                Every member already has a login.
              </p>
            ) : (
              <>
                <div>
                  <FieldLabel htmlFor="team-member" required>Member</FieldLabel>
                  <select id="team-member" required value={loginForm.memberId}
                    onChange={e => setLoginForm(f => ({ ...f, memberId: e.target.value }))}
                    className={inputClass}>
                    <option value="">Select member...</option>
                    {membersWithoutLogin.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel htmlFor="team-email-2" required>Email</FieldLabel>
                  <input id="team-email-2" type="email" required value={loginForm.email}
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

      {/* Shown after every invite: the link can also go on WhatsApp, and when
          the mail failed it is the only way to hand the account over. */}
      {sharedInvite && (
        <Modal title={`Invite for ${sharedInvite.name}`} onClose={() => setSharedInvite(null)}>
          <div className="space-y-4">
            <p className={`text-sm rounded-xl p-3 ${sharedInvite.emailed
              ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300'
              : 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300'}`}>
              {sharedInvite.emailed
                ? 'The invite email has been sent. You can also send the link on WhatsApp.'
                : 'The invite email could not be sent. Send them this link on WhatsApp or copy it.'}
            </p>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              They open the link, choose their own password and are signed in with the
              access you gave them. It lasts 48 hours and works once.
            </p>
            <div className="bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800 rounded-xl p-3">
              <p className="text-xs text-gray-700 dark:text-slate-300 break-all font-mono leading-relaxed">
                {sharedInvite.link}
              </p>
            </div>
            <a
              href={whatsappInviteUrl(sharedInvite)}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center justify-center w-full rounded-xl py-2.5 font-semibold text-white bg-green-600 hover:bg-green-700 ${focusRing}`}
            >
              Send on WhatsApp
            </a>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(sharedInvite.link)
                    .then(() => toast.success('Link copied'))
                    .catch(() => toast.error('Could not copy — select the text instead'));
                }}
                className={`flex-1 ${secondaryButton}`}
              >
                Copy link
              </button>
              <button type="button" onClick={() => setSharedInvite(null)}
                className={`flex-1 ${primaryButton}`}>
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}

      {editingPermissions && (
        <Modal title={`Change Permissions for ${editingPermissions.name}`} onClose={() => setEditingPermissions(null)}>
          <form onSubmit={e => {
            e.preventDefault();
            void handleUpdatePermissions();
          }} className="space-y-4">
            <PermissionPicker
              id="team-permission-level-2"
              value={selectedPermission}
              onChange={setSelectedPermission}
            />
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setEditingPermissions(null)}
                className={`flex-1 ${secondaryButton}`}>
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className={`flex-1 ${primaryButton}`}>
                {saving ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </form>
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
        ) : confirming.action === 'revoke' ? (
          <ConfirmDialog
            title="Revoke access"
            message={`Revoke ${confirming.user.name}'s access? They are signed out immediately and cannot sign in again until you restore them. Nothing they have recorded is removed.`}
            confirmLabel="Revoke"
            busy={saving}
            onConfirm={() => {
              void toggleActive(confirming.user);
              setConfirming(null);
            }}
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

