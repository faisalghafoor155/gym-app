import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  aMember, aMembership, mockApi, membersPage, ownerAuth, staffAuth, renderPage, type AuthState,
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

/** Encoding is the library's job; what matters here is what it was handed. */
const qr = vi.hoisted(() => ({ toDataURL: vi.fn() }));
vi.mock('qrcode', () => ({ default: qr }));

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
  it('offers renew to staff, not just the owner', async () => {
    setup({
      auth: staffAuth,
      members: membersPage([aMember({
        name: 'Ali Khan',
        currentMembership: aMembership({ status: 'expiring', daysLeft: 3 }),
      })]),
    });

    renderPage(<Members />);
    await loaded();

    // Taking a fee and selling the next month is what the front desk is for.
    expect(screen.getByRole('button', { name: /renew ali khan/i })).toBeInTheDocument();
  });
});

/**
 * Renew is offered only when renewing is the next thing to do. A button on
 * every row in the gym is the same as no button at all — the members who need
 * chasing stop standing out.
 */
describe('Members — when renew is offered', () => {
  const withMembership = (over: Partial<ReturnType<typeof aMembership>>) =>
    setup({
      members: membersPage([aMember({
        name: 'Ali Khan',
        currentMembership: aMembership(over),
      })]),
    });

  const renewButton = () => screen.queryByRole('button', { name: /renew ali khan/i });

  it('stays hidden while there is still a month to run', async () => {
    withMembership({ status: 'active', daysLeft: 25 });
    renderPage(<Members />);
    await loaded();

    expect(renewButton()).not.toBeInTheDocument();
  });

  it('appears once the membership is expiring', async () => {
    withMembership({ status: 'expiring', daysLeft: 5 });
    renderPage(<Members />);
    await loaded();

    expect(renewButton()).toBeInTheDocument();
  });

  it('appears for a membership that has already run out', async () => {
    withMembership({ status: 'expired', daysLeft: -12 });
    renderPage(<Members />);
    await loaded();

    // The member who lapsed and walked back in is exactly who this is for.
    expect(renewButton()).toBeInTheDocument();
  });

  it('stays hidden on a cancelled membership', async () => {
    withMembership({ status: 'cancelled', daysLeft: 10 });
    renderPage(<Members />);
    await loaded();

    // Closed history — the API refuses it, so the button must not be there
    // to fail on click.
    expect(renewButton()).not.toBeInTheDocument();
  });

  it('stays hidden for a member who never bought anything', async () => {
    setup({ members: membersPage([aMember({ name: 'Ali Khan', currentMembership: null })]) });
    renderPage(<Members />);
    await loaded();

    // Nothing to renew from: they need a first membership, not a renewal.
    expect(renewButton()).not.toBeInTheDocument();
  });
});

/**
 * The renew modal itself, which owns its own form.
 *
 * What the desk sends is the thing to hold down: the endpoint carries the
 * membership being replaced, and a renewal taken in cash must not carry a
 * wallet left behind by an earlier online selection.
 */
