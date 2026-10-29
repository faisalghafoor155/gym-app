import type { StaffPermission, GymUser, Role } from '../../types';

/** How a new account gets its password: emailed invite, an invite link the
 *  owner sends on WhatsApp, or one the owner types. Invite is the default;
 *  the other two exist for people whose email does not work. */
export type AccountMethod = 'invite' | 'whatsapp' | 'password';

/** What the API answers when an account was created by invite. */
export interface InviteResult {
  emailed: boolean;
  /** Always returned, so the owner can also send it on WhatsApp. */
  link: string;
}

/** The invite on screen after creating or re-inviting an account. */
export interface SharedInvite extends InviteResult {
  name: string;
  /** True when the owner chose WhatsApp, so no email was ever attempted. */
  viaWhatsApp?: boolean;
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
