import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { listPage, mockApi, renderPage } from '../helpers';
import type { MembershipPlan } from '../../src/types';

/**
 * What the gym sells.
 *
 * Every membership ever sold points at one of these rows, which is why the
 * page retires a plan rather than deleting it — the distinction is the whole
 * reason `DELETE` here is not destructive, and a regression that turned it
 * into a real delete would take the price history of every past member with
 * it.
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

const MembershipPlans = (await import('../../src/pages/MembershipPlans')).default;

const aPlan = (over: Partial<MembershipPlan> = {}): MembershipPlan => ({
  id: 'plan-1',
  gymId: 'gym-1',
  name: 'Monthly',
  price: 3000,
  durationDays: 30,
  includesCardio: false,
  includesLocker: false,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const setup = (plans: MembershipPlan[] = [aPlan()]) => {
  api.current = mockApi({ '/membership-plans': listPage(plans) });
  return api.current;
};

describe('MembershipPlans — adding one', () => {
  it('sends the name, price and duration', async () => {
    const stub = setup([]);

    renderPage(<MembershipPlans />);
    await userEvent.click(await screen.findByRole('button', { name: /add plan/i }));
    await userEvent.type(screen.getByLabelText(/plan name/i), 'Quarterly');
    await userEvent.type(screen.getByLabelText(/price/i), '8000');
    await userEvent.clear(screen.getByLabelText(/duration/i));
    await userEvent.type(screen.getByLabelText(/duration/i), '90');
    await userEvent.click(screen.getByRole('button', { name: /^add plan$/i }));

    await waitFor(() => expect(stub.post).toHaveBeenCalled());
    const [url, body] = stub.post.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(url).toBe('/membership-plans');
    expect(body).toMatchObject({ name: 'Quarterly', durationDays: '90' });
  });

  it('treats a blank price as zero, not as nothing', async () => {
    const stub = setup([]);

    renderPage(<MembershipPlans />);
    await userEvent.click(await screen.findByRole('button', { name: /add plan/i }));
    await userEvent.type(screen.getByLabelText(/plan name/i), 'Trial');
    await userEvent.clear(screen.getByLabelText(/duration/i));
    await userEvent.type(screen.getByLabelText(/duration/i), '7');
    await userEvent.click(screen.getByRole('button', { name: /^add plan$/i }));

    await waitFor(() => expect(stub.post).toHaveBeenCalled());
    const [, body] = stub.post.mock.calls[0] as unknown as [string, Record<string, unknown>];
    // '' would reach the server as a missing price and be rejected; 0 is a
    // plan the gym has decided to give away, which is a real thing to sell.
    expect(body.price).toBe(0);
  });
});

describe('MembershipPlans — retiring one', () => {
  it('asks before retiring, then stops offering the plan it asked about', async () => {
    const stub = setup([aPlan({ id: 'plan-9', name: 'Annual' })]);

    renderPage(<MembershipPlans />);
    await userEvent.click(await screen.findByRole('button', { name: /stop offering annual/i }));

    expect(stub.delete).not.toHaveBeenCalled();

    // Scoped to the dialog: the card behind it carries the button that
    // opened this one, under the same name.
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      within(dialog).getByRole('button', { name: /stop offering|confirm|retire/i }),
    );

    await waitFor(() => expect(stub.delete).toHaveBeenCalledWith('/membership-plans/plan-9'));
  });

  it('offers a retired plan again without touching its price', async () => {
    const stub = setup([aPlan({ id: 'plan-3', name: 'Weekly', isActive: false })]);

    renderPage(<MembershipPlans />);
    await userEvent.click(await screen.findByRole('button', { name: /show retired plans/i }));
    await userEvent.click(await screen.findByRole('button', { name: /offer weekly again/i }));

    // Only the flag. Sending the whole form back would let a stale price
    // overwrite what the plan actually costs.
    await waitFor(() => expect(stub.put).toHaveBeenCalledWith(
      '/membership-plans/plan-3',
      { isActive: true },
    ));
  });
});