describe('Members — renewing', () => {
  const expiringMember = () => aMember({
    id: 'member-1',
    name: 'Ali Khan',
    currentMembership: aMembership({
      id: 'membership-9',
      planId: 'plan-1',
      planName: 'Monthly',
      status: 'expiring',
      daysLeft: 3,
    }),
  });

  const openRenew = async () => {
    const user = userEvent.setup();
    renderPage(<Members />);
    await loaded();
    await user.click(screen.getByRole('button', { name: /renew ali khan/i }));
    return user;
  };

  it('opens against the membership being replaced', async () => {
    api.current = mockApi({
      '/membership-plans': [{ id: 'plan-1', name: 'Monthly', price: 2500, durationDays: 30, isActive: true }],
      '/members': membersPage([expiringMember()]),
    });
    auth.current = ownerAuth;

    const user = await openRenew();
    expect(await screen.findByRole('dialog', { name: /renew membership/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^renew$/i }));

    await waitFor(() => expect(api.current!.post).toHaveBeenCalled());
    // The old membership's id is in the path: a renewal supersedes a specific
    // row rather than whatever the member currently holds.
    const [url] = api.current!.post.mock.calls[0] as unknown as [string, unknown];
    expect(url).toBe('/members/member-1/memberships/membership-9/renew');
  });

  it('prefills the fee from the plan and sends what was actually typed', async () => {
    api.current = mockApi({
      '/membership-plans': [{ id: 'plan-1', name: 'Monthly', price: 2500, durationDays: 30, isActive: true }],
      '/members': membersPage([expiringMember()]),
    });
    auth.current = ownerAuth;

    const user = await openRenew();
    const dialog = await screen.findByRole('dialog', { name: /renew membership/i });
    // `FieldLabel` renders no `htmlFor`, so the fee field is reached by role
    // rather than by its label.
    const amount = within(dialog).getByRole('spinbutton');
    // Prefilled from the plan's price so the common case is one click...
    expect(amount).toHaveValue(2500);

    // ...and editable, because a haggled renewal is recorded at what was taken.
    await user.clear(amount);
    await user.type(amount, '2000');
    await user.click(screen.getByRole('button', { name: /^renew$/i }));

    await waitFor(() => expect(api.current!.post).toHaveBeenCalled());
    const [, body] = api.current!.post.mock.calls[0] as unknown as [string, { amount: number }];
    expect(body.amount).toBe(2000);
  });

  it('sends no wallet for a renewal switched back to cash', async () => {
    api.current = mockApi({
      '/membership-plans': [{ id: 'plan-1', name: 'Monthly', price: 2500, durationDays: 30, isActive: true }],
      '/members': membersPage([expiringMember()]),
    });
    auth.current = ownerAuth;

    const user = await openRenew();
    const dialog = await screen.findByRole('dialog', { name: /renew membership/i });
    await user.click(within(dialog).getByRole('button', { name: /online/i }));
    // The channel picker is the only select to appear once online is chosen.
    const channel = within(dialog).getAllByRole('combobox').at(-1)!;
    await user.selectOptions(channel, 'easypaisa');
    // Switching back must drop the wallet, not leave it on a cash row.
    await user.click(within(dialog).getByRole('button', { name: /cash/i }));
    await user.click(within(dialog).getByRole('button', { name: /^renew$/i }));

    await waitFor(() => expect(api.current!.post).toHaveBeenCalled());
    const [, body] = api.current!.post.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(body.method).toBe('cash');
    expect(body).not.toHaveProperty('channel');
  });
});

/**
 * The check-in code.
 *
 * The code encodes the member's id, not anything shown next to it. A code built
 * from the member number or the name would scan cleanly at the front desk and
 * check in the wrong person — or nobody — so what gets encoded is the thing to
 * pin down.
 *
 * The failure path matters for the same reason it was worth moving: the page
 * holds only which member is on screen, so a code that never arrives has to
 * clear that rather than leave the member set behind an invisible modal.
 */
describe('Members — the check-in code', () => {
  const member = () => aMember({ id: 'member-1', name: 'Ali Khan', memberNo: 'M-004' });

  const openQr = async () => {
    auth.current = ownerAuth;
    api.current = mockApi({
      '/membership-plans': [],
      '/members': membersPage([member()]),
    });
    const user = userEvent.setup();
    renderPage(<Members />);
    await loaded();
    await user.click(screen.getByRole('button', { name: /show ali khan's check-in code/i }));
    return user;
  };

  it('encodes the member id rather than anything on display', async () => {
    qr.toDataURL.mockResolvedValue('data:image/png;base64,ZmFrZQ==');
    await openQr();

    await screen.findByRole('dialog', { name: /ali khan/i });
    // The id is what the reader resolves a member by. The member number is
    // printed on the card beside it and is not interchangeable with it.
    expect(qr.toDataURL).toHaveBeenCalledWith('member-1', expect.anything());
  });

  it('releases the member when the code cannot be generated', async () => {
    qr.toDataURL.mockRejectedValue(new Error('encode failed'));
    const user = await openQr();

    const toast = (await import('react-hot-toast')).default;
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // A failure that only rendered nothing would leave the member set behind an
    // invisible modal, and asking for the same code again would be a no-op —
    // the state never changed. Succeeding this time proves it was cleared.
    qr.toDataURL.mockResolvedValue('data:image/png;base64,ZmFrZQ==');
    await user.click(screen.getByRole('button', { name: /show ali khan's check-in code/i }));

    expect(await screen.findByRole('dialog', { name: /ali khan/i })).toBeInTheDocument();
  });

  it('dismisses on Escape', async () => {
    qr.toDataURL.mockResolvedValue('data:image/png;base64,ZmFrZQ==');
    const user = await openQr();

    await screen.findByRole('dialog', { name: /ali khan/i });
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
