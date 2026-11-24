import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import toast from 'react-hot-toast';

import { aMember, aMembership, membersPage, mockApi, ownerAuth, renderPage, type AuthState } from '../helpers';
import type { AttendanceRecord, Member } from '../../src/types';

/**
 * The front desk's Attendance page, search tab: it searches the server rather
 * than a copy of the roster, posts exactly the member picked, will not post a
 * second check-in for somebody already in, and — when the gym turns away
 * members behind on an installment plan — tells the desk who and how much
 * instead of a bare "Check-in failed".
 */

const api = vi.hoisted(() => ({ current: null as ReturnType<typeof import('../helpers')['mockApi']> | null }));
const auth = vi.hoisted(() => ({ current: null as unknown as AuthState }));

vi.mock('../../src/api/client', () => ({
  default: {
    get: (url: string) => api.current!.get(url),
    post: (...args: unknown[]) => api.current!.post(...args as []),
    put: (...args: unknown[]) => api.current!.put(...args as []),
    delete: (...args: unknown[]) => api.current!.delete(...args as []),
  },
  apiError: (_e: unknown, fallback = 'Something went wrong') => fallback,
}));

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ ...auth.current, gym: { name: 'Test Gym' } }),
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const Attendance = (await import('../../src/pages/Attendance')).default;

const aRecord = (member: Member): AttendanceRecord => ({
  id: `att-${member.id}`,
  memberId: member.id,
  gymId: 'gym-1',
  checkedInAt: new Date().toISOString(),
  member: { name: member.name, phone: member.phone, photo: null },
} as AttendanceRecord);

const ali = aMember({ id: 'mem-ali', name: 'Ali Khan', currentMembership: aMembership() });
const sara = aMember({ id: 'mem-sara', name: 'Sara Ahmed', phone: '03111111111' });

const setup = (today: AttendanceRecord[] = []) => {
  auth.current = ownerAuth;
  api.current = mockApi({
    '/attendance/today': today,
    '/fingerprint/status': { configured: false, licensed: true, online: false, enrolledCount: 0, label: '' },
    '/members': membersPage([ali, sara]),
  });
  return api.current;
};

/** Types into the desk's search box and waits for the debounced server search. */
const searchFor = async (text: string) => {
  await userEvent.type(screen.getByLabelText('Search member to check in'), text);
  await screen.findByText('Ali Khan', {}, { timeout: 3000 });
};

beforeEach(() => vi.clearAllMocks());

describe('Attendance — search check-in', () => {
  it("lists today's check-ins from the server", async () => {
    setup([aRecord(sara)]);

    renderPage(<Attendance />);

    expect(await screen.findByText('Sara Ahmed')).toBeInTheDocument();
    expect(screen.queryByText('No check-ins yet today')).not.toBeInTheDocument();
  });

  it('searches the server, not a roster held in the page', async () => {
    const stub = setup();

    renderPage(<Attendance />);
    await searchFor('ali');

    const searches = stub.callsTo('/members');
    expect(searches.length).toBeGreaterThan(0);
    expect(searches.at(-1)).toContain('search=ali');
  });

  it('checks in exactly the member picked', async () => {
    const stub = setup();
    stub.post.mockResolvedValueOnce({
      data: { ...aRecord(ali), membership: ali.currentMembership, fee: null, alreadyCheckedIn: false },
    } as never);

    renderPage(<Attendance />);
    await searchFor('ali');
    const [aliButton] = screen.getAllByRole('button', { name: /check in/i });
    await userEvent.click(aliButton);

    await waitFor(() => expect(stub.post).toHaveBeenCalledTimes(1));
    expect(stub.post).toHaveBeenCalledWith('/attendance/checkin', { memberId: 'mem-ali' });
  });

  it('will not post a second check-in for somebody already in today', async () => {
    const stub = setup([aRecord(ali)]);

    renderPage(<Attendance />);
    await searchFor('ali');

    const done = await screen.findByRole('button', { name: /done/i });
    expect(done).toBeDisabled();
    await userEvent.click(done);
    expect(stub.post).not.toHaveBeenCalled();
  });

  it('names the member and the overdue amount when an installment blocks the check-in', async () => {
    const stub = setup();
    stub.post.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 403, data: { reason: 'installment_overdue', fee: { overdue: 2500 } } },
    } as never);

    renderPage(<Attendance />);
    await searchFor('ali');
    await userEvent.click(screen.getAllByRole('button', { name: /check in/i })[0]);

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const [message] = vi.mocked(toast.error).mock.calls[0];
    expect(message).toContain('Ali Khan');
    expect(message).toContain('Rs. 2,500');
    expect(message).toContain('Pending Dues');
  });

  it('falls back to the plain failure message for any other refusal', async () => {
    const stub = setup();
    stub.post.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 500, data: { error: 'boom' } },
    } as never);

    renderPage(<Attendance />);
    await searchFor('ali');
    await userEvent.click(screen.getAllByRole('button', { name: /check in/i })[0]);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Check-in failed'));
  });
});
