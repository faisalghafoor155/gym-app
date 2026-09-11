import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  aMember, aMembership, aPayment, aSummary, mockApi, membersPage, paymentsPage, ownerAuth, staffAuth, renderPage,
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

/**
 * Recording, correcting and removing a payment.
 *
 * The gap the docs name: the totals and filters were covered, the page's own
 * writes were not. What is asserted here is the payload rather than the form,
 * because every rule in `handleSave` exists to stop the server being told
 * something false about money — a wallet name left on a cash row, a membership
 * still attached to a supplement sale, or an edit that quietly moves a payment
 * to a different member.
 */
describe('Payments — recording one', () => {
  /** Opens the modal on a page holding one member to pick. */
  const openForm = async (
    over: Parameters<typeof setup>[0] & { withMembership?: boolean } = {},
  ) => {
    const stub = setup(over);
    const member = aMember({
      id: 'm1',
      name: 'Ali Khan',
      currentMembership: over.withMembership
        ? aMembership({ id: 'mem-9', planName: 'Monthly' })
        : null,
    });
    api.current!.get = vi.fn((url: string) => {
      api.current!.calls.push(url);
      if (url.includes('/payments/summary')) return Promise.resolve({ data: aSummary() });
      if (url.includes('/members')) {
        return Promise.resolve({ data: membersPage([member]) });
      }
      return Promise.resolve({ data: over.payments ?? paymentsPage([]) });
    });

    renderPage(<Payments />);
    await userEvent.click(await screen.findByRole('button', { name: /record payment/i }));
    return stub;
  };

  it('sends a cash payment with the wallet fields explicitly null', async () => {
    const stub = await openForm();

    await userEvent.selectOptions(await screen.findByLabelText(/member/i), 'm1');
    await userEvent.type(screen.getByLabelText(/amount/i), '2500');
    await userEvent.click(screen.getByRole('button', { name: /^record$/i }));

    await waitFor(() => expect(stub.post).toHaveBeenCalled());
    const [url, body] = stub.post.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(url).toBe('/payments');
    // Null rather than absent: the API distinguishes "no wallet" from "field
    // not sent". Note the form's own onChange also clears these when the
    // method is cash, so this pins the payload the server receives rather
    // than the `method === 'cash'` guard in `handleSave`, which sits behind
    // it as defence in depth.
    expect(body).toMatchObject({
      channel: null, reference: null, amount: '2500', memberId: 'm1',
    });
  });

  it('drops a membership picked before the type was switched away from it', async () => {
    // The member has a membership, so the link is offered and can be chosen.
    const stub = await openForm({ withMembership: true });

    await userEvent.selectOptions(await screen.findByLabelText(/member/i, { selector: '#payments-member' }), 'm1');
    await userEvent.selectOptions(await screen.findByLabelText(/membership/i, { selector: '#payments-membership' }), 'mem-9');
    // Switching the type unmounts that select but leaves `form.membershipId`
    // set — this is the state the payload rule exists for, and the only one
    // where sending the form as-is would attach a membership to a
    // supplement sale.
    await userEvent.selectOptions(screen.getByLabelText(/^for$/i), 'supplement');
    await userEvent.type(screen.getByLabelText(/amount/i), '900');
    await userEvent.click(screen.getByRole('button', { name: /^record$/i }));

    await waitFor(() => expect(stub.post).toHaveBeenCalled());
    const [, body] = stub.post.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(body.membershipId).toBeNull();
  });
});

describe('Payments — correcting one', () => {
  const openEdit = async (payment = aPayment({ id: 'pay-1', amount: 2500 })) => {
    const stub = setup({ payments: paymentsPage([payment]) });
    renderPage(<Payments />);
    const [edit] = await screen.findAllByRole('button', { name: /edit/i });
    await userEvent.click(edit!);
    return stub;
  };

  it('never sends the member, which the API refuses to change', async () => {
    const stub = await openEdit();

    await userEvent.click(await screen.findByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(stub.put).toHaveBeenCalled());
    const [url, body] = stub.put.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(url).toBe('/payments/pay-1');
    // Moving money between members is a delete and a re-entry, not an edit.
    expect(body).not.toHaveProperty('memberId');
  });

  it('clears the wallet when an online payment is switched to cash', async () => {
    const stub = await openEdit(
      aPayment({ id: 'pay-1', method: 'online', channel: 'easypaisa', reference: 'TX-9' }),
    );

    await userEvent.selectOptions(await screen.findByLabelText(/method/i), 'cash');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(stub.put).toHaveBeenCalled());
    const [, body] = stub.put.mock.calls[0] as unknown as [string, Record<string, unknown>];
    // Omitting these would leave "easypaisa" on a row that is now cash.
    expect(body).toMatchObject({ channel: null, reference: null });
  });
});

describe('Payments — removing one', () => {
  it('asks before deleting, and deletes the row it asked about', async () => {
    const stub = setup({ payments: paymentsPage([aPayment({ id: 'pay-7' })]) });

    renderPage(<Payments />);
    const [remove] = await screen.findAllByRole('button', { name: /delete/i });
    await userEvent.click(remove!);

    // Nothing goes until the confirm is answered — deleting a payment is not
    // undoable and the row is somebody's receipt.
    expect(stub.delete).not.toHaveBeenCalled();

    await userEvent.click(
      await screen.findByRole('button', { name: /^delete$|^delete payment$|confirm/i }),
    );

    await waitFor(() => expect(stub.delete).toHaveBeenCalledWith('/payments/pay-7'));
  });
});
