import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockApi, renderPage } from '../helpers';

/**
 * Registering a gym.
 *
 * Run once per customer and never again, which is exactly why it is worth a
 * test: a regression here is invisible until the next sale, and the person who
 * hits it is a stranger who cannot get in touch.
 */

const api = vi.hoisted(() => ({ current: null as ReturnType<typeof import('../helpers')['mockApi']> | null }));
const login = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());

vi.mock('../../src/api/client', () => ({
  default: {
    get: (url: string) => api.current!.get(url),
    post: (...args: unknown[]) => api.current!.post(...args as []),
    put: (...args: unknown[]) => api.current!.put(...args as []),
    delete: (...args: unknown[]) => api.current!.delete(...args as []),
  },
  apiError: (_e: unknown, fallback = 'Something went wrong') => fallback,
}));

vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ login }) }));

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useNavigate: () => navigate,
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const Register = (await import('../../src/pages/Register')).default;

const session = {
  user: { id: 'u1', name: 'Ahmed Khan', role: 'owner' },
  gym: { id: 'g1', name: 'Fitness Plus Gym' },
};

const fillForm = async (over: { phone?: string } = {}) => {
  await userEvent.type(screen.getByPlaceholderText('Fitness Plus Gym'), 'Iron House');
  await userEvent.type(screen.getByPlaceholderText('Ahmed Khan'), 'Ahmed Khan');
  await userEvent.type(screen.getByPlaceholderText('owner@gym.com'), 'ahmed@ironhouse.pk');
  if (over.phone) await userEvent.type(screen.getByPlaceholderText('03001234567'), over.phone);
  await userEvent.type(screen.getByPlaceholderText(/min 8 characters/i), 'hunter2hunter2');
};

describe('Register', () => {
  it('sends every field the gym typed', async () => {
    const post = vi.fn(() => Promise.resolve({ data: session }));
    api.current = { ...mockApi({}), post };

    renderPage(<Register />);
    await fillForm({ phone: '03001234567' });
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/auth/register', {
      gymName: 'Iron House',
      ownerName: 'Ahmed Khan',
      email: 'ahmed@ironhouse.pk',
      password: 'hunter2hunter2',
      phone: '03001234567',
    }));
  });

  it('registers without a phone, which is the one optional field', async () => {
    const post = vi.fn(() => Promise.resolve({ data: session }));
    api.current = { ...mockApi({}), post };

    renderPage(<Register />);
    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    const [, body] = post.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(body.phone).toBe('');
  });

  it('signs the new owner straight in', async () => {
    const post = vi.fn(() => Promise.resolve({ data: session }));
    api.current = { ...mockApi({}), post };

    renderPage(<Register />);
    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    // Registering and then being asked to log in would be a poor first
    // minute, and the API already returns the session.
    await waitFor(() => expect(login).toHaveBeenCalledWith(session.user, session.gym));
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('keeps what was typed when the server refuses', async () => {
    login.mockClear();
    const post = vi.fn(() => Promise.reject(new Error('Email already registered')));
    api.current = { ...mockApi({}), post };

    renderPage(<Register />);
    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    // A rejected registration must be one correction away from working, not
    // five fields of retyping.
    await waitFor(() => expect(login).not.toHaveBeenCalled());
    expect(screen.getByPlaceholderText('Fitness Plus Gym')).toHaveValue('Iron House');
    expect(screen.getByPlaceholderText('owner@gym.com')).toHaveValue('ahmed@ironhouse.pk');
  });
});
