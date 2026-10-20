import type { Dispatch, FormEvent, SetStateAction } from 'react';
import Modal from '../Modal';
import { FieldLabel, inputClass, primaryButton, secondaryButton } from '../ui';
import type { StaffSeats } from '../../types';
import PermissionPicker from './PermissionPicker';
import PasswordMethod from './PasswordMethod';
import type { AccountMethod, StaffForm } from './types';

export default function AddStaffModal({
  seats, staffForm, setStaffForm, staffMethod, setStaffMethod, saving, handleAddStaff, onClose,
}: {
  seats: StaffSeats | null;
  staffForm: StaffForm;
  setStaffForm: Dispatch<SetStateAction<StaffForm>>;
  staffMethod: AccountMethod;
  setStaffMethod: (m: AccountMethod) => void;
  saving: boolean;
  handleAddStaff: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  onClose: () => void;
}) {
  return (
    <Modal title="Add Staff Account" onClose={() => onClose()}>
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
          <button type="button" onClick={() => onClose()}
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
  );
}
