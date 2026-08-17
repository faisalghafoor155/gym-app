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
/** What the money was for. Membership payments name the membership they
 *  settle; supplement sales and one-off fees have nothing to point at. */
export type PaymentType = 'membership' | 'supplement' | 'other';
export type SupplementCategory =
  | 'protein' | 'creatine' | 'preworkout' | 'bcaa' | 'vitamins' | 'fatburner' | 'other';

export type Role = 'owner' | 'staff' | 'member';

export type StaffPermission = 'manager' | 'members_manager' | 'accountant' | 'receptionist' | 'inventory_manager';

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
  staffPermission?: StaffPermission | null;
}

/** How many staff accounts the gym may have, and how many are spoken for.
 *  Revoked accounts still hold their seat — deleting is what frees one. */
export interface StaffSeats {
  limit: number;
  used: number;
  remaining: number;
}

/** The accounts list, with the seat count the page needs to render alongside. */
export interface TeamResponse {
  users: GymUser[];
  seats: StaffSeats;
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
  staffPermission?: StaffPermission | null;
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
  extensionReason: string | null;
  status: MemberStatus;
  daysLeft: number;
  freezeStartDate: string | null;
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

/** The members page's tab counts, over the whole roster rather than a page. */
export interface MemberCounts {
  all: number;
  active: number;
  expiring: number;
  expired: number;
  lapsed: number;
  none: number;
}

export interface PaginatedMembers extends Paginated<Member> {
  counts: MemberCounts;
}

/**
 * The payments list, which carries its own totals.
 *
 * They cover everything matching the filters rather than the rows in this page
 * — the tiles above the table say "matching filters", and summing a page in the
 * browser could only ever total the page.
 */
export interface PaginatedPayments extends Paginated<Payment> {
  collected: number;
  outstanding: number;
}

export interface AttendanceRecord {
  id: string;
  memberId: string;
  gymId: string;
  checkedInAt: string;
  member: MemberSummary;
}

/**
 * What a check-in answers with.
 *
 * `alreadyCheckedIn` is the server's verdict, not the page's: this page's own
 * guard reads a list fetched seconds ago, so a second receptionist can beat it.
 * When it is true the record is the existing row, and nothing was created.
 *
 * `membership` rides along so the desk learns the member's standing at the one
 * moment it can act on it — an expired membership never blocks the check-in.
 */
export interface CheckinResult extends AttendanceRecord {
  membership: Membership | null;
  alreadyCheckedIn: boolean;
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
  type: PaymentType;
  /** The membership this settled, when it was for one. */
  membershipId: string | null;
  member: Pick<MemberSummary, 'name' | 'phone' | 'memberNo'>;
  /** Who took the money. Null for rows predating the field, or whose author's
   *  account has since been removed. */
  recordedBy: { id: string; name: string } | null;
}

/** One calendar month of takings, split by what the money was for. */
export interface PaymentMonth {
  /** `2026-08` — stable key, unlike the display label. */
  month: string;
  label: string;
  membership: number;
  supplement: number;
  other: number;
  total: number;
  count: number;
}

/** Owner-only: the gym's books, month by month. Settled money only — what is
 *  still owed is reported apart from it, never folded in. */
export interface PaymentSummary {
  months: number;
  from: string;
  to: string;
  byMonth: PaymentMonth[];
  grandTotal: number;
  count: number;
  thisMonth: number;
  lastMonth: number;
  dueTotal: number;
  dueCount: number;
}

/** One entry inside a member's month — the individual receipt behind a total. */
export interface MonthlyCollectionEntry {
  id: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  type: PaymentType;
  notes: string | null;
  paymentDate: string;
  recordedBy: { id: string; name: string } | null;
}

/**
 * One member's month. Everything they paid folded into a single row, with the
 * individual entries kept so a row can be expanded without another request.
 */
export interface MonthlyCollectionRow {
  memberId: string;
  memberNo: string;
  name: string;
  phone: string | null;
  /** Settled money only. */
  paid: number;
  /** Still owed from entries dated inside this month. */
  due: number;
  count: number;
  /** Null when the member has only unpaid entries this month. */
  lastPaymentAt: string | null;
  payments: MonthlyCollectionEntry[];
}

/** Which side of the month is being asked about. */
export type CollectionView = 'paid' | 'unpaid' | 'all';

/**
 * One member who still owes for the month.
 *
 * Driven by their membership rather than by payment rows — which is what lets
 * a member who has paid nothing at all appear here, having no payment row to
 * be found by.
 */
export interface UnpaidRow {
  memberId: string;
  memberNo: string;
  name: string;
  phone: string | null;
  membership: Membership;
  /** The membership's price — what should have been collected. */
  expected: number;
  /** Settled against that membership, whenever it was paid. */
  paid: number;
  /** `expected - paid`, never negative. */
  shortfall: number;
}

/** Owner-only: who paid in a given month, as opposed to how much it brought in. */
export interface MonthlyCollection {
  /** `2026-08` — the key that was asked for. */
  month: string;
  label: string;
  from: string;
  to: string;
  view: CollectionView;
  /** Who paid. Empty on the `unpaid` view. */
  data: MonthlyCollectionRow[];
  /** Who has not. Empty on the `paid` view. */
  unpaid: UnpaidRow[];
  memberCount: number;
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  /** Totalled over the whole month, never over the current page. */
  collected: number;
  outstanding: number;
  paymentCount: number;
  /** Totalled over everyone who owes — the unpaid side's headline figures. */
  shortfallTotal: number;
  expectedTotal: number;
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

/** One sale across the counter, as the sales report returns it. */
export interface SupplementSale {
  id: string;
  supplementId: string;
  supplementName: string;
  memberId: string | null;
  /** Ready-made label — a member's "MEM-00012 · Ali Khan", or "Walk-in". */
  buyer: string;
  quantity: number;
  unitPrice: number;
  total: number;
  paymentId: string | null;
  soldAt: string;
  notes: string | null;
}

export interface SalesMonth {
  /** `2026-08` — stable key, unlike the display label. */
  month: string;
  label: string;
  revenue: number;
  units: number;
  sales: number;
}

export interface SalesReport {
  byMonth: SalesMonth[];
  byProduct: { id: string; name: string; units: number; revenue: number }[];
  totalRevenue: number;
  totalUnits: number;
  recent: SupplementSale[];
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
/** This calendar month's takings, split by what the money was for. Counted
 *  from the 1st, not the last 30 days, so it reconciles against the books. */
export interface MonthToDate {
  from: string;
  to: string;
  membership: number;
  supplement: number;
  other: number;
  total: number;
  /** How many payments make up the total. */
  count: number;
}

/**
 * This month's fees as a head count: how many members have settled and how
 * many have not. Counted from the memberships that ran during the month, so
 * `settled + pending` is everyone who owed anything — a member who has paid
 * nothing still appears, having no payment row to be found by.
 */
export interface MonthCollection {
  settled: number;
  pending: number;
  /** Collected against those memberships, capped at what was owed. */
  collected: number;
  /** What is still to come in. */
  shortfall: number;
  /** `collected + shortfall` — the month's full expected takings. */
  expected: number;
}

export interface DashboardRevenue {
  thisMonth: number;
  lastMonth: number;
  /** Every payment ever marked `due`, across all time — not this month's
   *  shortfall. `collection.shortfall` is the figure for that. */
  dueTotal: number;
  byMonth: RevenueMonth[];
  monthToDate: MonthToDate;
  collection: MonthCollection;
}

export interface DashboardStats {
  totalMembers: number;
  activeMembers: number;
  expiringMembers: MemberWithMembership[];
  todayAttendance: number;
  recentMembers: (Pick<Member, 'id' | 'memberNo' | 'name' | 'phone' | 'createdAt'>
    & { currentMembership: Membership | null })[];
  /** Memberships whose term has run out — a head count of people to chase,
   *  not a sum of money and not a count of payment rows. */
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

/**
 * The answer to a password or Google sign-in when the account has a second
 * factor. No session is issued yet — the token proves the first factor and
 * is traded, with the authenticator code, at /auth/two-factor/verify-login.
 */
export interface TwoFactorChallenge {
  requiresTwoFactor: true;
  twoFactorToken: string;
}

/** What /auth/login and /auth/google answer: a session, or the challenge. */
export type LoginResponse = AuthResponse | TwoFactorChallenge;

/** Narrows a LoginResponse — the challenge carries no user object. */
export const isTwoFactorChallenge = (r: LoginResponse): r is TwoFactorChallenge =>
  'requiresTwoFactor' in r;
