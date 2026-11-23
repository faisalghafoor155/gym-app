import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { aMembership, mockApi, ownerAuth, renderPage, type AuthState } from '../helpers';
import { partsMatch, splitEvenly } from '../../src/components/payments/installments';
import type { Balances, MembershipBalance } from '../../src/types';

/**
 * Pending Dues with installment plans: each part on the row, what is overdue
 * called out, and a plan agreed from here adding up to what is owed.
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

const Dues = (await import('../../src/pages/Dues')).default;

const aRow = (over: Partial<MembershipBalance> = {}): MembershipBalance => ({
  membershipId: 'ms-1',
  member: { id: 'mem-1', name: 'Bilal Khan', memberNo: 'MEM-00001', phone: '03001234567', status: 'active' },
  membership: aMembership({ planName: 'Quarterly', pricePaid: 6000 }),
  expected: 6000,
  paid: 2000,
  outstanding: 4000,
  installments: [],
  overdue: 0,
  nextDue: null,
  ...over,
});

const setup = (rows: MembershipBalance[]) => {
  auth.current = ownerAuth;
  const balances: Balances = {
    memberships: rows,
    charges: [],
    totalOutstanding: rows.reduce((t, r) => t + r.outstanding, 0),
  };
  api.current = mockApi({ '/payments/balances': balances });
  return api.current;
};

describe('splitting a balance evenly', () => {
  it('puts the odd rupees on the last part so the parts add up exactly', () => {
    const parts = splitEvenly(1000, 3, new Date(2026, 0, 1));
    expect(parts.map(p => p.amount)).toEqual([333, 333, 334]);
    expect(partsMatch(parts, 1000)).toBe(true);
    expect(parts[0].dueDate).toBe('2026-01-31');
  });
});

describe('Dues — installment plans', () => {
  it('shows what is overdue on a row that is behind on its plan', async () => {
    setup([aRow({
      overdue: 2000,
      nextDue: { dueDate: '2026-11-01T00:00:00.000Z', remaining: 2000 },
      installments: [
        { seq: 1, amount: 2000, dueDate: '2026-11-01T00:00:00.000Z', paid: 0, remaining: 2000, status: 'overdue' },
        { seq: 2, amount: 2000, dueDate: '2026-12-01T00:00:00.000Z', paid: 0, remaining: 2000, status: 'due' },
      ],
    })]);

    renderPage(<Dues />);

    expect(await screen.findByText(/Rs\. 2,000 overdue/)).toBeInTheDocument();
    const parts = screen.getByRole('list', { name: 'Installments' });
    expect(within(parts).getAllByRole('listitem')).toHaveLength(2);
  });

  it('agrees a plan for an existing balance, adding up to what is owed', async () => {
    const stub = setup([aRow()]);

    renderPage(<Dues />);
    await userEvent.click(await screen.findByRole('button', { name: /installments/i }));
    await userEvent.selectOptions(screen.getByLabelText(/in installments/i), '2');
    await userEvent.click(screen.getByRole('button', { name: /save plan/i }));

    await waitFor(() => expect(stub.put).toHaveBeenCalled());
    const [url, body] = stub.put.mock.calls[0] as unknown as [string, { installments: { amount: number }[] }];
    expect(url).toBe('/members/mem-1/memberships/ms-1/installments');
    expect(body.installments.map(p => p.amount)).toEqual([2000, 2000]);
  });

  it('refuses to send parts that do not add up to the balance', async () => {
    const stub = setup([aRow()]);

    renderPage(<Dues />);
    await userEvent.click(await screen.findByRole('button', { name: /installments/i }));
    await userEvent.selectOptions(screen.getByLabelText(/in installments/i), '2');
    const first = screen.getByLabelText('Installment 1 amount (Rs.)');
    await userEvent.clear(first);
    await userEvent.type(first, '500');

    expect(screen.getByText(/add up to Rs\. 2,500, but Rs\. 4,000 is owed/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /save plan/i }));
    expect(stub.put).not.toHaveBeenCalled();
  });
});
