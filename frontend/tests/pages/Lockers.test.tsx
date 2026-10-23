import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockApi, renderPage } from '../helpers';
import type { Locker, LockerList } from '../../src/types';

/**
 * The lockers page: what is free, who holds what, and the lockers held by
 * members whose membership has run out.
 */

const api = vi.hoisted(() => ({ current: null as ReturnType<typeof import('../helpers')['mockApi']> | null }));

vi.mock('../../src/api/client', () => ({
  default: {
    get: (...args: unknown[]) => api.current!.get(...args as [string]),
    post: (...args: unknown[]) => api.current!.post(...args as []),
    put: (...args: unknown[]) => api.current!.put(...args as []),
    delete: (...args: unknown[]) => api.current!.delete(...args as []),
  },
  apiError: (_e: unknown, fallback = 'Something went wrong') => fallback,
}));
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const Lockers = (await import('../../src/pages/Lockers')).default;

const locker = (over: Partial<Locker>): Locker => ({
  id: crypto.randomUUID(), number: '1', location: null, notes: null, assignedAt: null,
  member: null, holderExpired: false, ...over,
});

const list: LockerList = {
  data: [
    locker({ number: '1' }),
    locker({
      number: '2', assignedAt: '2026-09-01T00:00:00Z',
      member: { id: 'm1', name: 'Ali', memberNo: 'MEM-00001', phone: null, planName: 'Monthly', planIncludesLocker: false, expiryDate: '2026-12-01', daysLeft: 40 },
    }),
    locker({
      number: '3', holderExpired: true, assignedAt: '2026-08-01T00:00:00Z',
      member: { id: 'm2', name: 'Bilal', memberNo: 'MEM-00002', phone: null, planName: 'Monthly', planIncludesLocker: false, expiryDate: '2026-10-01', daysLeft: -21 },
    }),
  ],
  counts: { total: 3, free: 1, taken: 2, expired: 1 },
};

describe('Lockers', () => {
  it('flags a locker held by an expired member and frees them all in one go', async () => {
    api.current = mockApi({ '/lockers': list });
    renderPage(<Lockers />);

    expect(await screen.findByText('Expired 21d ago')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /free all expired \(1\)/i }));
    const dialog = await screen.findByRole('dialog', { name: /free expired lockers/i });
    await userEvent.click(within(dialog).getByRole('button', { name: /^free$/i }));

    await waitFor(() => expect(api.current!.post).toHaveBeenCalledWith('/lockers/release-expired'));
  });

  it('filters to free lockers only', async () => {
    api.current = mockApi({ '/lockers': list });
    renderPage(<Lockers />);
    await screen.findByText('Ali');

    await userEvent.click(screen.getByRole('tab', { name: /^free/i }));
    expect(screen.queryByText('Ali')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^assign$/i })).toBeInTheDocument();
  });
});
