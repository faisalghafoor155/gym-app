import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  aGymUser, listPage, mockApi, ownerAuth, renderPage, staffAuth,
  type AuthState,
} from '../helpers';

/**
 * The staff and logins page.
 *
 * Every write here is somebody's access, and four of them cannot be taken back
 * by pressing the button again: removing an account, revoking it, dropping it
 * to member, and handing the gym over. So these tests ask two things of each —
 * that a confirm stands in front of it, and that the request it eventually
 * sends carries the right id and the right body.
 *
 * The payload is asserted rather than the mere fact of a call, because the
 * failure worth catching is not a dead button. It is a live one pointed at the
 * wrong account, or carrying `{ role: 'owner' }` where the page meant staff — a
 * bug that looks like success and is found when somebody cannot sign in.
 */

const api = vi.hoisted(() => ({
  current: null as ReturnType<typeof import('../helpers')['mockApi']> | null,
}));
const auth = vi.hoisted(() => ({ current: null as unknown as AuthState }));

vi.mock('../../src/api/client', () => ({
  default: {
    get: (...args: unknown[]) => api.current!.get(...args as [string]),
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

const Team = (await import('../../src/pages/Team')).default;

/** Two rows, always: a test acting on "the" account cannot tell a page
 *  targeting the right row from one targeting the only row. */
const sana = aGymUser({ id: 'user-sana', name: 'Sana Iqbal', role: 'staff' });
const bilal = aGymUser({ id: 'user-bilal', name: 'Bilal Ahmed', role: 'staff' });

const setup = (over: { users?: ReturnType<typeof aGymUser>[]; auth?: AuthState } = {}) => {
  auth.current = over.auth ?? ownerAuth;
  api.current = mockApi({
    '/users': {
      users: over.users ?? [sana, bilal],
      seats: { limit: 6, used: 2, remaining: 4 },
    },
    '/members': listPage([]),
    '/gym-settings': {
      defaultPtFee: 0,
      easypaisaAccount: null,
      jazzcashAccount: null,
      bankAccount: null,
    },
  });
  return api.current;
};

/** The page has loaded once the roster has rendered a name. */
const loaded = () => screen.findByText('Sana Iqbal');

/**
 * Presses the confirm button inside the open dialog.
 *
 * Scoped to the dialog because the confirm repeats the wording of the row
 * button that opened it — "Make member" is on both — and an unscoped query
 * would match the trigger as readily as the confirmation.
 */
const confirmWith = (label: RegExp) =>
  userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: label }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Team — removing an account', () => {
  it('asks before it removes, and then removes the row it was aimed at', async () => {
    const stub = setup();
    renderPage(<Team />);
    await loaded();

    await userEvent.click(screen.getByRole('button', { name: /remove sana iqbal/i }));
    // The gate is the assertion: a delete that fires on the first click is the
    // bug, however correct the request that follows it.
    expect(stub.delete).not.toHaveBeenCalled();

    await confirmWith(/^remove$/i);

    await waitFor(() => expect(stub.delete).toHaveBeenCalledTimes(1));
    expect(stub.delete).toHaveBeenCalledWith('/users/user-sana');
  });

  it('sends nothing when the dialog is dismissed', async () => {
    const stub = setup();
    renderPage(<Team />);
    await loaded();

    await userEvent.click(screen.getByRole('button', { name: /remove bilal ahmed/i }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /^cancel$/i }),
    );

    expect(stub.delete).not.toHaveBeenCalled();
  });
});

describe('Team — access', () => {
  it('asks before revoking, then revokes that account', async () => {
    const stub = setup();
    renderPage(<Team />);
    await loaded();

    const rows = screen.getAllByRole('button', { name: /^revoke$/i });
    await userEvent.click(rows[0]!);
    expect(stub.put).not.toHaveBeenCalled();

    await confirmWith(/^revoke$/i);

    await waitFor(() => expect(stub.put).toHaveBeenCalledTimes(1));
    expect(stub.put).toHaveBeenCalledWith('/users/user-sana', { isActive: false });
  });

  it('restores access in one click, without asking', async () => {
    // Deliberately ungated, and asserted so: restoring somebody locked out
    // mid-shift is harmless and urgent, and a confirm here would be a prompt
    // nobody wants standing between them and the front desk.
    const stub = setup({
      users: [aGymUser({ id: 'user-off', name: 'Sana Iqbal', isActive: false })],
    });
    renderPage(<Team />);
    await loaded();

    await userEvent.click(screen.getByRole('button', { name: /^restore$/i }));

    await waitFor(() => expect(stub.put).toHaveBeenCalledTimes(1));
    expect(stub.put).toHaveBeenCalledWith('/users/user-off', { isActive: true });
  });
});

describe('Team — changing a role', () => {
  it('drops a staff account to member, and never names owner', async () => {
    const stub = setup();
    renderPage(<Team />);
    await loaded();

    const buttons = screen.getAllByRole('button', { name: /^make member$/i });
    await userEvent.click(buttons[0]!);
    expect(stub.put).not.toHaveBeenCalled();

    await confirmWith(/^make member$/i);

    await waitFor(() => expect(stub.put).toHaveBeenCalledTimes(1));
    expect(stub.put).toHaveBeenCalledWith('/users/user-sana', { role: 'member' });
  });

  it('promotes a member login to staff', async () => {
    const stub = setup({
      users: [aGymUser({ id: 'user-m', name: 'Sana Iqbal', role: 'member' })],
    });
    renderPage(<Team />);
    await loaded();

    await userEvent.click(screen.getByRole('button', { name: /^make staff$/i }));
    await confirmWith(/^make staff$/i);

    await waitFor(() => expect(stub.put).toHaveBeenCalledTimes(1));
    // Promotion to owner is what transferring does, in one step. This path
    // must never be the one that gets there.
    expect(stub.put).toHaveBeenCalledWith('/users/user-m', { role: 'staff' });
  });
});

describe('Team — transferring the gym', () => {
  it('asks first, then names the new owner', async () => {
    const stub = setup();
    // The page reloads the tab on success; jsdom has no navigation to perform.
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    });

    renderPage(<Team />);
    await loaded();

    await userEvent.click(
      screen.getByRole('button', { name: /transfer ownership to sana iqbal/i }),
    );
    expect(stub.post).not.toHaveBeenCalled();

    await confirmWith(/^transfer ownership$/i);

    await waitFor(() => expect(stub.post).toHaveBeenCalledTimes(1));
    expect(stub.post).toHaveBeenCalledWith('/users/transfer-ownership', {
      userId: 'user-sana',
    });
  });
});

describe('Team — who may do any of this', () => {
  it('offers none of it to staff', async () => {
    setup({ auth: staffAuth });
    renderPage(<Team />);
    await loaded();

    // Not merely disabled — absent. These are owner-only acts, and the page
    // does not render the controls at all.
    expect(screen.queryByRole('button', { name: /remove sana iqbal/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /transfer ownership/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^revoke$/i })).toBeNull();
  });

  it('does not offer the owner a way to act on their own row', async () => {
    setup({ users: [aGymUser({ id: 'me', name: 'Sana Iqbal', role: 'owner' })] });
    renderPage(<Team />);
    await loaded();

    expect(screen.queryByRole('button', { name: /remove sana iqbal/i })).toBeNull();
  });
});
