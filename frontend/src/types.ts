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
/** Which wallet or bank an online payment came through. Null on cash. */
export type PaymentChannel = 'easypaisa' | 'jazzcash' | 'bank';
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

/**
 * One recorded action. Owner-only: the trail names which member of staff did
 * what.
 *
 * `before`/`after` carry only the fields that changed, so a row is readable
 * without fetching the thing it points at — which matters most when that thing
 * has since been deleted and the log is all that is left of it.
 */
export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: Role;
  /** Dotted verb, e.g. `member.create`, `membership.renew`. */
  action: string;
  /** The kind of thing acted on, e.g. `member`, `payment`. */
  entity: string;
  entityId: string;
  /** Human-readable stand-in, e.g. "MEM-00125 · Ali Khan". */
  entityLabel: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  /** Why, where the action called for a justification. */
  reason: string | null;
  createdAt: string;
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
  pricePaid: number;
  durationDays: number;
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
  /** True once the member has asked not to be messaged on WhatsApp. Email is
   *  unaffected — opting out of one is not opting out of both. */
  whatsappOptOut: boolean;
  /** Effective status: `inactive` once a membership has been expired for more
   *  than 60 days, computed by the server on every read. */
  status: string;
  /** What is actually on the row, so a hand-deactivated member can be told
   *  apart from one the calendar retired. */
  storedStatus: string;
  createdAt: string;
  /** Null for a member who has not been sold a membership yet. */
  currentMembership: Membership | null;
  trainerId?: string | null;
  trainer?: { id: string; name: string } | null;
  /** The member's fingerprint enrolment, or null. Never carries the template
   *  itself — the roster only needs to know one exists. */
  fingerprint?: FingerprintEnrolment | null;
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

/** Whether the gym has a fingerprint reader, and whether it is answering. */
export interface FingerprintStatus {
  /** A reader is wired up in the backend's device registry. */
  configured: boolean;
  /** It is configured *and* responding right now. */
  online: boolean;
  label: string;
  /** The template encoding this reader produces, e.g. `zkteco-v10`. */
  format: string;
  /** True when the reader holds its own template store and matches internally,
   *  which decides whether check-in sends an id or a captured template. */
  matchesLocally: boolean;
  enrolledCount: number;
}

/** What identifying a finger answers with. A miss is an ordinary outcome
 *  rather than an error, hence `matched` instead of a thrown status. */
export type FingerprintIdentifyResult =
  | {
      matched: true;
      member: Pick<Member, 'id' | 'name' | 'photo' | 'memberNo'>;
      score?: number;
    }
  | { matched: false; reason: 'no_match' | 'no_enrolments' };

/** A member's enrolment, as the member page shows it. */
export interface FingerprintEnrolment {
  id: string;
  enrolledAt: string;
  finger: string | null;
  format: string;
}

