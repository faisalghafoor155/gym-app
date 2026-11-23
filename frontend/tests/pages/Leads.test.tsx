import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockApi, ownerAuth, renderPage, type AuthState } from '../helpers';
import type { Lead, LeadList } from '../../src/types';

/**
 * Free trials on the Leads page: offering one to an open lead, and checking a
 * lead in while it runs.
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

const Leads = (await import('../../src/pages/Leads')).default;

const todayYmd = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });

const aLead = (over: Partial<Lead> = {}): Lead => ({
  id: 'lead-1', name: 'Ali Khan', phone: '03001234567', source: 'walk-in', interest: null, notes: null,
  status: 'new', followUpOn: `${todayYmd()}T00:00:00.000Z`, lostReason: null, trialUntil: null,
  _count: { visits: 0 }, createdAt: new Date().toISOString(), member: null, createdBy: null,
  ...over,
});

const setup = (leads: Lead[]) => {
  auth.current = ownerAuth;
  const list: LeadList = {
    data: leads, total: leads.length, page: 1, limit: 100, hasMore: false,
    counts: { all: leads.length, new: 1, contacted: 0, trial: 0, joined: 0, lost: 0, due: leads.length },
    bySource: [],
  };
  api.current = mockApi({ '/leads': list });
  return api.current;
};

describe('Leads — free trials', () => {
  it('starts a trial of the chosen length', async () => {
    const stub = setup([aLead()]);

    renderPage(<Leads />);
    await userEvent.click(await screen.findByRole('button', { name: /free trial/i }));
    await userEvent.selectOptions(screen.getByLabelText(/trial length/i), '5');
    await userEvent.click(screen.getByRole('button', { name: /start trial/i }));

    await waitFor(() => expect(stub.post).toHaveBeenCalled());
    expect(stub.post.mock.calls[0]).toEqual(['/leads/lead-1/trial', { days: 5 }]);
  });

  it('checks a lead in while the trial runs, instead of offering another', async () => {
    const stub = setup([aLead({ status: 'trial', trialUntil: `${todayYmd()}T00:00:00.000Z`, _count: { visits: 1 } })]);
    stub.post.mockImplementation(() => Promise.resolve({ data: { visits: 2, alreadyCheckedIn: false } }));

    renderPage(<Leads />);
    expect(await screen.findByText(/1 visit/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /free trial/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /check in/i }));

    await waitFor(() => expect(stub.post).toHaveBeenCalled());
    expect(stub.post.mock.calls[0]).toEqual(['/leads/lead-1/checkin']);
  });
});
