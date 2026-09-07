import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  aSupplement, listPage, mockApi, ownerAuth, renderPage, type AuthState,
} from '../helpers';

/**
 * The supplements shelf.
 *
 * Two writes here are worth pinning. Deleting a product cannot be undone, and
 * restocking carries a number that goes straight into stock — a restock that
 * sent the wrong quantity, or sent it to the wrong product, would be found by
 * counting tins on a shelf rather than by anybody reading an error.
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

const Supplements = (await import('../../src/pages/Supplements')).default;

/** Two products, so a page acting on the wrong one cannot pass by having only
 *  one to act on. */
const whey = aSupplement({ id: 'supp-whey', name: 'Whey Protein', stock: 12 });
const creatine = aSupplement({ id: 'supp-creatine', name: 'Creatine', stock: 4 });

const setup = () => {
  auth.current = ownerAuth;
  api.current = mockApi({
    '/supplements': {
      ...listPage([whey, creatine]),
      counts: { all: 2, outOfStock: 0, byCategory: {} },
    },
    '/members': listPage([]),
  });
  return api.current;
};

const loaded = () => screen.findByText('Whey Protein');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Supplements — deleting a product', () => {
  it('asks first, then deletes the product it was aimed at', async () => {
    const stub = setup();
    renderPage(<Supplements />);
    await loaded();

    await userEvent.click(screen.getByRole('button', { name: /delete whey protein/i }));
    expect(stub.delete).not.toHaveBeenCalled();

    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /^delete$/i }),
    );

    await waitFor(() => expect(stub.delete).toHaveBeenCalledTimes(1));
    expect(stub.delete).toHaveBeenCalledWith('/supplements/supp-whey');
  });

  it('deletes nothing when the dialog is dismissed', async () => {
    const stub = setup();
    renderPage(<Supplements />);
    await loaded();

    await userEvent.click(screen.getByRole('button', { name: /delete creatine/i }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /^cancel$/i }),
    );

    expect(stub.delete).not.toHaveBeenCalled();
  });
});

describe('Supplements — restocking', () => {
  it('sends the units entered, against that product', async () => {
    const stub = setup();
    renderPage(<Supplements />);
    await loaded();

    // The second row's Stock button, to catch a page that restocks whichever
    // product it rendered first.
    const stockButtons = screen.getAllByRole('button', { name: /stock/i });
    await userEvent.click(stockButtons[stockButtons.length - 1]!);

    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/units received/i), '25');
    await userEvent.type(within(dialog).getByLabelText(/note/i), 'Invoice 88');
    await userEvent.click(within(dialog).getByRole('button', { name: /restock|add|save/i }));

    await waitFor(() => expect(stub.post).toHaveBeenCalledTimes(1));
    // A number, not the string the input held: stock arithmetic on "25" would
    // concatenate rather than add.
    expect(stub.post).toHaveBeenCalledWith('/supplements/supp-creatine/restock', {
      quantity: 25,
      notes: 'Invoice 88',
    });
  });
});
