import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  aMember, mockApi, membersPage, ownerAuth, staffAuth, renderPage, type AuthState,
} from '../helpers';

/**
 * The members page.
 *
 * Searching and the status tabs run on the server now. That makes what the page
 * *asks for* the thing worth testing: a page that quietly went back to
 * filtering the rows it was handed would look correct on one page of members
 * and lose people on the second, which is the kind of bug a gym discovers by
 * being unable to find somebody who is standing in front of them.
 *
 * The tab counts are the other half. They describe the whole roster, so a
 * count that started following the loaded page would climb as somebody pressed
 * "Show more" and mean nothing.
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

vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => auth.current }));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const Members = (await import('../../src/pages/Members')).default;

const setup = (over: {
  members?: ReturnType<typeof membersPage>;
  auth?: typeof ownerAuth;
} = {}) => {
  auth.current = over.auth ?? ownerAuth;
  api.current = mockApi({
    '/membership-plans': [],
    '/members': over.members ?? membersPage([aMember({ name: 'Ali Khan' })]),
  });
  return api.current;
};

/** The page has loaded when the roster line in the header has rendered. */
const loaded = () => screen.findByText(/on the books/);

describe('Members — searching', () => {
  it('sends the search to the server', async () => {
    const stub = setup();
    renderPage(<Members />);
    await loaded();

    await userEvent.type(screen.getByLabelText(/search members/i), 'zainab');

    await waitFor(
      () => {
        expect(stub.callsTo('/members?').some(u => u.includes('search=zainab'))).toBe(true);
      },
      { timeout: 2000 },
    );
  });

  it('waits for a pause rather than firing per keystroke', async () => {
    const stub = setup();
    renderPage(<Members />);
    await loaded();
    const before = stub.callsTo('/members?').length;

    await userEvent.type(screen.getByLabelText(/search members/i), 'ali');

    await waitFor(
      () => {
        expect(stub.callsTo('search=ali').length).toBe(1);
      },
      { timeout: 2000 },
    );
    // Three characters, one request — not three.
    expect(stub.callsTo('/members?').length - before).toBeLessThanOrEqual(2);
  });

  it('shows whoever came back, without filtering them again', async () => {
    // The server answered with somebody whose name does not contain the query.
    // A page still filtering locally would show nothing and look broken.
    setup({ members: membersPage([aMember({ name: 'Zainab Malik' })]) });

    renderPage(<Members />);

    expect(await screen.findByText('Zainab Malik')).toBeInTheDocument();
  });
});

describe('Members — the status tabs', () => {
  it('asks the server for the chosen tab', async () => {
    const stub = setup();
    renderPage(<Members />);
    await loaded();

    await userEvent.click(screen.getByRole('tab', { name: /^Expired/ }));

    await waitFor(() => {
      expect(stub.callsTo('/members?').some(u => u.includes('status=expired'))).toBe(true);
    });
  });

  it('asks for no status on the All tab, which the server reads as "on the books"', async () => {
    const stub = setup();
    renderPage(<Members />);

    await waitFor(() => {
      const first = stub.callsTo('/members?')[0];
      expect(first).toBeDefined();
      // Sending `status=all` would be a filter the API does not have.
      expect(first).not.toContain('status=');
    });
  });

  it('labels each tab with the whole roster, not the loaded page', async () => {
    setup({
      members: membersPage([aMember()], {
        total: 24,
        hasMore: true,
        counts: { all: 300, active: 250, expiring: 12, expired: 30, lapsed: 40, none: 8 },
      }),
    });

    renderPage(<Members />);
    await loaded();

    // 250 active, with one member on screen. A count that followed the page
    // would read 1 and climb as more loaded.
    expect(screen.getByRole('tab', { name: /^Active/ })).toHaveTextContent('250');
    expect(screen.getByRole('tab', { name: /^Lapsed/ })).toHaveTextContent('40');
  });

  it('counts the roster in the header, not the current filter', async () => {
    setup({
      members: membersPage([aMember()], {
        total: 30,
        counts: { all: 300, active: 250, expiring: 12, expired: 30, lapsed: 40, none: 8 },
      }),
    });

    renderPage(<Members />);

    // "300 members on the books" — the header describes the gym, and must not
    // change when somebody picks a tab.
    expect(await screen.findByText(/300 members on the books/)).toBeInTheDocument();
  });
});

describe('Members — paging', () => {
  it('offers more, and says how many are left', async () => {
    setup({
      members: membersPage([aMember()], { total: 300, hasMore: true }),
    });

    renderPage(<Members />);

    expect(await screen.findByRole('button', { name: /show more · 299 left/i }))
      .toBeInTheDocument();
  });

  it('asks for the next page while keeping the search', async () => {
    const stub = setup({
      members: membersPage([aMember()], { total: 300, hasMore: true }),
    });

    renderPage(<Members />);
    await userEvent.click(await screen.findByRole('button', { name: /show more/i }));

    await waitFor(() => {
      expect(stub.callsTo('page=2')).toHaveLength(1);
    });
  });

  it('offers nothing more when the roster fits on one page', async () => {
    setup({ members: membersPage([aMember()]) });

    renderPage(<Members />);
    await loaded();

    expect(screen.queryByRole('button', { name: /show more/i })).not.toBeInTheDocument();
  });
});

describe('Members — empty states', () => {
  it('tells a gym with no members to add one', async () => {
    setup({ members: membersPage([]) });

    renderPage(<Members />);

    expect(await screen.findByText(/no members yet/i)).toBeInTheDocument();
  });

  it('offers to clear the filters when a search matches nobody', async () => {
    const stub = setup();
    renderPage(<Members />);
    await loaded();

    // Nothing matches from here on.
    stub.get.mockImplementation((url: string) => {
      stub.calls.push(url);
      if (url.includes('/membership-plans')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: membersPage([]) });
    });

    await userEvent.type(screen.getByLabelText(/search members/i), 'nobody');

    expect(await screen.findByText(/no members match these filters/i, undefined, { timeout: 2000 }))
      .toBeInTheDocument();
  });
});

describe('Members — what staff may do', () => {
  it('keeps the extend action away from staff', async () => {
    setup({
      auth: staffAuth,
      members: membersPage([aMember({
        name: 'Ali Khan',
        currentMembership: {
          id: 'ms-1', planId: 'p1', planName: 'Monthly',
          startDate: new Date().toISOString(),
          expiryDate: new Date().toISOString(),
          originalExpiryDate: new Date().toISOString(),
          pricePaid: 2500, durationDays: 30, extendedDays: 0,
          extensionReason: null, status: 'active', daysLeft: 20,
          freezeStartDate: null,
        },
      })]),
    });

    renderPage(<Members />);
    await loaded();

    // Granting free days is spending the gym's money, and the API refuses
    // staff outright — so the button is absent rather than failing on click.
    expect(screen.queryByRole('button', { name: /extend/i })).not.toBeInTheDocument();
  });
});
