import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockApi, renderPage } from '../helpers';
import type { Expense, ExpenseList, ProfitReport } from '../../src/types';

/**
 * What the gym spends.
 *
 * The other half of the money story: Payments answers what came in, this
 * answers what went out, and the profit tiles sit on both. The payload is
 * where the risk is — `amount` has to reach the server as a number rather than
 * the string the input holds, and the two optional fields have to arrive as
 * null rather than as empty strings, or the table fills up with vendors called
 * "".
 */

const api = vi.hoisted(() => ({ current: null as ReturnType<typeof import('../helpers')['mockApi']> | null }));

vi.mock('../../src/api/client', () => ({
  default: {
    get: (url: string) => api.current!.get(url),
    post: (...args: unknown[]) => api.current!.post(...args as []),
    put: (...args: unknown[]) => api.current!.put(...args as []),
    delete: (...args: unknown[]) => api.current!.delete(...args as []),
  },
  apiError: (_e: unknown, fallback = 'Something went wrong') => fallback,
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const Expenses = (await import('../../src/pages/Expenses')).default;

const anExpense = (over: Partial<Expense> = {}): Expense => ({
  id: 'exp-1',
  category: 'rent',
  amount: 45000,
  spentOn: '2026-08-01T00:00:00.000Z',
  vendor: 'Landlord',
  notes: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  recordedBy: null,
  ...over,
});

const expenseList = (data: Expense[]): ExpenseList => ({
  data,
  total: data.length,
  page: 1,
  limit: 25,
  hasMore: false,
  totalSpent: data.reduce((s, e) => s + e.amount, 0),
  byCategory: [],
});

const aProfit = (over: Partial<ProfitReport> = {}): ProfitReport => ({
  from: null, to: null, revenue: 0, expenses: 0, profit: 0, outstanding: 0,
  revenueByType: [], expensesByCategory: [],
  ...over,
});

const setup = (rows: Expense[] = [anExpense()]) => {
  api.current = mockApi({
    '/expenses/profit': aProfit(),
    '/expenses': expenseList(rows),
  });
  return api.current;
};

describe('Expenses — recording one', () => {
  it('sends the amount as a number, not the string the input holds', async () => {
    const stub = setup();

    renderPage(<Expenses />);
    await userEvent.click(await screen.findByRole('button', { name: /add expense/i }));
    await userEvent.type(screen.getByLabelText(/amount/i), '45000');
    await userEvent.click(screen.getByRole('button', { name: /record expense/i }));

    await waitFor(() => expect(stub.post).toHaveBeenCalled());
    const [url, body] = stub.post.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(url).toBe('/expenses');
    // A string here is accepted by nothing downstream that does arithmetic —
    // the profit figure is revenue minus this.
    expect(body.amount).toBe(45000);
    expect(typeof body.amount).toBe('number');
  });

  it('sends the optional fields as null when left blank', async () => {
    const stub = setup();

    renderPage(<Expenses />);
    await userEvent.click(await screen.findByRole('button', { name: /add expense/i }));
    await userEvent.type(screen.getByLabelText(/amount/i), '1200');
    await userEvent.click(screen.getByRole('button', { name: /record expense/i }));

    await waitFor(() => expect(stub.post).toHaveBeenCalled());
    const [, body] = stub.post.mock.calls[0] as unknown as [string, Record<string, unknown>];
    // Null is "no vendor"; '' is a vendor whose name is empty, and it is the
    // second one that shows up as a blank cell in the table.
    expect(body).toMatchObject({ vendor: null, notes: null });
  });

  it('trims the vendor rather than storing the spacing', async () => {
    const stub = setup();

    renderPage(<Expenses />);
    await userEvent.click(await screen.findByRole('button', { name: /add expense/i }));
    await userEvent.type(screen.getByLabelText(/amount/i), '900');
    await userEvent.type(screen.getByLabelText(/paid to/i), '  K-Electric  ');
    await userEvent.click(screen.getByRole('button', { name: /record expense/i }));

    await waitFor(() => expect(stub.post).toHaveBeenCalled());
    const [, body] = stub.post.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(body.vendor).toBe('K-Electric');
  });
});

describe('Expenses — correcting one', () => {
  it('puts to the row it opened, carrying the whole payload', async () => {
    const stub = setup([anExpense({ id: 'exp-7', category: 'utilities', amount: 3000 })]);

    renderPage(<Expenses />);
    await userEvent.click(await screen.findByRole('button', { name: /edit utilities expense/i }));
    await userEvent.clear(screen.getByLabelText(/amount/i));
    await userEvent.type(screen.getByLabelText(/amount/i), '3500');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(stub.put).toHaveBeenCalled());
    const [url, body] = stub.put.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(url).toBe('/expenses/exp-7');
    // The edit sends every field, not a diff — a partial body would blank the
    // category on a server that replaces rather than merges.
    expect(body).toMatchObject({ amount: 3500, category: 'utilities' });
  });
});

describe('Expenses — removing one', () => {
  it('asks first, then deletes the row it asked about', async () => {
    const stub = setup([anExpense({ id: 'exp-9', category: 'marketing' })]);

    renderPage(<Expenses />);
    await userEvent.click(await screen.findByRole('button', { name: /delete marketing expense/i }));

    expect(stub.delete).not.toHaveBeenCalled();

    await userEvent.click(
      await screen.findByRole('button', { name: /^delete$|confirm/i }),
    );

    await waitFor(() => expect(stub.delete).toHaveBeenCalledWith('/expenses/exp-9'));
  });
});

describe('Expenses — the filters', () => {
  it('asks the server for the category, rather than filtering what it holds', async () => {
    const stub = setup();

    renderPage(<Expenses />);
    await screen.findByRole('button', { name: /add expense/i });
    await userEvent.selectOptions(screen.getByLabelText(/filter by category/i), 'utilities');

    // Server-side, so the totals above the table describe every match rather
    // than the page in hand.
    await waitFor(() => {
      expect(stub.callsTo('category=utilities').length).toBeGreaterThan(0);
    });
  });
});
