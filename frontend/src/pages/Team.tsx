import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Shield, UserCog, KeyRound } from 'lucide-react';
import {
  Page, PageHeader, PageLoader, EmptyState,
  primaryButton, secondaryButton,
} from '../components/ui';
import api, { apiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import type { GymUser, GymSettings, Member, Paginated, Role, StaffSeats, TeamResponse, StaffPermission } from '../types';
import BackupPanel from '../components/team/BackupPanel';
import GymSettingsCard from '../components/team/GymSettingsCard';
import AccountCard from '../components/team/AccountCard';
import AddStaffModal from '../components/team/AddStaffModal';
import MemberLoginModal from '../components/team/MemberLoginModal';
import InviteModal from '../components/team/InviteModal';
import PermissionsModal from '../components/team/PermissionsModal';
import TeamConfirmDialogs from '../components/team/TeamConfirmDialogs';
import type {
  AccountMethod, InviteResult, SharedInvite, GymProfile, ChangingRoleState, ConfirmingState,
} from '../components/team/types';
import toast from 'react-hot-toast';


export default function Team() {
  const { user: me, isOwner, gym, updateGym } = useAuth();
  const { t } = useLanguage();
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
    useState<ConfirmingState>(null);
  // The account whose role is being changed, and what to. Confirmed rather than
  // applied on click: promoting somebody to staff hands them the till.
  const [changingRole, setChangingRole] =
    useState<ChangingRoleState>(null);
  
  const [editingPermissions, setEditingPermissions] = useState<GymUser | null>(null);

  /**
   * The gym's own identity, as it appears on every receipt a member keeps.
   *
   * Editable here for the first time: these were written once at signup and
   * never again, so a typo in the name printed on every receipt could only be
   * fixed in the database.
   */
  const [profile, setProfile] = useState<GymProfile>({ name: '', ownerName: '', phone: '', address: '', logo: null });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('Logo image must be under 2MB'));
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
  const [joiningFeeInput, setJoiningFeeInput] = useState('');
  /** Referral reward and inactivity threshold, as typed. */
  const [retention, setRetention] = useState({ referralRewardDays: '0', inactivityDays: '10' });
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
      toast.success(t('Permissions updated'));
      setEditingPermissions(null);
      await load();
    } catch (err) {
      toast.error(apiError(err, t('Could not update permissions')));
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
        setJoiningFeeInput(String(r.data.joiningFee ?? 0));
        setRetention({
          referralRewardDays: String(r.data.referralRewardDays ?? 0),
          inactivityDays: String(r.data.inactivityDays ?? 10),
        });
        setAccounts({
          easypaisa: r.data.easypaisaAccount ?? '',
          jazzcash: r.data.jazzcashAccount ?? '',
          bank: r.data.bankAccount ?? '',
        });
      }),
    ])
      .catch(err => toast.error(apiError(err, t('Could not load accounts'))))
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
        joiningFee: Number(joiningFeeInput) || 0,
        referralRewardDays: Number(retention.referralRewardDays) || 0,
        inactivityDays: Number(retention.inactivityDays) || 10,
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
      toast.success(t('Settings updated'));
    } catch (err) {
      toast.error(apiError(err, t('Could not update settings')));
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
  const announce = (invite: InviteResult | null, created: string, name: string, viaWhatsApp = false) => {
    if (!invite) { toast.success(t('{created} — they can sign in now', { created })); return; }
    setSharedInvite({ ...invite, name, viaWhatsApp });
    if (viaWhatsApp) toast.success(t('{created} — send the link on WhatsApp', { created }));
    else if (invite.emailed) toast.success(t('{created} — invite emailed', { created }));
    else toast(t('{created}, but the invite could not be emailed', { created }), { icon: '⚠️' });
  };

  /** A fresh link for somebody whose invite never arrived or ran out. */
  const resendInvite = async (u: GymUser) => {
    setReinviting(u.id);
    try {
      const { data } = await api.post<{ invite: InviteResult }>(`/users/${u.id}/invite`);
      announce(data.invite, t('New invite ready'), u.member?.name ?? u.name);
    } catch (err) {
      toast.error(apiError(err, t('Could not send the invite')));
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
        ...(staffMethod === 'whatsapp' && { sendEmail: false }),
      });
      announce(data.invite, t('Staff account created'), staffForm.name, staffMethod === 'whatsapp');
      setShowStaff(false);
      setStaffForm({ name: '', email: '', password: '', staffPermission: 'receptionist' as StaffPermission });
      await load();
    } catch (err) {
      toast.error(apiError(err, t('Could not create the account')));
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
        ...(loginMethod === 'whatsapp' && { sendEmail: false }),
      });
      announce(data.invite, t('Member login created'),
        members.find(m => m.id === loginForm.memberId)?.name ?? loginForm.email,
        loginMethod === 'whatsapp');
      setShowMemberLogin(false);
      setLoginForm({ memberId: '', email: '', password: '' });
      await load();
    } catch (err) {
      toast.error(apiError(err, t('Could not create the login')));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: GymUser) => {
    try {
      await api.put(`/users/${u.id}`, { isActive: !u.isActive });
      toast.success(u.isActive ? t('Access revoked') : t('Access restored'));
      await load();
    } catch (err) {
      toast.error(apiError(err, t('Could not update the account')));
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
      toast.success(t(role === 'staff' ? '{name} is now staff' : '{name} is now member', { name: u.name }));
      setChangingRole(null);
      await load();
    } catch (err) {
      toast.error(apiError(err, t('Could not change the role')));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: GymUser) => {
    setSaving(true);
    try {
      await api.delete(`/users/${u.id}`);
      toast.success(t('Account removed'));
      setConfirming(null);
      await load();
    } catch (err) {
      toast.error(apiError(err, t('Could not remove the account')));
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
      toast.error(apiError(err, t('Could not transfer ownership')));
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
            ? t(users.length === 1
              ? '{count} account can sign in · {used} of {limit} staff seats used'
              : '{count} accounts can sign in · {used} of {limit} staff seats used',
              { count: users.length, used: seats.used, limit: seats.limit })
            : t(users.length === 1 ? '{count} account can sign in' : '{count} accounts can sign in', { count: users.length })
        }
        action={isOwner ? (
          <div className="flex gap-2">
            <button onClick={() => setShowMemberLogin(true)} className={secondaryButton}>
              <KeyRound size={15} /> <span className="hidden sm:inline">{t('Member login')}</span>
            </button>
            {/* Disabled once the seats are gone, with the reason on hover —
                the API refuses it anyway, so offering the form would only
                waste the owner's typing. Member logins are not capped. */}
            <button
              onClick={() => setShowStaff(true)}
              disabled={seatsFull}
              title={seatsFull
                ? t('All {limit} staff seats are in use. Remove an account to free one.', { limit: seats?.limit ?? 0 })
                : undefined}
              className={primaryButton}
            >
              <Plus size={16} />
              <span className="hidden sm:inline">{t('Add Staff')}</span><span className="sm:hidden">{t('Staff')}</span>
            </button>
          </div>
        ) : undefined}
      />

      {isOwner && (
        <GymSettingsCard
          profile={profile}
          setProfile={setProfile}
          handleLogoChange={handleLogoChange}
          handleRemoveLogo={handleRemoveLogo}
          joiningFeeInput={joiningFeeInput}
          setJoiningFeeInput={setJoiningFeeInput}
          ptFeeInput={ptFeeInput}
          setPtFeeInput={setPtFeeInput}
          retention={retention}
          setRetention={setRetention}
          accounts={accounts}
          setAccounts={setAccounts}
          savingSettings={savingSettings}
          handleSettingsSave={handleSettingsSave}
        />
      )}

      {isOwner && <BackupPanel />}

      {isOwner && seatsFull && (
        <div className="bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4 mb-5 flex items-start gap-3">
          <UserCog size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            {t('All {limit} staff seats are in use. To add someone else, remove an account below — revoking access alone does not free the seat, since the account keeps its email address and can be restored.', { limit: seats?.limit ?? 0 })}
          </p>
        </div>
      )}

      {!isOwner && (
        <div className="bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4 mb-5 flex items-start gap-3">
          <Shield size={18} className="text-blue-600 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            {t('You can see who has access, but only the gym owner can add or remove accounts.')}
          </p>
        </div>
      )}

      {users.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title={t('No accounts yet')}
          hint={isOwner
            ? t('Invite a staff member, or create a login for a member so they can see their own plan and fees.')
            : t('Only the gym owner can add accounts.')}
        />
      ) : (
      <div className="space-y-3">
        {users.map(u => (
          <AccountCard
            key={u.id}
            u={u}
            isMe={u.id === me?.id}
            isOwner={isOwner}
            seats={seats}
            seatsFull={seatsFull}
            reinviting={reinviting}
            resendInvite={resendInvite}
            toggleActive={toggleActive}
            setConfirming={setConfirming}
            setChangingRole={setChangingRole}
            setEditingPermissions={setEditingPermissions}
          />
        ))}
      </div>
      )}

      {showStaff && (
        <AddStaffModal
          seats={seats}
          staffForm={staffForm}
          setStaffForm={setStaffForm}
          staffMethod={staffMethod}
          setStaffMethod={setStaffMethod}
          saving={saving}
          handleAddStaff={handleAddStaff}
          onClose={() => setShowStaff(false)}
        />
      )}

      {showMemberLogin && (
        <MemberLoginModal
          membersWithoutLogin={membersWithoutLogin}
          loginForm={loginForm}
          setLoginForm={setLoginForm}
          loginMethod={loginMethod}
          setLoginMethod={setLoginMethod}
          saving={saving}
          handleAddMemberLogin={handleAddMemberLogin}
          onClose={() => setShowMemberLogin(false)}
        />
      )}

      {/* Shown after every invite: the link can also go on WhatsApp, and when
          the mail failed it is the only way to hand the account over. */}
      {sharedInvite && (
        <InviteModal sharedInvite={sharedInvite} onClose={() => setSharedInvite(null)} />
      )}

      {editingPermissions && (
        <PermissionsModal
          editingPermissions={editingPermissions}
          selectedPermission={selectedPermission}
          setSelectedPermission={setSelectedPermission}
          saving={saving}
          handleUpdatePermissions={handleUpdatePermissions}
          onClose={() => setEditingPermissions(null)}
        />
      )}

      <TeamConfirmDialogs
        changingRole={changingRole}
        setChangingRole={setChangingRole}
        confirming={confirming}
        setConfirming={setConfirming}
        saving={saving}
        changeRole={changeRole}
        toggleActive={toggleActive}
        handleDelete={handleDelete}
        handleTransfer={handleTransfer}
      />
    </Page>
  );
}
