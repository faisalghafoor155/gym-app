import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, type RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';

import type {
  AuditLog, Member, Membership, Payment, PaginatedMembers, PaginatedPayments,
  MemberCounts, PaymentSummary,
} from '../src/types';

/**
 * Shared scaffolding for page tests.
 *
 * A page under test needs three things it does not carry itself: a router, an
 * auth context (`useAuth` throws outside its provider), and an API that answers
 * without a server. The first two are supplied here; the third is stubbed per
 * test with `mockApi`, because what the API returns *is* the thing most of
 * these tests are about.
 */

/** The shape `useAuth` hands back. Kept in one place so a change to the context
 *  shows up as one failing import rather than five silent `undefined`s. */
export interface AuthState {
  isOwner: boolean;
  isStaff: boolean;
  isAuth: boolean;
  loading: boolean;
  role: 'owner' | 'staff' | 'member' | null;
}

export const ownerAuth: AuthState = {
  isOwner: true, isStaff: true, isAuth: true, loading: false, role: 'owner',
};

export const staffAuth: AuthState = {
  isOwner: false, isStaff: true, isAuth: true, loading: false, role: 'staff',
};

/** Renders inside the providers every page assumes, on a real (in-memory)
 *  router so `useSearchParams` and `Link` behave as they do in the app. */
export const renderPage = (
  ui: ReactElement,
  { route = '/', ...options }: RenderOptions & { route?: string } = {},
) => render(ui, {
  wrapper: ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
  ),
  ...options,
});

// --- fixtures ---------------------------------------------------------
//
// Builders rather than constants: a test that needs an expired member should
// say so in one line, and should not be able to mutate the fixture the next
// test relies on.

let seq = 0;
const nextNo = () => `MEM-${String(++seq).padStart(5, '0')}`;

export const aMember = (over: Partial<Member> = {}): Member => ({
  id: over.id ?? `member-${seq + 1}`,
  gymId: 'gym-1',
  memberNo: nextNo(),
  name: 'Ali Khan',
  email: null,
  phone: '03001234567',
  photo: null,
  gender: null,
  dateOfBirth: null,
  address: null,
  emergencyContact: null,
  status: 'active',
  storedStatus: 'active',
  currentMembership: null,
  createdAt: new Date().toISOString(),
  ...over,
});

/**
 * A membership on a member's row. `status` and `daysLeft` are what the server
 * derives and the page reads, so a test wanting an expiring member sets those
 * two rather than doing date arithmetic of its own.
 */
export const aMembership = (over: Partial<Membership> = {}): Membership => ({
  id: over.id ?? 'membership-1',
  planId: 'plan-1',
  planName: 'Monthly',
  startDate: new Date().toISOString(),
  expiryDate: new Date().toISOString(),
  pricePaid: 2500,
  durationDays: 30,
  status: 'active',
  daysLeft: 20,
  ...over,
});

export const anAuditLog = (over: Partial<AuditLog> = {}): AuditLog => ({
  id: over.id ?? `log-${seq + 1}`,
  actorId: 'user-1',
  actorName: 'Owner User',
  actorRole: 'owner',
  action: 'member.create',
  entity: 'member',
  entityId: 'member-1',
  entityLabel: 'MEM-00001 · Ali Khan',
  before: null,
  after: null,
  reason: null,
  createdAt: new Date().toISOString(),
  ...over,
});

export const aPayment = (over: Partial<Payment> = {}): Payment => ({
  id: over.id ?? `payment-${seq + 1}`,
  memberId: 'member-1',
  gymId: 'gym-1',
  amount: 2500,
  paymentDate: new Date().toISOString(),
  method: 'cash',
  // Cash by default, so no wallet and no transaction id — a test wanting an
  // online row overrides all three together.
  channel: null,
  reference: null,
  notes: null,
  status: 'paid',
  type: 'membership',
  membershipId: null,
  member: { name: 'Ali Khan', phone: '03001234567', memberNo: 'MEM-00001' },
  recordedBy: null,
  ...over,
});

const emptyCounts: MemberCounts =
  { all: 0, active: 0, expiring: 0, expired: 0, lapsed: 0, none: 0 };

/** The owner-only monthly summary. Every field, because the page reads several
 *  of them straight into `toLocaleString()` and a missing one is a crash. */
export const aSummary = (over: Partial<PaymentSummary> = {}): PaymentSummary => ({
  months: 6,
  from: '2026-03-01',
  to: '2026-08-31',
  byMonth: [],
  grandTotal: 0,
  count: 0,
  thisMonth: 0,
  lastMonth: 0,
  dueTotal: 0,
  dueCount: 0,
  ...over,
});

/** A `/members` response, with the envelope filled in from the rows given. */
export const membersPage = (
  data: Member[],
  over: Partial<PaginatedMembers> = {},
): PaginatedMembers => ({
  data,
  total: data.length,
  page: 1,
  limit: 24,
  hasMore: false,
  counts: { ...emptyCounts, all: data.length, active: data.length },
  ...over,
});

/** A `/payments` response. `collected` and `outstanding` default to the sum of
 *  the rows, which is the *un*interesting case — the tests that care about the
 *  totals covering more than the page pass them explicitly. */
export const paymentsPage = (
  data: Payment[],
  over: Partial<PaginatedPayments> = {},
): PaginatedPayments => ({
  data,
  total: data.length,
  page: 1,
  limit: 50,
  hasMore: false,
  collected: data.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0),
  outstanding: data.filter(p => p.status === 'due').reduce((s, p) => s + p.amount, 0),
  ...over,
});

// --- the API ----------------------------------------------------------

/**
 * Routes each GET to the first matching entry, by substring of the URL.
 *
 * Substring rather than exact match because the pages build query strings, and
 * a test asserting on `?search=ali` should not have to reproduce `limit` and
 * every other parameter to get an answer back. The URL each call was made with
 * is recorded, so a test can assert on what was *asked* as well as what came
 * back — which for server-side search is the whole point.
 */
export const mockApi = (routes: Record<string, unknown>) => {
  const calls: string[] = [];

  // The config is accepted as well as the URL, because some calls carry what
  // they are asking about in `params` rather than in the path — a test that
  // asserts on those needs the argument to have survived the stub.
  const get = vi.fn((url: string, _config?: { params?: Record<string, unknown> }) => {
    calls.push(url);
    const hit = Object.entries(routes).find(([key]) => url.includes(key));
    if (!hit) return Promise.reject(new Error(`No stub for GET ${url}`));
    const body = hit[1];
    return Promise.resolve({ data: typeof body === 'function' ? body(url) : body });
  });

  return {
    get,
    post: vi.fn(() => Promise.resolve({ data: {} })),
    put: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
    calls,
    /** Every URL fetched from `path`, in order. */
    callsTo: (path: string) => calls.filter(u => u.includes(path)),
  };
};