export interface Payment {
  id: string;
  memberId: string;
  gymId: string;
  amount: number;
  paymentDate: string;
  method: PaymentMethod;
  /** Which wallet the money came through. Null for cash, and for online rows
   *  recorded before the channel was tracked. */
  channel: PaymentChannel | null;
  /** The wallet's transaction id, when the front desk was given one. */
  reference: string | null;
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
  channel: PaymentChannel | null;
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

export interface WorkoutExercise {
  name: string;
  sets: number;
  reps: string;
  weight: string;
}

export interface DailyWorkout {
  day: string;
  exercises: WorkoutExercise[];
}

export interface DietItem {
  name: string;
  amount: string;
  calories: number;
}

export interface DietMeal {
  name: string;
  items: DietItem[];
}

export interface Plan {
  id: string;
  gymId: string;
  name: string;
  description: string | null;
  workoutData?: {
    days: DailyWorkout[];
  };
  dietData?: {
    meals: DietMeal[];
  };
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
  expenses: number;
  /** Carried per month rather than derived here, so the chart and the tiles
   *  are reading the same number. */
  profit: number;
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
  expensesThisMonth: number;
  expensesLastMonth: number;
  /** What the gym actually kept: revenue less expenses, computed server-side
   *  so the tile and the chart can never disagree. */
  profitThisMonth: number;
  profitLastMonth: number;
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

export interface Trainer {
  id: string;
  name: string;
  phone?: string | null;
  specialization?: string | null;
  commissionPercentage: number;
  /** What assigning this trainer costs. Null means the gym default applies —
   *  distinct from 0, which is a deliberate decision to charge nothing. */
  ptFee: number | null;
  isActive: boolean;
  createdAt: string;
  activeMembersCount: number;
}

/** Gym-wide settings: the prices that are not a plan or a product. */
export interface GymSettings {
  name: string;
  ownerName: string;
  phone: string | null;
  defaultPtFee: number;
  /** Where members are told to send money, per channel. Free text — a wallet
   *  is a phone number, a bank is a name plus an IBAN. Null when the gym has
   *  not published that channel's details. */
  easypaisaAccount: string | null;
  jazzcashAccount: string | null;
  bankAccount: string | null;
}

export interface PtSession {
  id: string;
  member: { id: string; name: string; memberNo?: string | null };
  trainer: { id: string; name: string; specialization?: string | null };
  sessionDate: string;
  priceCharged: number;
  trainerCommission: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  paymentStatus: 'unpaid' | 'paid';
  createdAt: string;
}

export interface TrainerCommissionReport {
  trainerId: string;
  trainerName: string;
  specialization: string | null;
  commissionPercentage: number;
  totalSessions: number;
  totalRevenue: number;
  totalCommission: number;
}

/** A trainer's commission position, as `GET /payouts` reports it: what they
 *  have earned across completed sessions, and how much of that is still owed. */
export interface TrainerPayout {
  trainerId: string;
  trainerName: string;
  commissionPercentage: number;
  totalSessionsCount: number;
  totalEarned: number;
  unpaidCommission: number;
  paidCommission: number;
}

export interface Class {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ClassSchedule {
  id: string;
  classId: string;
  className: string;
  classDescription?: string | null;
  trainer: { id: string; name: string } | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  capacity: number;
  bookingsCount: number;
  remainingCapacity: number;
}

export interface ClassBooking {
  id: string;
  bookingDate: string;
  status: 'booked' | 'attended' | 'cancelled';
  createdAt: string;
  member: { id: string; name: string; memberNo?: string | null };
  schedule: {
    id: string;
    className: string;
    trainerName?: string | null;
    startTime: string;
    endTime: string;
    dayOfWeek: number;
  };
}

/** A payment provider the member may pick at checkout. */
export interface PaymentProviderOption {
  provider: string;
  label: string;
  /** False for the front-desk fallback, which has nowhere to redirect to. */
  redirects: boolean;
}

/**
 * What starting a checkout returns. Deliberately not a receipt: it is the
 * signed form to hand the provider, and says nothing about whether money
 * moved. `url` is empty when the gym has no gateway configured.
 */
export interface CheckoutStarted {
  intentId: string;
  provider: string;
  amount: number;
  url: string;
  fields: Record<string, string>;
}

/** Money the gym spent. The other half of the books from Payment. */
export interface Expense {
  id: string;
  category: string;
  amount: number;
  spentOn: string;
  vendor: string | null;
  notes: string | null;
  createdAt: string;
  recordedBy: { id: string; name: string } | null;
}

export interface ExpenseList {
  data: Expense[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  /** Across the whole filtered set, not just the page shown. */
  totalSpent: number;
  byCategory: { category: string; total: number }[];
}

/** Money in, money out, and what is left. */
export interface ProfitReport {
  from: string | null;
  to: string | null;
  revenue: number;
  expenses: number;
  profit: number;
  /** Owed but not yet received — reported beside profit, never inside it. */
  outstanding: number;
  revenueByType: { type: string; total: number }[];
  expensesByCategory: { category: string; total: number }[];
}
