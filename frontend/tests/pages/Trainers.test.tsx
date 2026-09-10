import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { aTrainer, listPage, mockApi, ownerAuth, renderPage } from '../helpers';

/**
 * Trainers and what they are owed.
 *
 * The rule worth a test is the assignment fee: blank means "whatever the gym
 * charges", and the page has to send that as null. `Number('')` is 0, which is
 * a trainer the gym has decided to assign for free — a different and much more
 * expensive statement, and one nobody would notice until a month of PT was
 * billed at nothing.
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

vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ownerAuth }));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const Trainers = (await import('../../src/pages/Trainers')).default;

const setup = (trainers = [aTrainer()]) => {
  api.current = mockApi({
    '/trainers': listPage(trainers),
    '/members': listPage([]),
    '/gym-settings': { defaultPtFee: 2000 },
    '/pt-sessions/commissions': [],
    '/pt-sessions': listPage([]),
    '/payouts': listPage([]),
  });
  return api.current;
};

/** Opens the add-trainer modal with a name filled in. */
const openForm = async (stub: ReturnType<typeof setup>) => {
  renderPage(<Trainers />);
  await userEvent.click(await screen.findByRole('button', { name: /add trainer/i }));
  await userEvent.type(screen.getByLabelText(/full name/i), 'Coach Bilal');
  return stub;
};

describe('Trainers — adding one', () => {
  it('sends a blank assignment fee as null, meaning the gym default', async () => {
    const stub = setup();

    await openForm(stub);
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(stub.post).toHaveBeenCalled());
    const [url, body] = stub.post.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(url).toBe('/trainers');
    // Null, not 0. Zero is "assign this trainer for free" and would be
    // charged — or rather not charged — to every member they take on.
    expect(body.ptFee).toBeNull();
  });

  it('sends a fee that was typed as a number', async () => {
    const stub = setup();

    await openForm(stub);
    await userEvent.type(screen.getByLabelText(/assignment fee/i), '3500');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(stub.post).toHaveBeenCalled());
    const [, body] = stub.post.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(body.ptFee).toBe(3500);
  });

  it('keeps an explicit zero, which is a deliberate free assignment', async () => {
    const stub = setup();

    await openForm(stub);
    await userEvent.type(screen.getByLabelText(/assignment fee/i), '0');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(stub.post).toHaveBeenCalled());
    const [, body] = stub.post.mock.calls[0] as unknown as [string, Record<string, unknown>];
    // The other half of the same rule: a typed 0 must survive as 0 rather
    // than being folded back into "use the default".
    expect(body.ptFee).toBe(0);
  });
});

describe('Trainers — deactivating one', () => {
  it('asks before deactivating, then deactivates the trainer it asked about', async () => {
    const stub = setup([aTrainer({ id: 'tr-4', name: 'Coach Sana' })]);

    renderPage(<Trainers />);
    const [remove] = await screen.findAllByRole('button', { name: /deactivate|remove/i });
    await userEvent.click(remove!);

    expect(stub.delete).not.toHaveBeenCalled();

    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      within(dialog).getByRole('button', { name: /deactivate|confirm/i }),
    );

    await waitFor(() => expect(stub.delete).toHaveBeenCalledWith('/trainers/tr-4'));
  });
});
