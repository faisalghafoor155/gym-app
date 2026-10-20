import type { StaffPermission, GymUser, Role } from '../../types';

/** How a new account gets its password: emailed invite, or one the owner
 *  types. Invite is the default; the manual route exists for the helper whose
 *  email does not work. */
export type AccountMethod = 'invite' | 'password';

/** What the API answers when an account was created by invite. */
export interface InviteResult {
  emailed: boolean;
  /** Always returned, so the owner can also send it on WhatsApp. */
  link: string;
}

/** The invite on screen after creating or re-inviting an account. */
export interface SharedInvite extends InviteResult {
  name: string;
}

/** The gym's identity as edited in the settings card. */
export interface GymProfile {
  name: string;
  ownerName: string;
  phone: string;
  address: string;
  logo: string | null;
}

export interface StaffForm {
  name: string;
  email: string;
  password: string;
  staffPermission: StaffPermission;
}

export interface LoginForm {
  memberId: string;
  email: string;
  password: string;
}

export interface PaymentAccounts {
  easypaisa: string;
  jazzcash: string;
  bank: string;
}

export type ConfirmingState = { user: GymUser; action: 'delete' | 'transfer' | 'revoke' } | null;
export type ChangingRoleState = { user: GymUser; to: Exclude<Role, 'owner'> } | null;
