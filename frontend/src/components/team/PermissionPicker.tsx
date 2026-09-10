import type { StaffPermission } from '../../types';
import {
  PERMISSION_ORDER,
  getPermissionLabel,
  getPermissionDescription,
  getStaffPermissions,
} from '../../utils/permissions';
import { FieldLabel, inputClass } from '../ui';

/**
 * What each capability is called when the owner is deciding who gets it.
 *
 * The flag names are the server's vocabulary — `canManageMemberships` is
 * precise and means nothing to somebody staffing a front desk. Only the
 * capabilities worth naming appear: the list is a summary that helps an owner
 * choose, not a permissions matrix, and the description above it already says
 * what the level is for.
 */
const CAPABILITY_LABELS: Partial<Record<string, string>> = {
  canManageMembers: 'Members',
  canManageMemberships: 'Memberships',
  canRecordPayments: 'Record payments',
  canViewPayments: 'View payments',
  canCheckIn: 'Check-ins',
  canViewAttendance: 'Attendance',
  canManageSupplements: 'Supplements',
  canSellSupplements: 'Sell supplements',
  canManageExpenses: 'Expenses',
  canManageTrainers: 'Trainers',
  canManageClasses: 'Classes',
  canViewReports: 'Reports',
  canManagePlans: 'Plans',
  canManageStaff: 'Staff & logins',
};

/**
 * Chooses a staff permission level, and shows what it actually grants.
 *
 * Shared by the two places an owner sets one — creating an account and
 * changing an existing one — because they had drifted into two hardcoded
 * `<option>` lists that repeated the level name in its own parentheses
 * ("Members Manager (Members Manager)") and ordered Manager third. Both now
 * read from the generated table, so a level added to the schema appears here
 * without anyone editing a modal.
 *
 * The capability chips are the point of the polish: a description says "can
 * manage members and view payments", but an owner deciding between two levels
 * wants to see the boundary, and the sidebar the staff member ends up with is
 * built from these same flags.
 */
export default function PermissionPicker({ id, value, onChange }: {
  id: string;
  value: StaffPermission;
  onChange: (permission: StaffPermission) => void;
}) {
  const granted = getStaffPermissions(value);
  const allowed = Object.keys(CAPABILITY_LABELS).filter(
    key => granted[key as keyof typeof granted],
  );

  return (
    <div>
      <FieldLabel htmlFor={id} required>Permission Level</FieldLabel>
      <select
        id={id}
        required
        value={value}
        onChange={e => onChange(e.target.value as StaffPermission)}
        className={inputClass}
      >
        {PERMISSION_ORDER.map(permission => (
          <option key={permission} value={permission}>
            {getPermissionLabel(permission)}
          </option>
        ))}
      </select>

      <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 leading-relaxed">
        {getPermissionDescription(value)}
      </p>

      <div className="flex flex-wrap gap-1.5 mt-2.5">
        {allowed.map(key => (
          <span
            key={key}
            className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 border border-blue-100 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/20"
          >
            {CAPABILITY_LABELS[key]}
          </span>
        ))}
      </div>
    </div>
  );
}
