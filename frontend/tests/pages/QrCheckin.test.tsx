import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';

import { renderPage } from '../helpers';

/**
 * The page a member's phone opens after scanning the gym's check-in QR.
 *
 * It has to send exactly one check-in, show the outcome in words a member
 * understands, and — when the phone is not signed in — remember the scan so
 * the member lands back here after signing in.
 */

const post = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({ current: { isAuth: true, loading: false } }));

vi.mock('../../src/api/client', () => ({
  default: { post: (...args: unknown[]) => post(...args) },
  apiError: (e: unknown, fallback = 'Something went wrong') =>
    (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback,
}));

vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => auth.current }));

const QrCheckin = (await import('../../src/pages/QrCheckin')).default;

const result = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  memberId: 'm1',
  gymId: 'g1',
  checkedInAt: new Date().toISOString(),
  member: { name: 'Ali Khan', phone: null },
  membership: { planName: 'Monthly', status: 'active', daysLeft: 12 },
  fee: { amount: 3000, paid: 3000, balance: 0 },
  alreadyCheckedIn: false,
  ...over,
});

const open = (route = '/checkin?t=tok123') =>
  renderPage(
    <Routes>
      <Route path="/checkin" element={<QrCheckin />} />
      <Route path="/login" element={<p>login page</p>} />
    </Routes>,
    { route },
  );

beforeEach(() => {
  post.mockReset();
  auth.current = { isAuth: true, loading: false };
  sessionStorage.clear();
});

describe('QrCheckin', () => {
  it('sends the scanned token once and shows the member checked in', async () => {
    post.mockResolvedValue({ data: result() });

    open();

    expect(await screen.findByText(/you’re checked in/i)).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/me/checkin', { token: 'tok123' });
    expect(screen.getByText(/12 days left/)).toBeInTheDocument();
  });

  it('says so when the member was already checked in today', async () => {
    post.mockResolvedValue({ data: result({ alreadyCheckedIn: true }) });

    open();

    expect(await screen.findByText(/already checked in today/i)).toBeInTheDocument();
  });

  it('shows a fee still owed', async () => {
    post.mockResolvedValue({ data: result({ fee: { amount: 3000, paid: 2000, balance: 1000 } }) });

    open();

    expect(await screen.findByText(/fee due/i)).toBeInTheDocument();
  });

  it('shows the server’s reason when the code has expired', async () => {
    post.mockRejectedValue({ response: { data: { error: 'This QR code has expired. Scan the code on the gym screen again.' } } });

    open();

    expect(await screen.findByText(/not checked in/i)).toBeInTheDocument();
    expect(screen.getByText(/has expired/i)).toBeInTheDocument();
  });

  it('does not call the server for a link with no code', async () => {
    open('/checkin');

    expect(await screen.findByText(/no check-in code/i)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('sends a signed-out phone to login and remembers the scan for afterwards', async () => {
    auth.current = { isAuth: false, loading: false };

    open();

    expect(await screen.findByText('login page')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('gym:afterLogin')).toBe('/checkin?t=tok123');
  });
});
