/**
 * Shapes returned by the API. Dates arrive as ISO strings over JSON, so they
 * are typed as string here even though the backend models them as Date.
 */

export type MemberStatus = 'active' | 'expiring' | 'expired';
export type MembershipType = 'monthly' | 'quarterly' | 'yearly';
export type PaymentMethod = 'cash' | 'online';
export type PaymentStatus = 'paid' | 'due';
export type SupplementCategory =
  | 'protein' | 'creatine' | 'preworkout' | 'bcaa' | 'vitamins' | 'fatburner' | 'other';

export type Role = 'owner' | 'staff' | 'member';

export interface Gym {
  id: string;
  name: string;
  ownerName: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Set only when the account belongs to a gym member. */
  memberId: string | null;
}

export interface GymUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  memberId: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  member?: { id: string; name: string } | null;
}

export interface MyProfile {
  member: Member & { daysLeft: number };
  plan: {
    id: string;
    assignedAt: string;
    workoutPlan: Plan | null;
    dietPlan: Plan | null;
  } | null;
  attendance: { id: string; checkedInAt: string }[];
  payments: Omit<Payment, 'member'>[];
  dueTotal: number;
}

export interface Member {
  id: string;
  gymId: string;
  name: string;
  email: string | null;
  phone: string | null;
  photo: string | null;
  membershipType: MembershipType;
  feeAmount: number | null;
  startDate: string;
  endDate: string;
  status: MemberStatus;
  createdAt: string;
}

export interface MemberSummary {
  name: string;
  phone: string | null;
  photo?: string | null;
}

export interface AttendanceRecord {
  id: string;
  memberId: string;
  gymId: string;
  checkedInAt: string;
  member: MemberSummary;
}

export interface Payment {
  id: string;
  memberId: string;
  gymId: string;
  amount: number;
  paymentDate: string;
  method: PaymentMethod;
  notes: string | null;
  status: PaymentStatus;
  member: Pick<MemberSummary, 'name' | 'phone'>;
}

export interface Plan {
  id: string;
  gymId: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface Supplement {
  id: string;
  gymId: string;
  name: string;
  category: SupplementCategory;
  description: string | null;
  dosage: string | null;
  timing: string | null;
  price: number | null;
  stock: number;
  createdAt: string;
}

export interface DashboardStats {
  totalMembers: number;
  activeMembers: number;
  expiringMembers: Pick<Member, 'id' | 'name' | 'phone' | 'endDate'>[];
  todayAttendance: number;
  recentMembers: Pick<Member, 'id' | 'name' | 'phone' | 'membershipType' | 'endDate' | 'createdAt'>[];
  duePayments: number;
}

/** The session token is set as an httpOnly cookie and never appears here. */
export interface AuthResponse {
  user: SessionUser;
  gym: Gym;
}
