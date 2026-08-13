import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  aPayment, aSummary, mockApi, membersPage, paymentsPage, ownerAuth, staffAuth, renderPage,
  type AuthState,
} from '../helpers';

/**
 * The payments page.
 *
 * Two things here are worth a test more than the rest of the screen is. The
 * tiles above the table say "matching filters" and read totals the *server*
 * computed over every matching row — a page that went back to summing what it
 * happened to be holding would under-report money and look right doing it. And
 * the filters are now query parameters rather than a local `.filter()`, so what
 * matters is what the page *asks for*, not what it does with the answer.
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
  useAuth: () => auth.current,
}));

// The page fires a toast on every save; none of these tests assert on them.
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const Payments = (await import('../../src/pages/Payments')).default;

/** Stubs the three endpoints the page loads on mount. */
const setup = (over: {
  payments?: ReturnType<typeof paymentsPage>;
  auth?: typeof ownerAuth;
} = {}) => {
  auth.current = over.auth ?? ownerAuth;
  api.current = mockApi({
    '/payments/summary': aSummary(),
    '/payments': over.payments ?? paymentsPage([aPayment()]),
    '/members': membersPage([]),
  });
  return api.current;
};

describe('Payments — the totals above the table', () => {
  it('shows what the server totalled, not the sum of the page', async () => {
    // Five rows on screen; the filters match far more than that.
    setup({
      payments: paymentsPage(
        Array.from({ length: 5 }, (_, i) => aPayment({ id: `p${i}`, amount: 100 })),
        { total: 40, hasMore: true, collected: 4000, outstanding: 750 },
      ),
    });

    renderPage(<Payments />);

    // 4000, not the 500 sitting in `data`. This is the assertion the whole
    // server-side totalling exists for.
    expect(await screen.findByText('Rs. 4,000')).toBeInTheDocument();
    expect(screen.getByText('Rs. 750')).toBeInTheDocument();
  });

  it('counts every match, not the rows it was given', async () => {
    setup({
      payments: paymentsPage([aPayment()], { total: 213, hasMore: true }),
    });

    renderPage(<Payments />);

    expect(await screen.findByText('213')).toBeInTheDocument();
  });

  it('shows zero rather than nothing when there are no payments', async () => {
    setup({ payments: paymentsPage([]) });

    renderPage(<Payments />);

    // "Rs. undefined" is what a missing total renders as, and it reads as a
    // bug in the books rather than an empty month.
    await waitFor(() => {
      expect(screen.getAllByText('Rs. 0').length).toBeGreaterThan(0);
    });
  });
});

describe('Payments — filters reach the server', () => {
  it('asks for a status when a tab is picked', async () => {
    const stub = setup();
    renderPage(<Payments />);
    await screen.findByRole('button', { name: /export csv/i });

    // The filters are a tablist, not plain buttons — queried by the role the
    // markup actually uses, so a change to it fails here rather than silently
    // finding nothing.
    await userEvent.click(screen.getByRole('tab', { name: /^Due/ }));

    await waitFor(() => {
      expect(stub.callsTo('/payments?').some(u => u.includes('status=due'))).toBe(true);
    });
  });

  it('sends the search to the server rather than filtering what it holds', async () => {
    const stub = setup();
    renderPage(<Payments />);
    await screen.findByRole('button', { name: /export csv/i });

    await userEvent.type(screen.getByPlaceholderText(/search/i), 'zainab');

    // Debounced, so this is the one place a wait is about time rather than a
    // pending request.
    await waitFor(
      () => {
        expect(stub.callsTo('/payments?').some(u => u.includes('search=zainab'))).toBe(true);
      },
      { timeout: 2000 },
    );
  });

  it('always bounds the request', async () => {
    const stub = setup();
    renderPage(<Payments />);

    await waitFor(() => {
      const first = stub.callsTo('/payments?')[0];
      // Without a limit the endpoint would fall back to its default — fine,
      // but then the page and the API disagree about a page size the "Show
      // more" arithmetic depends on.
      expect(first).toContain('limit=');
    });
  });
});

describe('Payments — paging', () => {
  it('offers more, and says how many are left', async () => {
    setup({
      payments: paymentsPage(
        [aPayment({ id: 'p1' })],
        { total: 60, hasMore: true },
      ),
    });

    renderPage(<Payments />);

    // 60 matching, 1 loaded.
    expect(await screen.findByRole('button', { name: /show more · 59 left/i }))
      .toBeInTheDocument();
  });

  it('offers nothing more when everything is loaded', async () => {
    setup({ payments: paymentsPage([aPayment()]) });

    renderPage(<Payments />);
    await screen.findByRole('button', { name: /export csv/i });

    expect(screen.queryByRole('button', { name: /show more/i })).not.toBeInTheDocument();
  });

  it('asks for the next page, keeping the filters', async () => {
    const stub = setup({
      payments: paymentsPage([aPayment({ id: 'p1' })], { total: 60, hasMore: true }),
    });

    renderPage(<Payments />);
    await userEvent.click(await screen.findByRole('button', { name: /show more/i }));

    await waitFor(() => {
      const paged = stub.callsTo('page=2');
      expect(paged).toHaveLength(1);
      // A "show more" that dropped the filters would append rows from a
      // different query to the list on screen.
      expect(paged[0]).toContain('limit=');
    });
  });
});

describe('Payments — what staff may see', () => {
  it('hides the monthly summary from staff, which the API refuses them anyway', async () => {
    const stub = setup({ auth: staffAuth });

    renderPage(<Payments />);
    await screen.findByRole('button', { name: /export csv/i });

    // Asking would earn a 403 and a toast, so the page does not ask.
    expect(stub.callsTo('/payments/summary')).toHaveLength(0);
  });

  it('asks for it for an owner', async () => {
    const stub = setup({ auth: ownerAuth });

    renderPage(<Payments />);

    await waitFor(() => {
      expect(stub.callsTo('/payments/summary').length).toBeGreaterThan(0);
    });
  });
});
