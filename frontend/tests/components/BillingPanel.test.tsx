import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { BillingResponse } from '../../src/types';

/**
 * The panel a gym owner pays their own subscription from.
 *
 * What matters here is not the layout but what the panel refuses to do: invent
 * a subscription for a gym that has never been billed, name its own price, or
 * treat the provider's redirect as proof that anything was paid. The last one
 * is the reason the button posts a form rather than calling an endpoint that
 * returns success.
 */

interface ApiStub {
  get: ReturnType<typeof vi.fn<(url: string) => Promise<{ data: unknown }>>>;
  post: ReturnType<typeof vi.fn<(url: string, body: unknown) => Promise<{ data: unknown }>>>;
}

const api = vi.hoisted(() => ({ current: null as null | ApiStub }));

vi.mock('../../src/api/client', () => ({
  default: {
    get: (url: string) => api.current!.get(url),
    post: (url: string, body: unknown) => api.current!.post(url, body),
  },
  apiError: (_e: unknown, fallback = 'Something went wrong') => fallback,
}));

const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
);
vi.mock('react-hot-toast', () => ({ default: toast }));

const BillingPanel = (await import('../../src/components/subscription/BillingPanel'))
  .default;

const iso = (daysFromNow: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
};

const aResponse = (over: Partial<BillingResponse> = {}): BillingResponse => ({
  billing: {
    plan: 'basic',
    planLabel: 'Basic',
    amount: 3000,
    periodDays: 30,
    graceDays: 7,
    paidThrough: null,
    active: true,
    suspendsOn: iso(7),
    overdueSince: null,
    openInvoice: {
      id: 'inv-1',
      amount: 3000,
      dueDate: iso(0),
      periodStart: iso(0),
      periodEnd: iso(30),
    },
    invoices: [
      {
        id: 'inv-1',
        plan: 'basic',
        planLabel: 'Basic',
        amount: 3000,
        status: 'open',
        periodStart: iso(0),
        periodEnd: iso(30),
        dueDate: iso(0),
        issuedAt: iso(0),
        paidAt: null,
        provider: null,
        note: null,
      },
    ],
  },
  plans: [{ plan: 'basic', label: 'Basic', amount: 3000, periodDays: 30 }],
  providers: [{ provider: 'jazzcash', label: 'JazzCash', redirects: true }],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, '', '/subscription');
  api.current = {
    get: vi.fn(() => Promise.resolve({ data: aResponse() })),
    post: vi.fn(() => Promise.resolve({ data: { url: '', fields: {} } })),
  };
});

describe('a gym that has never been billed', () => {
  it('renders nothing rather than an empty subscription', async () => {
    // `billing: null` is the server saying "on the free plan". A panel showing
    // a term that does not exist would read as a bug, and the Free card on the
    // page already says the same thing better.
    api.current!.get = vi.fn(() =>
      Promise.resolve({ data: aResponse({ billing: null }) }),
    );

    const { container } = render(<BillingPanel />);

    await waitFor(() => expect(api.current!.get).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});

describe('an open invoice', () => {
  it('shows what is owed and when access would stop', async () => {
    render(<BillingPanel />);

    // Matched on the callout rather than on the amount alone: the same figure
    // appears again in the invoice table below, and a bare text query would
    // pass on either.
    expect(await screen.findByText(/Rs. 3,000 due/i)).toBeInTheDocument();
    // The consequence stated plainly — an owner deciding whether to pay today
    // needs the date, not just the amount.
    expect(screen.getByText(/access stops/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing is deleted/i)).toBeInTheDocument();
  });

  it('marks an overdue invoice as overdue rather than merely due', async () => {
    api.current!.get = vi.fn(() =>
      Promise.resolve({
        data: aResponse({
          billing: {
            ...aResponse().billing!,
            overdueSince: iso(-3),
            openInvoice: {
              id: 'inv-1',
              amount: 3000,
              dueDate: iso(-3),
              periodStart: iso(-3),
              periodEnd: iso(27),
            },
          },
        }),
      }),
    );

    render(<BillingPanel />);

    expect(await screen.findByText(/overdue/i)).toBeInTheDocument();
  });

  it('offers a button per configured provider', async () => {
    render(<BillingPanel />);

    expect(
      await screen.findByRole('button', { name: /pay with jazzcash/i }),
    ).toBeInTheDocument();
  });

  it('sends no amount when starting a checkout', async () => {
    // The price is the invoice's, read on the server. A body carrying an
    // amount would be a body that can buy a month for one rupee — so the
    // request must not carry one even by accident.
    render(<BillingPanel />);

    await userEvent.click(
      await screen.findByRole('button', { name: /pay with jazzcash/i }),
    );

    await waitFor(() => expect(api.current!.post).toHaveBeenCalled());
    const [url, body] = api.current!.post.mock.calls[0]!;
    expect(url).toBe('/billing/checkout');
    expect(body).toEqual({ provider: 'jazzcash' });
  });

  it('tells the owner what to do when the provider takes no redirect', async () => {
    // `manual` comes back with no url: the money arrives by bank transfer and
    // somebody settles it. Posting an empty form would navigate nowhere.
    api.current!.get = vi.fn(() =>
      Promise.resolve({
        data: aResponse({
          providers: [
            { provider: 'manual', label: 'Pay by transfer', redirects: false },
          ],
        }),
      }),
    );

    render(<BillingPanel />);

    await userEvent.click(
      await screen.findByRole('button', { name: /pay by transfer/i }),
    );

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it('keeps the panel usable when a checkout is refused', async () => {
    api.current!.post = vi.fn(() => Promise.reject(new Error('nope')));

    render(<BillingPanel />);
    const button = await screen.findByRole('button', { name: /pay with jazzcash/i });
    await userEvent.click(button);

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    // Re-enabled rather than left spinning: a failed attempt must be retryable.
    await waitFor(() => expect(button).not.toBeDisabled());
  });
});

describe('nothing outstanding', () => {
  it('says so instead of showing a payment button', async () => {
    api.current!.get = vi.fn(() =>
      Promise.resolve({
        data: aResponse({
          billing: {
            ...aResponse().billing!,
            openInvoice: null,
            suspendsOn: null,
            paidThrough: iso(20),
            invoices: [
              {
                id: 'inv-0',
                plan: 'basic',
                planLabel: 'Basic',
                amount: 3000,
                status: 'paid',
                periodStart: iso(-10),
                periodEnd: iso(20),
                dueDate: iso(-10),
                issuedAt: iso(-10),
                paidAt: iso(-10),
                provider: 'jazzcash',
                note: null,
              },
            ],
          },
        }),
      }),
    );

    render(<BillingPanel />);

    expect(await screen.findByText(/nothing outstanding/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /pay with/i }),
    ).not.toBeInTheDocument();
  });
});

describe('coming back from the provider', () => {
  it('reports a success once and clears it from the URL', async () => {
    // The provider redirects with ?payment=success. Left in the URL, a refresh
    // would re-announce a payment made ten minutes ago.
    window.history.replaceState({}, '', '/subscription?payment=success');

    render(<BillingPanel />);

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(window.location.search).toBe('');
  });

  it('does not claim success while a payment is still pending', async () => {
    // The browser's return is not proof of payment — the callback decides.
    // Saying "paid" here would be a lie the next page load contradicts.
    window.history.replaceState({}, '', '/subscription?payment=pending');

    render(<BillingPanel />);

    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('reports a failed payment as failed', async () => {
    window.history.replaceState({}, '', '/subscription?payment=failed');

    render(<BillingPanel />);

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });
});
