import type { StaffPermission } from '../types';
import {
  PERMISSION_DESCRIPTIONS,
  PERMISSION_LABELS,
  STAFF_PERMISSIONS,
  type PermissionRequirements,
} from './permissions.generated';

/**
 * What the signed-in account may do, as the client understands it.
 *
 * The table itself is not here: it is generated from
 * `backend/src/services/permissions.ts`, which is the only copy anybody edits.
 * This file holds the parts that are genuinely client-side — chiefly the role
 * check below, which the server does in middleware instead.
 *
 * None of this is a security boundary. Hiding a button the API would refuse is
 * a courtesy to the user, not a defence: every one of these capabilities is
 * enforced again server-side, and that check is the one that counts.
 */

export type { PermissionRequirements };
export { STAFF_PERMISSIONS };

/**
 * Every capability, denied — what an account with no staff level gets.
 *
 * Built by mapping the manager's table (the one level that grants everything,
 * so it names every key) rather than written out: a capability added to the
 * generated table is denied here automatically instead of being silently
 * `undefined` until somebody remembers this file.
 */
const NONE: PermissionRequirements = Object.keys(STAFF_PERMISSIONS.manager).reduce(
  (acc, key) => ({ ...acc, [key]: false }),
  {} as PermissionRequirements,
);

export const getStaffPermissions = (
  staffPermission: StaffPermission,
): PermissionRequirements => STAFF_PERMISSIONS[staffPermission] ?? NONE;

/**
 * Whether this account may do something.
 *
 * Takes the role as well as the staff level, unlike the server's equivalent:
 * an owner bypasses the table entirely, and a member has no staff level at all
 * — both facts the client has to hand and the server's middleware handles
 * before the table is ever consulted.
 */
export const hasPermission = (
  role: string | null,
  staffPermission: StaffPermission | null | undefined,
  action: keyof PermissionRequirements,
): boolean => {
  if (role === 'owner') return true;
  if (role !== 'staff' || !staffPermission) return false;
  return getStaffPermissions(staffPermission)[action];
};

/** Get readable name for a permission level. */
export const getPermissionLabel = (permission: StaffPermission): string =>
  PERMISSION_LABELS[permission];

/** Describe what a permission level can do. */
export const getPermissionDescription = (permission: StaffPermission): string =>
  PERMISSION_DESCRIPTIONS[permission];

/**
 * The permission levels in the order an owner should meet them: most access
 * first, narrowing to the single-desk roles.
 *
 * Ordered here rather than taken from `STAFF_PERMISSIONS` in its own order,
 * whose keys the generator sorts alphabetically to keep its diffs stable —
 * right for a generated file, wrong for a menu, where it buried Manager
 * between Inventory and Members.
 *
 * The rank map is what keeps this honest. `Record<StaffPermission, number>`
 * must name every level, so adding one to the schema fails the build here
 * until it is given a position deliberately. A bare ordered array could not do
 * that: dropping an entry would still typecheck, and the level would vanish
 * from every picker with nothing to say so.
 */
const PERMISSION_RANK: Record<StaffPermission, number> = {
  manager: 0,
  members_manager: 1,
  accountant: 2,
  receptionist: 3,
  inventory_manager: 4,
};

export const PERMISSION_ORDER: readonly StaffPermission[] = (
  Object.keys(PERMISSION_RANK) as StaffPermission[]
).sort((a, b) => PERMISSION_RANK[a] - PERMISSION_RANK[b]);
