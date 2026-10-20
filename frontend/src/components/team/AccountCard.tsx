import type { Dispatch, SetStateAction } from 'react';
import { Shield, User, UserCog, Trash2, Crown } from 'lucide-react';
import { Card, IconButton, focusRing } from '../ui';
import type { GymUser, Role, StaffSeats } from '../../types';
import { getPermissionLabel } from '../../utils/permissions';
import type { ChangingRoleState, ConfirmingState } from './types';

const roleStyles: Record<Role, { label: string; icon: typeof Shield; className: string }> = {
  owner: { label: 'Owner', icon: Crown, className: 'bg-purple-50 dark:bg-purple-500/15 text-purple-700 border-purple-200 dark:border-purple-500/20' },
  staff: { label: 'Staff', icon: UserCog, className: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 border-blue-200 dark:border-blue-500/20' },
  member: { label: 'Member', icon: User, className: 'bg-gray-50 dark:bg-slate-800/60 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-800' },
};

/** One row of the accounts list, with the owner's controls for that account. */
export default function AccountCard({
  u, isMe, isOwner, seats, seatsFull, reinviting,
  resendInvite, toggleActive, setConfirming, setChangingRole, setEditingPermissions,
}: {
  u: GymUser;
  isMe: boolean;
  isOwner: boolean;
  seats: StaffSeats | null;
  seatsFull: boolean;
  reinviting: string | null;
  resendInvite: (u: GymUser) => Promise<void>;
  toggleActive: (u: GymUser) => Promise<void>;
  setConfirming: Dispatch<SetStateAction<ConfirmingState>>;
  setChangingRole: Dispatch<SetStateAction<ChangingRoleState>>;
  setEditingPermissions: Dispatch<SetStateAction<GymUser | null>>;
}) {
  const style = roleStyles[u.role];
  const RoleIcon = style.icon;
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
}
