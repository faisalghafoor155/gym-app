/**
 * Shapes returned by the API. Dates arrive as ISO strings over JSON, so they
 * are typed as string here even though the backend models them as Date.
 */

/** What the API stores. `expiring` is not here — it is a function of today's
 *  date, so the server derives it on read rather than storing it. */
export type MembershipStatus =
  | 'active' | 'expired' | 'suspended' | 'cancelled' | 'superseded';

/** What the API returns for display: the stored status, plus the derived
 *  `expiring` for an active membership with a week or less left. */
export type MemberStatus = MembershipStatus | 'expiring';

export type Gender = 'male' | 'female' | 'other';
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
  member: Omit<Member, 'gymId' | 'status' | 'createdAt'>;
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

export interface MembershipPlan {
  id: string;
  gymId: string;
  name: string;
  price: number;
  durationDays: number;
  isActive: boolean;
  createdAt: string;
}

/** A membership as the API returns it: the stored row plus the two things
 *  only the server can work out honestly — how it reads today, and how long
 *  is left. */
export interface Membership {
  id: string;
  planId: string;
  planName: string;
  startDate: string;
  expiryDate: string;
  originalExpiryDate: string;
  pricePaid: number;
  durationDays: number;
  extendedDays: number;
  status: MemberStatus;
  daysLeft: number;
}

export interface Member {
  id: string;
  gymId: string;
  /** Readable id the gym uses out loud, e.g. MEM-00125. */
  memberNo: string;
  name: string;
  email: string | null;
  phone: string | null;
  photo: string | null;
  gender: Gender | null;
  dateOfBirth: string | null;
  address: string | null;
  emergencyContact: string | null;
  /** Effective status: `inactive` once a membership has been expired for more
   *  than 60 days, computed by the server on every read. */
  status: string;
  /** What is actually on the row, so a hand-deactivated member can be told
   *  apart from one the calendar retired. */
  storedStatus: string;
  createdAt: string;
  /** Null for a member who has not been sold a membership yet. */
  currentMembership: Membership | null;
}

export interface MemberSummary {
  name: string;
  phone: string | null;
  photo?: string | null;
  /** Only selected on endpoints that show a member alongside a record. */
  memberNo?: string;
}

/** A member paired with a membership, as the dashboard and dues list return
 *  them — the member's own fields flattened, membership alongside. */
export interface MemberWithMembership {
  id: string;
  memberNo: string;
  name: string;
  phone: string | null;
  membership: Membership;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: Role;
  action: string;
  entity: string;
  entityId: string;
  entityLabel: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  createdAt: string;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
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
  member: Pick<MemberSummary, 'name' | 'phone' | 'memberNo'>;
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

export interface RevenueMonth {
  /** `2026-08` — stable key, unlike the display label. */
  month: string;
  label: string;
  total: number;
}

export interface AttendanceDay {
  /** `2026-08-07`. */
  date: string;
  count: number;
}

/** Money, which only an owner ever receives. */
export interface DashboardRevenue {
  thisMonth: number;
  lastMonth: number;
  dueTotal: number;
  byMonth: RevenueMonth[];
}

export interface DashboardStats {
  totalMembers: number;
  activeMembers: number;
  expiringMembers: MemberWithMembership[];
  todayAttendance: number;
  recentMembers: (Pick<Member, 'id' | 'memberNo' | 'name' | 'phone' | 'createdAt'>
    & { currentMembership: Membership | null })[];
  duePayments: number;
  /** Expired more than 60 days ago — off the roster, not on the call list. */
  lapsedMembers: number;
  /** Expired but not yet lapsed: worth a renewal call. */
  followUpMembers: MemberWithMembership[];
  attendanceByDay: AttendanceDay[];
  /** 0–23, or null when nobody has checked in during the window. */
  peakHour: number | null;
  /** Absent for staff — the server omits the key rather than sending zeroes. */
  revenue?: DashboardRevenue;
}

/** The session token is set as an httpOnly cookie and never appears here. */
export interface AuthResponse {
  user: SessionUser;
  gym: Gym;
}
