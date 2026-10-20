import type { Dispatch, SetStateAction } from 'react';
import ConfirmDialog from '../ConfirmDialog';
import type { GymUser, Role } from '../../types';
import type { ChangingRoleState, ConfirmingState } from './types';

/** The role-change confirmation and the delete / revoke / transfer dialog. */
export default function TeamConfirmDialogs({
  changingRole, setChangingRole, confirming, setConfirming, saving,
  changeRole, toggleActive, handleDelete, handleTransfer,
}: {
  changingRole: ChangingRoleState;
  setChangingRole: Dispatch<SetStateAction<ChangingRoleState>>;
  confirming: ConfirmingState;
  setConfirming: Dispatch<SetStateAction<ConfirmingState>>;
  saving: boolean;
  changeRole: (u: GymUser, role: Exclude<Role, 'owner'>) => Promise<void>;
  toggleActive: (u: GymUser) => Promise<void>;
  handleDelete: (u: GymUser) => Promise<void>;
  handleTransfer: (u: GymUser) => Promise<void>;
}) {
  return (
    <>
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
    </>
  );
}
