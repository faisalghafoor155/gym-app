/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Written from backend/src/services/permissions.ts by
 * backend/scripts/generatePermissions.ts. Change the table there and run
 * `npm run gen:permissions` in backend/, then commit both files.
 *
 * Editing this by hand is how the two copies drifted apart before; the
 * backend test suite fails if it stops matching its source.
 */

import type { StaffPermission } from '../types';

export interface PermissionRequirements {
  canCheckIn: boolean;
  canManageClasses: boolean;
  canManageExpenses: boolean;
  canManageMembers: boolean;
  canManageMemberships: boolean;
  canManagePayments: boolean;
  canManagePlans: boolean;
  canManageStaff: boolean;
  canManageSupplements: boolean;
  canManageTrainers: boolean;
  canModifyStaff: boolean;
  canRecordPayments: boolean;
  canSellSupplements: boolean;
  canViewAttendance: boolean;
  canViewPayments: boolean;
  canViewReports: boolean;
}

export const STAFF_PERMISSIONS: Record<StaffPermission, PermissionRequirements> = {
  accountant: {
    canCheckIn: false,
    canManageClasses: false,
    canManageExpenses: true,
    canManageMembers: false,
    canManageMemberships: false,
    canManagePayments: true,
    canManagePlans: false,
    canManageStaff: false,
    canManageSupplements: false,
    canManageTrainers: true,
    canModifyStaff: false,
    canRecordPayments: true,
    canSellSupplements: false,
    canViewAttendance: false,
    canViewPayments: true,
    canViewReports: true,
  },
  inventory_manager: {
    canCheckIn: false,
    canManageClasses: false,
    canManageExpenses: false,
    canManageMembers: false,
    canManageMemberships: false,
    canManagePayments: false,
    canManagePlans: false,
    canManageStaff: false,
    canManageSupplements: true,
    canManageTrainers: false,
    canModifyStaff: false,
    canRecordPayments: true,
    canSellSupplements: true,
    canViewAttendance: false,
    canViewPayments: true,
    canViewReports: false,
  },
  manager: {
    canCheckIn: true,
    canManageClasses: true,
    canManageExpenses: true,
    canManageMembers: true,
    canManageMemberships: true,
    canManagePayments: true,
    canManagePlans: true,
    canManageStaff: true,
    canManageSupplements: true,
    canManageTrainers: true,
    canModifyStaff: true,
    canRecordPayments: true,
    canSellSupplements: true,
    canViewAttendance: true,
    canViewPayments: true,
    canViewReports: true,
  },
  members_manager: {
    canCheckIn: false,
    canManageClasses: true,
    canManageExpenses: false,
    canManageMembers: true,
    canManageMemberships: true,
    canManagePayments: false,
    canManagePlans: false,
    canManageStaff: false,
    canManageSupplements: false,
    canManageTrainers: false,
    canModifyStaff: false,
    canRecordPayments: false,
    canSellSupplements: false,
    canViewAttendance: false,
    canViewPayments: true,
    canViewReports: false,
  },
  receptionist: {
    canCheckIn: true,
    canManageClasses: true,
    canManageExpenses: false,
    canManageMembers: false,
    canManageMemberships: false,
    canManagePayments: false,
    canManagePlans: false,
    canManageStaff: false,
    canManageSupplements: false,
    canManageTrainers: false,
    canModifyStaff: false,
    canRecordPayments: false,
    canSellSupplements: false,
    canViewAttendance: true,
    canViewPayments: true,
    canViewReports: false,
  },
};

export const PERMISSION_LABELS: Record<StaffPermission, string> = {
  accountant: "Accountant",
  inventory_manager: "Inventory Manager",
  manager: "Manager",
  members_manager: "Members Manager",
  receptionist: "Receptionist",
};

export const PERMISSION_DESCRIPTIONS: Record<StaffPermission, string> = {
  accountant: "Can manage and view payments, expenses, and reports",
  inventory_manager: "Can manage supplements, inventory, and sell items",
  manager: "Full access to all features including staff management",
  members_manager: "Can manage members, memberships, and view payments",
  receptionist: "Can check in members and view attendance",
};
